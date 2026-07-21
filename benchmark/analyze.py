#!/usr/bin/env python3
# =============================================================================
#  analyze.py — Analiza statystyczna wynikow pomiaru CI/CD
# -----------------------------------------------------------------------------
#  Wejscie:  metrics.csv  (Platforma, Numer_Proby, Status, Czas_Trwania_Sekundy)
#  Wyjscie:  tabela statystyk w konsoli + wykres slupkowy `plot.png`.
#
#  Dla kazdej platformy liczone sa: srednia, mediana, min, max oraz odchylenie
#  standardowe (std) czasu trwania. Do analizy brane sa wylacznie przebiegi
#  zakonczone sukcesem, aby bledy/anomalie nie zafalszowaly statystyk.
# =============================================================================

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use('Agg')  # backend bez GUI — pozwala zapisac PNG bez okna
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

# --- Sciezki (wzgledem katalogu skryptu) -------------------------------------
BASE_DIR = Path(__file__).resolve().parent
METRICS_CSV = BASE_DIR / 'metrics.csv'
PLOT_PNG = BASE_DIR / 'plot.png'

# Statusy uznawane za pomyslne zakonczenie (rozne platformy, rozne nazwy).
SUCCESS_STATUSES = {'success', 'completed'}


def load_metrics(path: Path) -> pd.DataFrame:
    """Wczytuje metrics.csv i waliduje strukture."""
    if not path.exists():
        raise FileNotFoundError(
            f'Nie znaleziono pliku danych: {path}. '
            f'Najpierw uruchom benchmark.py, aby zebrac metryki.'
        )

    df = pd.read_csv(path)
    required = {'Platforma', 'Numer_Proby', 'Status', 'Czas_Trwania_Sekundy'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f'Plik {path.name} nie zawiera wymaganych kolumn: {missing}')

    # Czas trwania na typ numeryczny (puste/bledne -> NaN).
    df['Czas_Trwania_Sekundy'] = pd.to_numeric(df['Czas_Trwania_Sekundy'], errors='coerce')
    df['Status'] = df['Status'].astype(str).str.strip().str.lower()
    return df


def compute_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Liczy statystyki opisowe czasu trwania per platforma (tylko sukcesy)."""
    successful = df[df['Status'].isin(SUCCESS_STATUSES) & df['Czas_Trwania_Sekundy'].notna()]
    if successful.empty:
        raise ValueError('Brak zakonczonych sukcesem przebiegow do analizy.')

    stats = (
        successful.groupby('Platforma')['Czas_Trwania_Sekundy']
        .agg(
            Liczba_Prob='count',
            Srednia='mean',
            Mediana='median',
            Min='min',
            Max='max',
            Std='std',
        )
        .round(2)
    )
    return stats


def render_plot(stats: pd.DataFrame, output: Path) -> None:
    """Rysuje wykres slupkowy sredniego czasu z waskimi wasami bledu (std)."""
    platforms = stats.index.tolist()
    means = stats['Srednia']
    errors = stats['Std'].fillna(0.0)

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(
        platforms,
        means,
        yerr=errors,
        capsize=6,
        color=['#2563eb', '#f59e0b', '#10b981'][: len(platforms)],
        edgecolor='#1e293b',
    )

    ax.set_title('Sredni czas trwania potoku CI/CD wg platformy', fontsize=13, fontweight='bold')
    ax.set_ylabel('Czas trwania [s]')
    ax.set_xlabel('Platforma')
    ax.grid(axis='y', linestyle='--', alpha=0.4)

    # Etykiety wartosci nad slupkami.
    for bar, mean in zip(bars, means):
        ax.annotate(
            f'{mean:.1f}s',
            xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
            xytext=(0, 4),
            textcoords='offset points',
            ha='center',
            va='bottom',
            fontsize=10,
        )

    fig.tight_layout()
    fig.savefig(output, dpi=150)
    plt.close(fig)


def main() -> int:
    try:
        df = load_metrics(METRICS_CSV)
        stats = compute_stats(df)
    except (FileNotFoundError, ValueError) as exc:
        print(f'[BLAD] {exc}', file=sys.stderr)
        return 1

    print('\n================ STATYSTYKI CZASU TRWANIA (sekundy) ================')
    print(stats.to_string())
    print('===================================================================\n')

    try:
        render_plot(stats, PLOT_PNG)
    except Exception as exc:  # noqa: BLE001 — statystyki juz wypisane, wykres opcjonalny
        print(f'[OSTRZEZENIE] Nie udalo sie wygenerowac wykresu: {exc}', file=sys.stderr)
        return 0

    print(f'Wykres zapisano: {PLOT_PNG}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
