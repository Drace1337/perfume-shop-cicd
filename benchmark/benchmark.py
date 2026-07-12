#!/usr/bin/env python3
# =============================================================================
#  benchmark.py — Narzedzie pomiarowe wydajnosci potokow CI/CD
# -----------------------------------------------------------------------------
#  Cel (praca magisterska): powtarzalny, zautomatyzowany pomiar czasu trwania
#  (Execution Time) potokow uruchamianych na trzech platformach:
#    * GitHub Actions
#    * GitLab CI
#    * Jenkins (lokalnie, localhost:8090)
#
#  Dla kazdej platformy narzedzie: wyzwala potok (Trigger), odpytuje API o
#  status (Polling) i po statusie koncowym oblicza czas trwania w sekundach.
#  Iteracje wykonywane sa SEKWENCYJNIE, aby wspolbiezne obciazenie (np. dysku
#  na wspoldzielonej infrastrukturze) nie zafalszowalo wynikow.
#
#  Wynik: plik CSV w formacie:
#      Platforma, Numer_Proby, Status, Czas_Trwania_Sekundy
# =============================================================================

from __future__ import annotations

import csv
import logging
import os
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from dotenv import dotenv_values
from requests import Response, Session
from requests.exceptions import RequestException

# -----------------------------------------------------------------------------
#  Konfiguracja logowania — czytelny postep badan w konsoli.
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('benchmark')

# Timeout (connect, read) pojedynczego zadania HTTP — chroni przed zawieszeniem.
HTTP_TIMEOUT = (10, 30)
# Liczba prob ponowienia zadania HTTP przy bledach przejsciowych (5xx / sieciowe).
HTTP_RETRIES = 3
# Odstep miedzy ponowieniami zadania HTTP.
HTTP_RETRY_BACKOFF = 5


# =============================================================================
#  Wyjatki domenowe.
# =============================================================================
class PipelineError(Exception):
    """Bazowy wyjatek narzedzia pomiarowego."""


class ConfigError(PipelineError):
    """Brakujaca lub niepoprawna konfiguracja (.env)."""


class TriggerError(PipelineError):
    """Nie udalo sie wyzwolic potoku."""


class PollTimeoutError(PipelineError):
    """Potok nie zakonczyl sie w wyznaczonym limicie czasu."""


class AuthError(PipelineError):
    """Blad uwierzytelnienia / autoryzacji (HTTP 401 / 403)."""


# =============================================================================
#  Struktury danych.
# =============================================================================
@dataclass
class RunHandle:
    """Uchwyt do konkretnego, wyzwolonego uruchomienia potoku."""

    run_id: str
    web_url: Optional[str] = None
    # Monotoniczny znacznik czasu wyzwolenia (fallback do pomiaru czasu trwania).
    started_monotonic: float = field(default_factory=time.monotonic)


@dataclass
class RunResult:
    """Pojedynczy zmierzony wynik (jeden wiersz CSV)."""

    platform: str
    attempt: int
    status: str
    duration_seconds: Optional[float]


@dataclass
class Config:
    """Konfiguracja eksperymentu wczytana z pliku .env."""

    iterations: int
    poll_interval: int
    run_timeout: int
    output_csv: str

    github_api_url: str
    github_owner: str
    github_repo: str
    github_workflow_id: str
    github_ref: str
    github_token: str

    gitlab_api_url: str
    gitlab_project_id: str
    gitlab_ref: str
    gitlab_token: str

    jenkins_url: str
    jenkins_job: str
    jenkins_user: str
    jenkins_token: str

    @classmethod
    def load(cls, env_path: Path) -> 'Config':
        if not env_path.exists():
            raise ConfigError(
                f'Nie znaleziono pliku konfiguracji: {env_path}. '
                f'Skopiuj .env.example do .env i uzupelnij wartosci.'
            )

        # dotenv_values nie modyfikuje globalnego srodowiska procesu.
        raw = {**dotenv_values(env_path), **os.environ}

        def required(key: str) -> str:
            value = (raw.get(key) or '').strip()
            if not value:
                raise ConfigError(f'Brak wymaganej zmiennej w .env: {key}')
            return value

        def optional(key: str, default: str) -> str:
            return (raw.get(key) or default).strip()

        def as_int(key: str, default: int) -> int:
            value = (raw.get(key) or '').strip()
            if not value:
                return default
            try:
                return int(value)
            except ValueError as exc:
                raise ConfigError(f'Zmienna {key} musi byc liczba calkowita.') from exc

        return cls(
            iterations=as_int('ITERATIONS', 10),
            poll_interval=as_int('POLL_INTERVAL_SECONDS', 10),
            run_timeout=as_int('RUN_TIMEOUT_SECONDS', 1800),
            output_csv=optional('OUTPUT_CSV', 'metrics.csv'),
            github_api_url=optional('GITHUB_API_URL', 'https://api.github.com').rstrip('/'),
            github_owner=required('GITHUB_OWNER'),
            github_repo=required('GITHUB_REPO'),
            github_workflow_id=required('GITHUB_WORKFLOW_ID'),
            github_ref=optional('GITHUB_REF', 'main'),
            github_token=required('GITHUB_TOKEN'),
            gitlab_api_url=optional('GITLAB_API_URL', 'https://gitlab.com/api/v4').rstrip('/'),
            gitlab_project_id=required('GITLAB_PROJECT_ID'),
            gitlab_ref=optional('GITLAB_REF', 'main'),
            gitlab_token=required('GITLAB_TOKEN'),
            jenkins_url=optional('JENKINS_URL', 'http://localhost:8090').rstrip('/'),
            jenkins_job=required('JENKINS_JOB_NAME'),
            jenkins_user=required('JENKINS_USER'),
            jenkins_token=required('JENKINS_API_TOKEN'),
        )


# =============================================================================
#  Pomocnicze funkcje.
# =============================================================================
def _parse_iso(timestamp: Optional[str]) -> Optional[datetime]:
    """Parsuje znacznik czasu ISO 8601 (z 'Z' lub offsetem) do datetime UTC."""
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError:
        return None


# =============================================================================
#  Klasa bazowa — wspolny szkielet: trigger -> polling -> pomiar czasu.
# =============================================================================
class PipelineRunner(ABC):
    """Wspolny kontrakt dla wszystkich platform CI/CD."""

    name: str = 'generic'

    def __init__(self, session: Session, poll_interval: int, run_timeout: int) -> None:
        self.session = session
        self.poll_interval = poll_interval
        self.run_timeout = run_timeout

    # --- Metody do zaimplementowania przez konkretne platformy ---------------
    @abstractmethod
    def trigger(self) -> RunHandle:
        """Wyzwala potok i zwraca uchwyt do jego uruchomienia."""

    @abstractmethod
    def poll(self, handle: RunHandle) -> tuple[bool, str, Optional[float]]:
        """Zwraca (czy_zakonczony, status_tekstowy, czas_trwania_lub_None)."""

    # --- Wspolna logika sterujaca --------------------------------------------
    def run(self, attempt: int) -> RunResult:
        """Pelny cykl jednego pomiaru: wyzwolenie + odpytywanie do skutku."""
        log.info('[%s] Proba %d: wyzwalanie potoku...', self.name, attempt)
        handle = self.trigger()
        log.info('[%s] Proba %d: uruchomiono (id=%s). %s',
                 self.name, attempt, handle.run_id, handle.web_url or '')

        deadline = time.monotonic() + self.run_timeout
        while True:
            finished, status, reported_duration = self.poll(handle)
            if finished:
                duration = reported_duration
                if duration is None:
                    duration = time.monotonic() - handle.started_monotonic
                log.info('[%s] Proba %d: ZAKONCZONO status=%s czas=%.1fs',
                         self.name, attempt, status, duration)
                return RunResult(self.name, attempt, status, round(duration, 2))

            if time.monotonic() > deadline:
                raise PollTimeoutError(
                    f'[{self.name}] Przekroczono limit {self.run_timeout}s '
                    f'oczekiwania na zakonczenie (ostatni status: {status}).'
                )

            log.info('[%s] Proba %d: status=%s (kolejne sprawdzenie za %ds)...',
                     self.name, attempt, status, self.poll_interval)
            time.sleep(self.poll_interval)

    # --- Wspolny, odporny na bledy klient HTTP -------------------------------
    def _request(self, method: str, url: str, **kwargs) -> Response:
        """Wykonuje zadanie HTTP z timeoutem, ponowieniami i mapowaniem bledow."""
        kwargs.setdefault('timeout', HTTP_TIMEOUT)
        last_exc: Optional[Exception] = None

        for attempt in range(1, HTTP_RETRIES + 1):
            try:
                response = self.session.request(method, url, **kwargs)
            except RequestException as exc:
                last_exc = exc
                log.warning('[%s] Blad sieci (%s) przy %s %s — proba %d/%d.',
                            self.name, exc.__class__.__name__, method, url, attempt, HTTP_RETRIES)
                time.sleep(HTTP_RETRY_BACKOFF)
                continue

            if response.status_code in (401, 403):
                raise AuthError(
                    f'[{self.name}] HTTP {response.status_code} — blad uwierzytelnienia/'
                    f'autoryzacji. Sprawdz token i jego uprawnienia. URL: {url}'
                )

            # Bledy przejsciowe serwera — ponow probe.
            if response.status_code >= 500 and attempt < HTTP_RETRIES:
                log.warning('[%s] HTTP %d przy %s %s — ponawiam (%d/%d).',
                            self.name, response.status_code, method, url, attempt, HTTP_RETRIES)
                time.sleep(HTTP_RETRY_BACKOFF)
                continue

            return response

        raise PipelineError(
            f'[{self.name}] Nie udalo sie wykonac {method} {url} '
            f'po {HTTP_RETRIES} probach: {last_exc}'
        )


# =============================================================================
#  GitHub Actions.
# =============================================================================
class GitHubRunner(PipelineRunner):
    """Uruchamia i mierzy workflow GitHub Actions (wyzwalacz workflow_dispatch)."""

    name = 'GitHub'
    _FINISHED = 'completed'

    def __init__(self, cfg: Config, poll_interval: int, run_timeout: int) -> None:
        session = requests.Session()
        session.headers.update({
            'Authorization': f'Bearer {cfg.github_token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        })
        super().__init__(session, poll_interval, run_timeout)
        self.cfg = cfg
        self._base = (
            f'{cfg.github_api_url}/repos/{cfg.github_owner}/{cfg.github_repo}'
        )

    def trigger(self) -> RunHandle:
        # Znacznik czasu PRZED wyzwoleniem — do rozpoznania wlasnego uruchomienia.
        triggered_at = datetime.now(timezone.utc)
        dispatch_url = (
            f'{self._base}/actions/workflows/{self.cfg.github_workflow_id}/dispatches'
        )
        response = self._request('POST', dispatch_url, json={'ref': self.cfg.github_ref})
        if response.status_code != 204:
            raise TriggerError(
                f'[{self.name}] Nie udalo sie wyzwolic workflow '
                f'(HTTP {response.status_code}): {response.text[:300]}. '
                f'Upewnij sie, ze workflow zawiera `on: workflow_dispatch`.'
            )

        # workflow_dispatch nie zwraca ID uruchomienia — trzeba je odnalezc.
        return self._find_run(triggered_at)

    def _find_run(self, triggered_at: datetime) -> RunHandle:
        runs_url = f'{self._base}/actions/workflows/{self.cfg.github_workflow_id}/runs'
        params = {'branch': self.cfg.github_ref, 'event': 'workflow_dispatch', 'per_page': 20}

        # GitHub potrzebuje chwili, by uruchomienie pojawilo sie w API.
        for _ in range(24):
            response = self._request('GET', runs_url, params=params)
            response.raise_for_status()
            runs = response.json().get('workflow_runs', [])
            for item in runs:
                created = _parse_iso(item.get('created_at'))
                # Bufor 60s na niedokladnosc zegara i opoznienie rejestracji runu.
                if created and created >= triggered_at.replace(microsecond=0):
                    return RunHandle(
                        run_id=str(item['id']),
                        web_url=item.get('html_url'),
                    )
            time.sleep(5)

        raise TriggerError(
            f'[{self.name}] Wyzwolono workflow, ale nie odnaleziono jego '
            f'uruchomienia w API (sprawdz uprawnienia tokenu / nazwe galezi).'
        )

    def poll(self, handle: RunHandle) -> tuple[bool, str, Optional[float]]:
        url = f'{self._base}/actions/runs/{handle.run_id}'
        response = self._request('GET', url)
        response.raise_for_status()
        data = response.json()

        status = data.get('status', 'unknown')
        if status != self._FINISHED:
            return False, status, None

        conclusion = data.get('conclusion') or 'unknown'
        started = _parse_iso(data.get('run_started_at'))
        updated = _parse_iso(data.get('updated_at'))
        duration = None
        if started and updated:
            duration = max((updated - started).total_seconds(), 0.0)
        return True, conclusion, duration


# =============================================================================
#  GitLab CI.
# =============================================================================
class GitLabRunner(PipelineRunner):
    """Uruchamia i mierzy pipeline GitLab CI."""

    name = 'GitLab'
    _FINISHED = {'success', 'failed', 'canceled', 'skipped', 'manual'}

    def __init__(self, cfg: Config, poll_interval: int, run_timeout: int) -> None:
        session = requests.Session()
        session.headers.update({'PRIVATE-TOKEN': cfg.gitlab_token})
        super().__init__(session, poll_interval, run_timeout)
        self.cfg = cfg
        self._base = f'{cfg.gitlab_api_url}/projects/{cfg.gitlab_project_id}'

    def trigger(self) -> RunHandle:
        url = f'{self._base}/pipeline'
        response = self._request('POST', url, params={'ref': self.cfg.gitlab_ref})
        if response.status_code not in (200, 201):
            raise TriggerError(
                f'[{self.name}] Nie udalo sie utworzyc pipeline '
                f'(HTTP {response.status_code}): {response.text[:300]}.'
            )
        data = response.json()
        return RunHandle(run_id=str(data['id']), web_url=data.get('web_url'))

    def poll(self, handle: RunHandle) -> tuple[bool, str, Optional[float]]:
        url = f'{self._base}/pipelines/{handle.run_id}'
        response = self._request('GET', url)
        response.raise_for_status()
        data = response.json()

        status = data.get('status', 'unknown')
        if status not in self._FINISHED:
            return False, status, None

        # GitLab zwraca precyzyjny czas wykonania w polu `duration` (sekundy).
        duration = data.get('duration')
        if duration is None:
            started = _parse_iso(data.get('started_at')) or _parse_iso(data.get('created_at'))
            finished = _parse_iso(data.get('updated_at'))
            if started and finished:
                duration = max((finished - started).total_seconds(), 0.0)
        return True, status, float(duration) if duration is not None else None


# =============================================================================
#  Jenkins (lokalny).
# =============================================================================
class JenkinsRunner(PipelineRunner):
    """Uruchamia i mierzy zadanie (job) w Jenkinsie."""

    name = 'Jenkins'

    def __init__(self, cfg: Config, poll_interval: int, run_timeout: int) -> None:
        session = requests.Session()
        session.auth = (cfg.jenkins_user, cfg.jenkins_token)
        super().__init__(session, poll_interval, run_timeout)
        self.cfg = cfg
        self._job_base = f'{cfg.jenkins_url}/job/{cfg.jenkins_job}'

    def _crumb_header(self) -> dict:
        """Pobiera token CSRF (crumb), jesli ochrona jest wlaczona."""
        try:
            response = self.session.get(
                f'{self.cfg.jenkins_url}/crumbIssuer/api/json', timeout=HTTP_TIMEOUT
            )
        except RequestException:
            return {}
        if response.status_code != 200:
            return {}
        data = response.json()
        return {data['crumbRequestField']: data['crumb']}

    def trigger(self) -> RunHandle:
        headers = self._crumb_header()
        response = self._request('POST', f'{self._job_base}/build', headers=headers)
        if response.status_code not in (200, 201):
            raise TriggerError(
                f'[{self.name}] Nie udalo sie uruchomic zadania '
                f'(HTTP {response.status_code}): {response.text[:300]}.'
            )

        queue_url = response.headers.get('Location')
        if not queue_url:
            raise TriggerError(
                f'[{self.name}] Jenkins nie zwrocil naglowka Location '
                f'(pozycji w kolejce) — nie mozna sledzic uruchomienia.'
            )

        build_url = self._await_build_start(queue_url.rstrip('/'))
        return RunHandle(run_id=build_url, web_url=build_url)

    def _await_build_start(self, queue_url: str) -> str:
        """Czeka, az zadanie z kolejki zostanie przypisane do konkretnego builda."""
        for _ in range(60):
            response = self._request('GET', f'{queue_url}/api/json')
            response.raise_for_status()
            data = response.json()

            if data.get('cancelled'):
                raise TriggerError(f'[{self.name}] Zadanie zostalo anulowane w kolejce.')

            executable = data.get('executable')
            if executable and executable.get('url'):
                return executable['url'].rstrip('/')

            time.sleep(self.poll_interval)

        raise TriggerError(
            f'[{self.name}] Zadanie utknelo w kolejce (brak wolnego executora?).'
        )

    def poll(self, handle: RunHandle) -> tuple[bool, str, Optional[float]]:
        url = f'{handle.run_id}/api/json'
        response = self._request('GET', url)
        response.raise_for_status()
        data = response.json()

        if data.get('building', False) or data.get('result') is None:
            return False, 'building', None

        result = str(data.get('result', 'unknown')).lower()
        # Jenkins raportuje czas trwania w milisekundach.
        duration_ms = data.get('duration')
        duration = float(duration_ms) / 1000.0 if duration_ms else None
        return True, result, duration


# =============================================================================
#  Zapis wynikow do CSV (przyrostowo — czesciowe wyniki przetrwaja awarie).
# =============================================================================
class MetricsWriter:
    """Zapisuje kolejne wyniki do pliku CSV, opozniajac utrate danych."""

    HEADER = ['Platforma', 'Numer_Proby', 'Status', 'Czas_Trwania_Sekundy']

    def __init__(self, path: Path) -> None:
        self._path = path
        self._file = path.open('w', newline='', encoding='utf-8')
        self._writer = csv.writer(self._file)
        self._writer.writerow(self.HEADER)
        self._file.flush()

    def write(self, result: RunResult) -> None:
        duration = '' if result.duration_seconds is None else f'{result.duration_seconds:.2f}'
        self._writer.writerow([result.platform, result.attempt, result.status, duration])
        self._file.flush()  # gwarancja trwalosci po kazdym wierszu

    def close(self) -> None:
        self._file.close()


# =============================================================================
#  Orkiestracja eksperymentu.
# =============================================================================
def run_benchmark(cfg: Config) -> None:
    runners: list[PipelineRunner] = [
        GitHubRunner(cfg, cfg.poll_interval, cfg.run_timeout),
        GitLabRunner(cfg, cfg.poll_interval, cfg.run_timeout),
        JenkinsRunner(cfg, cfg.poll_interval, cfg.run_timeout),
    ]

    output_path = Path(cfg.output_csv)
    if not output_path.is_absolute():
        output_path = Path(__file__).resolve().parent / output_path

    log.info('=' * 70)
    log.info('Start eksperymentu: %d iteracji x %d platformy.', cfg.iterations, len(runners))
    log.info('Wyniki: %s', output_path)
    log.info('=' * 70)

    writer = MetricsWriter(output_path)
    started_at = time.monotonic()
    try:
        # Iteracje sekwencyjnie; w ramach iteracji platformy tez po kolei,
        # aby uniknac wspolbieznego obciazenia falszujacego pomiar.
        for attempt in range(1, cfg.iterations + 1):
            log.info('----- ITERACJA %d / %d -----', attempt, cfg.iterations)
            for runner in runners:
                try:
                    result = runner.run(attempt)
                except PipelineError as exc:
                    log.error('%s', exc)
                    result = RunResult(runner.name, attempt, 'ERROR', None)
                except Exception as exc:  # noqa: BLE001 — pojedynczy blad nie moze przerwac badan
                    log.exception('[%s] Nieoczekiwany blad: %s', runner.name, exc)
                    result = RunResult(runner.name, attempt, 'ERROR', None)
                writer.write(result)
    finally:
        writer.close()

    elapsed = time.monotonic() - started_at
    log.info('=' * 70)
    log.info('Eksperyment zakonczony w %.1f min. Wyniki zapisano: %s',
             elapsed / 60.0, output_path)
    log.info('=' * 70)


def main() -> int:
    env_path = Path(__file__).resolve().parent / '.env'
    try:
        cfg = Config.load(env_path)
    except ConfigError as exc:
        log.error('Blad konfiguracji: %s', exc)
        return 2

    try:
        run_benchmark(cfg)
    except KeyboardInterrupt:
        log.warning('Przerwano przez uzytkownika (Ctrl+C). Czesciowe wyniki sa zapisane.')
        return 130
    except PipelineError as exc:
        log.error('Krytyczny blad: %s', exc)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
