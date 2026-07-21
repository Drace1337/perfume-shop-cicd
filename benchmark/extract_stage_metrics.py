#!/usr/bin/env python3
# =============================================================================
#  extract_stage_metrics.py — Ekstrakcja czasow poszczegolnych etapow CI/CD
# -----------------------------------------------------------------------------
#  Cel (praca magisterska): identyfikacja waskich gardel przez pobranie czasu
#  trwania KAZDEGO etapu (job/stage) z ostatnich N uruchomien potoku na:
#    * GitLab CI       (REST API v4: .../pipelines/{id}/jobs)
#    * GitHub Actions  (REST API:   .../actions/runs/{id}/jobs)
#    * Jenkins         (Workflow/Stage View API: .../{build}/wfapi/describe)
#
#  Dla kazdego etapu zbierane sa: nazwa, czas startu, czas zakonczenia oraz
#  calkowity czas trwania w sekundach. Wynik: stage_metrics.json + .csv.
#
#  Konfiguracja (URL, ID, tokeny) wczytywana jest z istniejacego pliku .env.
# =============================================================================

from __future__ import annotations

import csv
import json
import logging
import os
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import dotenv_values
from requests import Response, Session
from requests.exceptions import RequestException

# -----------------------------------------------------------------------------
#  Logowanie — czytelny postep ekstrakcji.
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("stage-metrics")

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
OUTPUT_JSON = BASE_DIR / "stage_metrics.json"
OUTPUT_CSV = BASE_DIR / "stage_metrics.csv"

# Timeout (connect, read) pojedynczego zadania HTTP.
HTTP_TIMEOUT = (10, 30)
HTTP_RETRIES = 3
HTTP_RETRY_BACKOFF = 5


# =============================================================================
#  Wyjatki domenowe.
# =============================================================================
class ExtractionError(Exception):
    """Bazowy wyjatek narzedzia ekstrakcji."""


class ConfigError(ExtractionError):
    """Brakujaca lub niepoprawna konfiguracja (.env)."""


class AuthError(ExtractionError):
    """Blad uwierzytelnienia / autoryzacji (HTTP 401 / 403)."""


# =============================================================================
#  Struktury danych.
# =============================================================================
@dataclass
class StageMetric:
    """Pojedynczy zmierzony etap potoku (jeden wiersz CSV / obiekt JSON)."""

    platform: str
    run_id: str
    stage_name: str
    start_time: Optional[str]
    end_time: Optional[str]
    duration_seconds: Optional[float]


@dataclass
class Config:
    """Konfiguracja wczytana z .env (tylko wartosci potrzebne do ekstrakcji)."""

    runs_limit: int

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
    def load(cls, env_path: Path) -> "Config":
        if not env_path.exists():
            raise ConfigError(
                f"Nie znaleziono pliku konfiguracji: {env_path}. "
                f"Uzupelnij .env na podstawie .env.example."
            )

        raw = {**dotenv_values(env_path), **os.environ}

        def required(key: str) -> str:
            value = (raw.get(key) or "").strip()
            if not value:
                raise ConfigError(f"Brak wymaganej zmiennej w .env: {key}")
            return value

        def optional(key: str, default: str) -> str:
            return (raw.get(key) or default).strip()

        def as_int(key: str, default: int) -> int:
            value = (raw.get(key) or "").strip()
            if not value:
                return default
            try:
                return int(value)
            except ValueError as exc:
                raise ConfigError(f"Zmienna {key} musi byc liczba calkowita.") from exc

        return cls(
            # Ile ostatnich uruchomien pobrac (domyslnie zgodnie z ITERATIONS).
            runs_limit=as_int("ITERATIONS", 10),
            github_api_url=optional("GITHUB_API_URL", "https://api.github.com").rstrip(
                "/"
            ),
            github_owner=required("GITHUB_OWNER"),
            github_repo=required("GITHUB_REPO"),
            github_workflow_id=required("GITHUB_WORKFLOW_ID"),
            github_ref=optional("GITHUB_REF", "main"),
            github_token=required("GITHUB_TOKEN"),
            gitlab_api_url=optional(
                "GITLAB_API_URL", "https://gitlab.com/api/v4"
            ).rstrip("/"),
            gitlab_project_id=required("GITLAB_PROJECT_ID"),
            gitlab_ref=optional("GITLAB_REF", "main"),
            gitlab_token=required("GITLAB_TOKEN"),
            jenkins_url=optional("JENKINS_URL", "http://localhost:8090").rstrip("/"),
            jenkins_job=required("JENKINS_JOB_NAME"),
            jenkins_user=required("JENKINS_USER"),
            jenkins_token=required("JENKINS_API_TOKEN"),
        )


# =============================================================================
#  Pomocnicze funkcje czasu.
# =============================================================================
def _parse_iso(timestamp: Optional[str]) -> Optional[datetime]:
    """Parsuje ISO 8601 (z 'Z' lub offsetem) do datetime z informacja o strefie."""
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None


def _duration_between(start: Optional[str], end: Optional[str]) -> Optional[float]:
    """Liczy roznice czasu (sekundy) miedzy dwoma znacznikami ISO."""
    start_dt, end_dt = _parse_iso(start), _parse_iso(end)
    if start_dt and end_dt:
        return round(max((end_dt - start_dt).total_seconds(), 0.0), 2)
    return None


def _millis_to_iso(millis: Optional[int]) -> Optional[str]:
    """Konwertuje znacznik w milisekundach (epoch) na ISO 8601 UTC."""
    if not millis:
        return None
    return datetime.fromtimestamp(millis / 1000.0, tz=timezone.utc).isoformat()


# =============================================================================
#  Klasa bazowa ekstraktora.
# =============================================================================
class StageExtractor(ABC):
    """Wspolny kontrakt: pobierz N ostatnich uruchomien i ich etapy."""

    name: str = "generic"

    def __init__(self, session: Session, runs_limit: int) -> None:
        self.session = session
        self.runs_limit = runs_limit

    @abstractmethod
    def extract(self) -> list[StageMetric]:
        """Zwraca liste zmierzonych etapow ze wszystkich pobranych uruchomien."""

    def _request(self, method: str, url: str, **kwargs: Any) -> Response:
        """Zadanie HTTP z timeoutem, ponowieniami i mapowaniem bledow."""
        kwargs.setdefault("timeout", HTTP_TIMEOUT)
        last_exc: Optional[Exception] = None

        for attempt in range(1, HTTP_RETRIES + 1):
            try:
                response = self.session.request(method, url, **kwargs)
            except RequestException as exc:
                last_exc = exc
                log.warning(
                    "[%s] Blad sieci (%s) przy %s %s — proba %d/%d.",
                    self.name,
                    exc.__class__.__name__,
                    method,
                    url,
                    attempt,
                    HTTP_RETRIES,
                )
                time.sleep(HTTP_RETRY_BACKOFF)
                continue

            if response.status_code in (401, 403):
                raise AuthError(
                    f"[{self.name}] HTTP {response.status_code} — blad uwierzytelnienia/"
                    f"autoryzacji. Sprawdz token i jego uprawnienia. URL: {url}"
                )

            if response.status_code >= 500 and attempt < HTTP_RETRIES:
                log.warning(
                    "[%s] HTTP %d przy %s %s — ponawiam (%d/%d).",
                    self.name,
                    response.status_code,
                    method,
                    url,
                    attempt,
                    HTTP_RETRIES,
                )
                time.sleep(HTTP_RETRY_BACKOFF)
                continue

            return response

        raise ExtractionError(
            f"[{self.name}] Nie udalo sie wykonac {method} {url} "
            f"po {HTTP_RETRIES} probach: {last_exc}"
        )


# =============================================================================
#  GitLab CI.
# =============================================================================
class GitLabExtractor(StageExtractor):
    """Pobiera czasy jobow z ostatnich pipeline'ow GitLab CI (API v4)."""

    name = "GitLab"

    def __init__(self, cfg: Config) -> None:
        session = requests.Session()
        session.headers.update({"PRIVATE-TOKEN": cfg.gitlab_token})
        super().__init__(session, cfg.runs_limit)
        self.cfg = cfg
        self._base = f"{cfg.gitlab_api_url}/projects/{cfg.gitlab_project_id}"

    def extract(self) -> list[StageMetric]:
        metrics: list[StageMetric] = []
        pipelines = self._recent_pipelines()
        log.info("[%s] Pobrano %d pipeline(ow) do analizy.", self.name, len(pipelines))

        for pipeline in pipelines:
            pipeline_id = str(pipeline["id"])
            jobs = self._pipeline_jobs(pipeline_id)
            for job in jobs:
                start = job.get("started_at")
                end = job.get("finished_at")
                duration = job.get("duration")
                if duration is None:
                    duration = _duration_between(start, end)
                metrics.append(
                    StageMetric(
                        platform=self.name,
                        run_id=pipeline_id,
                        stage_name=job.get("name", "unknown"),
                        start_time=start,
                        end_time=end,
                        duration_seconds=(
                            round(float(duration), 2) if duration is not None else None
                        ),
                    )
                )
        return metrics

    def _recent_pipelines(self) -> list[dict]:
        url = f"{self._base}/pipelines"
        params = {
            "ref": self.cfg.gitlab_ref,
            "per_page": self.runs_limit,
            "order_by": "id",
            "sort": "desc",
        }
        response = self._request("GET", url, params=params)
        response.raise_for_status()
        return response.json()

    def _pipeline_jobs(self, pipeline_id: str) -> list[dict]:
        url = f"{self._base}/pipelines/{pipeline_id}/jobs"
        response = self._request("GET", url, params={"per_page": 100})
        response.raise_for_status()
        return response.json()


# =============================================================================
#  GitHub Actions.
# =============================================================================
class GitHubExtractor(StageExtractor):
    """Pobiera czasy jobow z ostatnich uruchomien workflow GitHub Actions."""

    name = "GitHub"

    def __init__(self, cfg: Config) -> None:
        session = requests.Session()
        session.headers.update(
            {
                "Authorization": f"Bearer {cfg.github_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )
        super().__init__(session, cfg.runs_limit)
        self.cfg = cfg
        self._base = f"{cfg.github_api_url}/repos/{cfg.github_owner}/{cfg.github_repo}"

    def extract(self) -> list[StageMetric]:
        metrics: list[StageMetric] = []
        runs = self._recent_runs()
        log.info("[%s] Pobrano %d uruchomien(ia) do analizy.", self.name, len(runs))

        for run in runs:
            run_id = str(run["id"])
            for job in self._run_jobs(run_id):
                start = job.get("started_at")
                end = job.get("completed_at")
                metrics.append(
                    StageMetric(
                        platform=self.name,
                        run_id=run_id,
                        stage_name=job.get("name", "unknown"),
                        start_time=start,
                        end_time=end,
                        duration_seconds=_duration_between(start, end),
                    )
                )
        return metrics

    def _recent_runs(self) -> list[dict]:
        url = f"{self._base}/actions/workflows/{self.cfg.github_workflow_id}/runs"
        params = {"branch": self.cfg.github_ref, "per_page": self.runs_limit}
        response = self._request("GET", url, params=params)
        response.raise_for_status()
        return response.json().get("workflow_runs", [])

    def _run_jobs(self, run_id: str) -> list[dict]:
        url = f"{self._base}/actions/runs/{run_id}/jobs"
        response = self._request("GET", url, params={"per_page": 100})
        response.raise_for_status()
        return response.json().get("jobs", [])


# =============================================================================
#  Jenkins (Workflow / Stage View API + fallbacki).
# =============================================================================
class JenkinsExtractor(StageExtractor):
    """Pobiera czasy stage'y z ostatnich buildow Jenkinsa.

    Lancuch zrodel (pierwsze, ktore zwroci dane, wygrywa) — odporny na brak
    wtyczek Stage View / Blue Ocean:
      1. Stage View / Workflow API   (wfapi/describe)
      2. Blue Ocean REST API         (.../runs/{n}/nodes/)
      3. Analiza logu z Timestamperem (parsowanie granic [Pipeline] stage)
      4. Ostateczny fallback: czas calego builda (api/json)
    """

    name = "Jenkins"

    def __init__(self, cfg: Config) -> None:
        session = requests.Session()
        session.auth = (cfg.jenkins_user, cfg.jenkins_token)
        super().__init__(session, cfg.runs_limit)
        self.cfg = cfg
        self._job_base = f"{cfg.jenkins_url}/job/{cfg.jenkins_job}"

    def extract(self) -> list[StageMetric]:
        metrics: list[StageMetric] = []
        builds = self._recent_builds()
        log.info("[%s] Pobrano %d build(ow) do analizy.", self.name, len(builds))

        for build in builds:
            number = str(build.get("number"))
            metrics.extend(self._build_stages(number))
        return metrics

    def _recent_builds(self) -> list[dict]:
        # tree= ogranicza odpowiedz tylko do numerow ostatnich buildow.
        url = f"{self._job_base}/api/json"
        params = {"tree": f"builds[number]{{0,{self.runs_limit}}}"}
        response = self._request("GET", url, params=params)
        response.raise_for_status()
        return response.json().get("builds", [])

    def _build_stages(self, build_number: str) -> list[StageMetric]:
        """Kolejno probuje zrodel danych, dopoki ktores nie zwroci stage'y."""
        for source_name, resolver in (
            ("wfapi", self._stages_wfapi),
            ("Blue Ocean", self._stages_blueocean),
            ("log/Timestamper", self._stages_from_log),
        ):
            try:
                stages = resolver(build_number)
            except ExtractionError as exc:
                log.warning(
                    "[%s] Build #%s: zrodlo %s niedostepne (%s).",
                    self.name,
                    build_number,
                    source_name,
                    exc,
                )
                stages = []
            if stages:
                return stages
            log.info(
                "[%s] Build #%s: brak danych ze zrodla %s — probuje kolejny fallback.",
                self.name,
                build_number,
                source_name,
            )

        log.warning(
            "[%s] Build #%s: brak danych o stage'ach — zapisuje czas calego builda.",
            self.name,
            build_number,
        )
        return self._stage_whole_build(build_number)

    # --- Zrodlo 1: Stage View / Workflow API ---------------------------------
    def _stages_wfapi(self, build_number: str) -> list[StageMetric]:
        url = f"{self._job_base}/{build_number}/wfapi/describe"
        response = self._request("GET", url)
        if response.status_code == 404:
            return []
        response.raise_for_status()

        metrics: list[StageMetric] = []
        for stage in response.json().get("stages", []):
            start_ms = stage.get("startTimeMillis")
            dur_ms = stage.get("durationMillis")
            end_ms = (
                start_ms + dur_ms
                if (start_ms is not None and dur_ms is not None)
                else None
            )
            metrics.append(
                StageMetric(
                    platform=self.name,
                    run_id=build_number,
                    stage_name=stage.get("name", "unknown"),
                    start_time=_millis_to_iso(start_ms),
                    end_time=_millis_to_iso(end_ms),
                    duration_seconds=(
                        round(dur_ms / 1000.0, 2) if dur_ms is not None else None
                    ),
                )
            )
        return metrics

    # --- Zrodlo 2: Blue Ocean REST API ---------------------------------------
    def _stages_blueocean(self, build_number: str) -> list[StageMetric]:
        url = (
            f"{self.cfg.jenkins_url}/blue/rest/organizations/jenkins/"
            f"pipelines/{self.cfg.jenkins_job}/runs/{build_number}/nodes/"
        )
        response = self._request("GET", url, params={"limit": 10000})
        if response.status_code == 404:
            return []
        response.raise_for_status()

        metrics: list[StageMetric] = []
        for node in response.json():
            # Interesuja nas wezly bedace stage'ami (pomijamy kroki wewnetrzne).
            if node.get("type") not in ("STAGE", "PARALLEL"):
                continue
            dur_ms = node.get("durationInMillis")
            start_dt = _parse_iso(node.get("startTime"))
            start_ms = int(start_dt.timestamp() * 1000) if start_dt else None
            end_ms = (
                start_ms + dur_ms
                if (start_ms is not None and dur_ms is not None)
                else None
            )
            metrics.append(
                StageMetric(
                    platform=self.name,
                    run_id=build_number,
                    stage_name=node.get("displayName", "unknown"),
                    start_time=_millis_to_iso(start_ms),
                    end_time=_millis_to_iso(end_ms),
                    duration_seconds=(
                        round(dur_ms / 1000.0, 2) if dur_ms is not None else None
                    ),
                )
            )
        return metrics

    # --- Zrodlo 3: analiza logu z prefiksami czasu (Timestamper) -------------
    def _stages_from_log(self, build_number: str) -> list[StageMetric]:
        import re

        url = f"{self._job_base}/{build_number}/timestamps/"
        params = {"time": "yyyy-MM-dd HH:mm:ss.SSS", "appendLog": ""}
        response = self._request("GET", url, params=params)
        if response.status_code == 404:
            return []
        response.raise_for_status()

        ts_pattern = re.compile(
            r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s?(.*)$"
        )
        open_pattern = re.compile(r"\[Pipeline\]\s*\{\s*\((.+?)\)")
        close_pattern = re.compile(r"\[Pipeline\]\s*\}\s*//\s*stage")

        stack: list[tuple[str, datetime]] = []
        metrics: list[StageMetric] = []
        for line in response.text.splitlines():
            match = ts_pattern.match(line)
            if not match:
                continue
            raw_time, content = match.group(1), match.group(2)
            try:
                stamp = datetime.strptime(raw_time, "%Y-%m-%d %H:%M:%S.%f").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                continue

            opened = open_pattern.search(content)
            if opened:
                stack.append((opened.group(1), stamp))
                continue
            if close_pattern.search(content) and stack:
                stage_name, start_dt = stack.pop()
                duration = max((stamp - start_dt).total_seconds(), 0.0)
                metrics.append(
                    StageMetric(
                        platform=self.name,
                        run_id=build_number,
                        stage_name=stage_name,
                        start_time=start_dt.isoformat(),
                        end_time=stamp.isoformat(),
                        duration_seconds=round(duration, 2),
                    )
                )

        metrics.sort(key=lambda m: m.start_time or "")
        return metrics

    # --- Zrodlo 4 (ostateczne): czas trwania calego builda -------------------
    def _stage_whole_build(self, build_number: str) -> list[StageMetric]:
        url = f"{self._job_base}/{build_number}/api/json"
        params = {"tree": "number,timestamp,duration,result"}
        response = self._request("GET", url, params=params)
        if response.status_code == 404:
            return []
        response.raise_for_status()

        data = response.json()
        start_ms = data.get("timestamp")
        dur_ms = data.get("duration")
        end_ms = (
            start_ms + dur_ms if (start_ms is not None and dur_ms is not None) else None
        )
        return [
            StageMetric(
                platform=self.name,
                run_id=build_number,
                stage_name="FULL_BUILD (fallback)",
                start_time=_millis_to_iso(start_ms),
                end_time=_millis_to_iso(end_ms),
                duration_seconds=(
                    round(dur_ms / 1000.0, 2) if dur_ms is not None else None
                ),
            )
        ]


# =============================================================================
#  Eksport wynikow.
# =============================================================================
def export_json(metrics: list[StageMetric], path: Path) -> None:
    payload = [asdict(metric) for metric in metrics]
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def export_csv(metrics: list[StageMetric], path: Path) -> None:
    header = [
        "Platforma",
        "Run_Id",
        "Etap",
        "Czas_Startu",
        "Czas_Zakonczenia",
        "Czas_Trwania_Sekundy",
    ]
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        for m in metrics:
            writer.writerow(
                [
                    m.platform,
                    m.run_id,
                    m.stage_name,
                    m.start_time or "",
                    m.end_time or "",
                    "" if m.duration_seconds is None else f"{m.duration_seconds:.2f}",
                ]
            )


# =============================================================================
#  Orkiestracja.
# =============================================================================
def run(cfg: Config) -> list[StageMetric]:
    extractors: list[StageExtractor] = [
        GitLabExtractor(cfg),
        GitHubExtractor(cfg),
        JenkinsExtractor(cfg),
    ]

    all_metrics: list[StageMetric] = []
    for extractor in extractors:
        log.info("----- Ekstrakcja: %s -----", extractor.name)
        try:
            metrics = extractor.extract()
            log.info("[%s] Zebrano %d etapow.", extractor.name, len(metrics))
            all_metrics.extend(metrics)
        except ExtractionError as exc:
            log.error("%s", exc)
        except (
            Exception
        ) as exc:  # noqa: BLE001 — blad jednej platformy nie przerywa reszty
            log.exception("[%s] Nieoczekiwany blad: %s", extractor.name, exc)

    return all_metrics


def main() -> int:
    try:
        cfg = Config.load(ENV_PATH)
    except ConfigError as exc:
        log.error("Blad konfiguracji: %s", exc)
        return 2

    metrics = run(cfg)
    if not metrics:
        log.error("Nie zebrano zadnych danych — sprawdz konfiguracje i dostepnosc API.")
        return 1

    export_json(metrics, OUTPUT_JSON)
    export_csv(metrics, OUTPUT_CSV)
    log.info("=" * 70)
    log.info("Zapisano %d etapow do:", len(metrics))
    log.info("  * %s", OUTPUT_JSON)
    log.info("  * %s", OUTPUT_CSV)
    log.info("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
