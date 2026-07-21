#!/usr/bin/env python3
# =============================================================================
#  generate_thesis_charts.py — Analiza i wizualizacja metryk CI/CD (praca mgr)
# -----------------------------------------------------------------------------
#  Wejscie:  stage_metrics.csv  (Platforma, Run_Id, Etap, Czas_Startu,
#            Czas_Zakonczenia, Czas_Trwania_Sekundy)
#
#  Wyjscie:
#    * summary_statistics.csv       — statystyki opisowe (mean/median/min/max/std)
#                                     per platforma i etap (kanoniczny).
#    * chart_grouped_bar.png        — porownanie srednich czasow etapow miedzy
#                                     platformami (grouped bar chart, >=300 DPI).
#    * chart_boxplot.png            — rozklad i stabilnosc czasow per platforma
#                                     (boxplot, >=300 DPI).
# =============================================================================

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # backend bez GUI — zapis PNG bez otwierania okna
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402

# --- Sciezki (wzgledem katalogu skryptu) -------------------------------------
BASE_DIR = Path(__file__).resolve().parent
INPUT_CSV = BASE_DIR / "stage_metrics.csv"
SUMMARY_CSV = BASE_DIR / "summary_statistics.csv"
BAR_CHART_PNG = BASE_DIR / "chart_grouped_bar.png"
BOX_CHART_PNG = BASE_DIR / "chart_boxplot.png"

DPI = 300

# Stonowana, spojna paleta kolorow platform (rozpoznawalne barwy marek).
PLATFORM_PALETTE = {
    "GitLab": "#FC6D26",  # pomaranczowy
    "GitHub": "#24292E",  # grafitowy/czarny
    "Jenkins": "#D33833",  # czerwony
}
PLATFORM_ORDER = ["GitLab", "GitHub", "Jenkins"]

# Kolejnosc etapow kanonicznych na osi wykresu slupkowego.
STAGE_ORDER = ["lint", "test", "build", "security", "deploy"]


def canonical_stage(name: str) -> str:
    """Mapuje heterogeniczne nazwy jobow/stage'y na wspolna taksonomie etapow."""
    n = str(name).lower()
    if "lint" in n:
        return "lint"
    if "test" in n:
        return "test"
    if "security" in n or "trivy" in n or "scan" in n:
        return "security"
    if "deploy" in n or "terraform" in n:
        return "deploy"
    if "build" in n or "image" in n or "push" in n:
        return "build"
    return "other"


def load_data(path: Path) -> pd.DataFrame:
    """Wczytuje i czysci dane wejsciowe."""
    if not path.exists():
        raise FileNotFoundError(
            f"Nie znaleziono pliku danych: {path}. "
            f"Najpierw uruchom extract_stage_metrics.py."
        )

    df = pd.read_csv(path)
    required = {"Platforma", "Etap", "Czas_Trwania_Sekundy"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Plik {path.name} nie zawiera wymaganych kolumn: {missing}")

    df["Czas_Trwania_Sekundy"] = pd.to_numeric(
        df["Czas_Trwania_Sekundy"], errors="coerce"
    )
    df = df.dropna(subset=["Czas_Trwania_Sekundy"])
    df = df[df["Czas_Trwania_Sekundy"] >= 0]
    df["Etap_Kanoniczny"] = df["Etap"].apply(canonical_stage)
    return df


def build_summary(df: pd.DataFrame, path: Path) -> pd.DataFrame:
    """Liczy statystyki opisowe per platforma + etap i zapisuje do CSV."""
    summary = (
        df.groupby(["Platforma", "Etap_Kanoniczny"])["Czas_Trwania_Sekundy"]
        .agg(
            Liczba_Prob="count",
            Srednia="mean",
            Mediana="median",
            Min="min",
            Max="max",
            Std="std",
        )
        .round(2)
        .reset_index()
        .rename(columns={"Etap_Kanoniczny": "Etap"})
    )
    summary.to_csv(path, index=False, encoding="utf-8")
    return summary


def plot_grouped_bar(df: pd.DataFrame, path: Path) -> None:
    """Grouped bar chart: srednie czasy etapow w rozbiciu na platformy."""
    # Do porownania miedzyplatformowego bierzemy tylko etapy kanoniczne.
    plot_df = df[df["Etap_Kanoniczny"].isin(STAGE_ORDER)].copy()
    present_platforms = [
        p for p in PLATFORM_ORDER if p in plot_df["Platforma"].unique()
    ]

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(11, 6))
    sns.barplot(
        data=plot_df,
        x="Etap_Kanoniczny",
        y="Czas_Trwania_Sekundy",
        hue="Platforma",
        order=STAGE_ORDER,
        hue_order=present_platforms,
        palette=PLATFORM_PALETTE,
        estimator=np.mean,
        errorbar="sd",
        capsize=0.08,
        err_kws={"linewidth": 1.2},
        ax=ax,
    )

    ax.set_title(
        "Sredni czas trwania etapow potoku CI/CD wg platformy",
        fontsize=14,
        fontweight="bold",
        pad=14,
    )
    ax.set_xlabel("Etap potoku", fontsize=12)
    ax.set_ylabel("Sredni czas trwania [s]", fontsize=12)
    ax.legend(title="Platforma", frameon=True)
    ax.grid(axis="y", linestyle="--", alpha=0.4)

    fig.tight_layout()
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)


def plot_boxplot(df: pd.DataFrame, path: Path) -> None:
    """Boxplot: rozklad i stabilnosc czasow trwania per platforma."""
    present_platforms = [p for p in PLATFORM_ORDER if p in df["Platforma"].unique()]

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(9, 6))
    sns.boxplot(
        data=df,
        x="Platforma",
        y="Czas_Trwania_Sekundy",
        order=present_platforms,
        hue="Platforma",
        palette=PLATFORM_PALETTE,
        legend=False,
        showfliers=True,
        width=0.55,
        ax=ax,
    )
    # Nalozone punkty pokazuja rozrzut poszczegolnych pomiarow.
    sns.stripplot(
        data=df,
        x="Platforma",
        y="Czas_Trwania_Sekundy",
        order=present_platforms,
        color="#333333",
        size=3,
        alpha=0.35,
        jitter=0.2,
        ax=ax,
    )

    ax.set_title(
        "Rozklad i stabilnosc czasow trwania etapow wg platformy",
        fontsize=14,
        fontweight="bold",
        pad=14,
    )
    ax.set_xlabel("Platforma", fontsize=12)
    ax.set_ylabel("Czas trwania etapu [s]", fontsize=12)
    ax.grid(axis="y", linestyle="--", alpha=0.4)

    fig.tight_layout()
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)


def main() -> int:
    try:
        df = load_data(INPUT_CSV)
    except (FileNotFoundError, ValueError) as exc:
        print(f"[BLAD] {exc}", file=sys.stderr)
        return 1

    if df.empty:
        print("[BLAD] Brak poprawnych rekordow do analizy.", file=sys.stderr)
        return 1

    summary = build_summary(df, SUMMARY_CSV)
    print("\n================ STATYSTYKI OPISOWE (sekundy) ================")
    print(summary.to_string(index=False))
    print("=============================================================\n")
    print(f"Zapisano statystyki: {SUMMARY_CSV}")

    plot_grouped_bar(df, BAR_CHART_PNG)
    print(f"Zapisano wykres: {BAR_CHART_PNG}")

    plot_boxplot(df, BOX_CHART_PNG)
    print(f"Zapisano wykres: {BOX_CHART_PNG}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
