#!/usr/bin/env python3
# =============================================================================
#  jenkins_monitor.py — Monitor zuzycia zasobow kontenera Jenkinsa
# -----------------------------------------------------------------------------
#  Co 1 sekunde odczytuje CPU i RAM kontenera Jenkinsa wywolujac `docker stats`
#  (przez modul subprocess) i zapisuje probki na zywo do jenkins_resources.csv.
#
#  Kolumny CSV:  Timestamp, CPU_Procent, RAM_MB
#
#  Uruchamiaj rownolegle z benchmarkiem, a nastepnie przerwij przez Ctrl+C —
#  bufor jest wtedy bezpiecznie domykany, a zebrane probki zostaja zapisane.
# =============================================================================

from __future__ import annotations

import csv
import re
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# Nazwa kontenera zgodna z docker-compose.yml (usluga jenkins).
CONTAINER_NAME = 'perfume-shop-jenkins'
SAMPLE_INTERVAL = 1.0  # sekundy miedzy probkami
OUTPUT_CSV = Path(__file__).resolve().parent / 'jenkins_resources.csv'

# Format zwracany przez docker stats: "<CPU>%,<uzyte> / <limit>"
STATS_FORMAT = '{{.CPUPerc}},{{.MemUsage}}'

# Flaga sterujaca petla — ustawiana na False przez obsluge sygnalu (Ctrl+C).
_running = True


def _handle_stop(signum, frame) -> None:  # noqa: ARG001
    """Sygnal przerwania — zatrzymuje petle po biezacej iteracji."""
    global _running
    _running = False
    print('\n[INFO] Otrzymano sygnal zatrzymania — domykam plik CSV...')


def _mem_to_mb(raw: str) -> float | None:
    """Konwertuje czlon uzycia pamieci (np. '512MiB', '1.5GiB', '900kB') na MB."""
    match = re.match(r'([\d.]+)\s*([a-zA-Z]+)', raw.strip())
    if not match:
        return None
    value, unit = float(match.group(1)), match.group(2).lower()
    factors = {
        'b': 1 / (1024 * 1024),
        'kib': 1 / 1024,
        'kb': 1 / 1024,
        'mib': 1.0,
        'mb': 1.0,
        'gib': 1024.0,
        'gb': 1024.0,
    }
    factor = factors.get(unit)
    return round(value * factor, 2) if factor is not None else None


def sample_stats() -> tuple[float | None, float | None]:
    """Pojedynczy odczyt CPU (%) i RAM (MB) przez `docker stats --no-stream`."""
    try:
        result = subprocess.run(
            ['docker', 'stats', CONTAINER_NAME, '--no-stream', '--format', STATS_FORMAT],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except FileNotFoundError:
        raise RuntimeError("Nie znaleziono polecenia 'docker' w PATH.") from None
    except subprocess.TimeoutExpired:
        print('[OSTRZEZENIE] docker stats przekroczyl limit czasu — pomijam probke.', file=sys.stderr)
        return None, None

    if result.returncode != 0:
        stderr = result.stderr.strip()
        raise RuntimeError(
            f"Nie udalo sie odczytac statystyk kontenera '{CONTAINER_NAME}'. "
            f'Czy kontener dziala? Szczegoly: {stderr}'
        )

    line = result.stdout.strip()
    if not line:
        return None, None

    cpu_part, _, mem_part = line.partition(',')
    cpu = None
    try:
        cpu = round(float(cpu_part.strip().rstrip('%')), 2)
    except ValueError:
        cpu = None

    # MemUsage ma format "<uzyte> / <limit>" — interesuje nas czlon uzyty.
    used = mem_part.split('/')[0]
    ram_mb = _mem_to_mb(used)
    return cpu, ram_mb


def main() -> int:
    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    print(f'[INFO] Monitoruje kontener: {CONTAINER_NAME} (co {SAMPLE_INTERVAL:g}s).')
    print(f'[INFO] Zapis do: {OUTPUT_CSV}')
    print('[INFO] Zatrzymaj klawiszami Ctrl+C.\n')

    samples = 0
    with OUTPUT_CSV.open('w', newline='', encoding='utf-8') as fh:
        writer = csv.writer(fh)
        writer.writerow(['Timestamp', 'CPU_Procent', 'RAM_MB'])
        fh.flush()

        while _running:
            loop_start = time.monotonic()
            timestamp = datetime.now().isoformat(timespec='seconds')

            try:
                cpu, ram_mb = sample_stats()
            except RuntimeError as exc:
                print(f'[BLAD] {exc}', file=sys.stderr)
                return 1

            if cpu is not None or ram_mb is not None:
                writer.writerow([
                    timestamp,
                    '' if cpu is None else cpu,
                    '' if ram_mb is None else ram_mb,
                ])
                fh.flush()  # zapis na zywo — dane przetrwaja Ctrl+C / awarie
                samples += 1
                print(f'{timestamp} | CPU: {cpu}% | RAM: {ram_mb} MB')

            # Utrzymanie stalego interwalu, uwzgledniajac czas trwania odczytu.
            elapsed = time.monotonic() - loop_start
            if _running and elapsed < SAMPLE_INTERVAL:
                time.sleep(SAMPLE_INTERVAL - elapsed)

    print(f'\n[INFO] Zakonczono. Zapisano {samples} probek do {OUTPUT_CSV}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
