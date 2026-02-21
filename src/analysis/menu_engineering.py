#!/usr/bin/env python3
"""Build menu-engineering tables from cleaned Stories item-profit data."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path
from statistics import median
from typing import Dict, Iterable, List, Optional, Tuple


def clean_text(value: str) -> str:
    return " ".join((value or "").strip().split())


def to_float(value: str) -> Optional[float]:
    text = clean_text(value).replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def round_or_none(value: Optional[float], ndigits: int = 2) -> Optional[float]:
    if value is None:
        return None
    return round(value, ndigits)


def safe_div(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / denominator


def read_rows(path: Path) -> Iterable[Dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        yield from csv.DictReader(handle)


def recommendation_for_quadrant(quadrant: str) -> str:
    mapping = {
        "star": "Keep quality high, feature prominently, and bundle for upsell.",
        "plowhorse": "High demand but low unit margin: optimize cost/price and portions.",
        "puzzle": "High unit margin but low demand: improve placement and run targeted promos.",
        "dog": "Low demand and low margin: consider reformulation, repricing, or phase-out.",
        "unclassified": "Insufficient sales signal: review tracking and data quality.",
    }
    return mapping.get(quadrant, "Review manually.")


def classify_quadrant(qty: float, profit_per_unit: Optional[float], qty_threshold: float, ppu_threshold: float) -> str:
    if qty <= 0 or profit_per_unit is None:
        return "unclassified"
    high_popularity = qty >= qty_threshold
    high_margin = profit_per_unit >= ppu_threshold
    if high_popularity and high_margin:
        return "star"
    if high_popularity and not high_margin:
        return "plowhorse"
    if not high_popularity and high_margin:
        return "puzzle"
    return "dog"


def build_base_rows(aggregate: Dict[Tuple[str, ...], Dict[str, object]]) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for key, values in aggregate.items():
        qty = float(values["qty"])
        revenue = float(values["true_revenue"])
        cost = float(values["total_cost"])
        profit = float(values["total_profit"])
        profit_per_unit = safe_div(profit, qty if qty > 0 else None)
        margin_pct = safe_div(profit, revenue)
        if margin_pct is not None:
            margin_pct *= 100

        row = dict(values)
        row.update(
            {
                "qty": qty,
                "true_revenue": revenue,
                "total_cost": cost,
                "total_profit": profit,
                "profit_per_unit": profit_per_unit,
                "profit_margin_pct": margin_pct,
            }
        )
        rows.append(row)
    return rows


def add_global_quadrants(rows: List[Dict[str, object]]) -> None:
    qty_values = [float(r["qty"]) for r in rows if float(r["qty"]) > 0]
    ppu_values = [float(r["profit_per_unit"]) for r in rows if r["profit_per_unit"] is not None]
    qty_threshold = median(qty_values) if qty_values else 0.0
    ppu_threshold = median(ppu_values) if ppu_values else 0.0

    total_profit_all = sum(float(r["total_profit"]) for r in rows)
    total_qty_all = sum(float(r["qty"]) for r in rows)
    total_revenue_all = sum(float(r["true_revenue"]) for r in rows)

    for row in rows:
        qty = float(row["qty"])
        ppu = row["profit_per_unit"]
        quadrant = classify_quadrant(qty, ppu, qty_threshold, ppu_threshold)

        row["qty_benchmark_median"] = qty_threshold
        row["profit_per_unit_benchmark_median"] = ppu_threshold
        row["popularity_index"] = safe_div(qty, qty_threshold)
        row["margin_index"] = safe_div(ppu, ppu_threshold) if ppu is not None else None
        row["quadrant"] = quadrant
        row["recommended_action"] = recommendation_for_quadrant(quadrant)
        row["profit_contribution_pct"] = safe_div(float(row["total_profit"]), total_profit_all)
        row["qty_share_pct"] = safe_div(qty, total_qty_all)
        row["revenue_share_pct"] = safe_div(float(row["true_revenue"]), total_revenue_all)

        if row["profit_contribution_pct"] is not None:
            row["profit_contribution_pct"] *= 100
        if row["qty_share_pct"] is not None:
            row["qty_share_pct"] *= 100
        if row["revenue_share_pct"] is not None:
            row["revenue_share_pct"] *= 100


def add_branch_quadrants(rows: List[Dict[str, object]]) -> None:
    by_branch: Dict[str, List[Dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_branch[str(row["branch"])].append(row)

    for branch, branch_rows in by_branch.items():
        qty_values = [float(r["qty"]) for r in branch_rows if float(r["qty"]) > 0]
        ppu_values = [float(r["profit_per_unit"]) for r in branch_rows if r["profit_per_unit"] is not None]
        qty_threshold = median(qty_values) if qty_values else 0.0
        ppu_threshold = median(ppu_values) if ppu_values else 0.0
        total_profit_branch = sum(float(r["total_profit"]) for r in branch_rows)

        for row in branch_rows:
            qty = float(row["qty"])
            ppu = row["profit_per_unit"]
            quadrant = classify_quadrant(qty, ppu, qty_threshold, ppu_threshold)

            row["branch_qty_benchmark_median"] = qty_threshold
            row["branch_ppu_benchmark_median"] = ppu_threshold
            row["branch_popularity_index"] = safe_div(qty, qty_threshold)
            row["branch_margin_index"] = safe_div(ppu, ppu_threshold) if ppu is not None else None
            row["branch_quadrant"] = quadrant
            row["branch_recommended_action"] = recommendation_for_quadrant(quadrant)
            row["branch_profit_contribution_pct"] = safe_div(float(row["total_profit"]), total_profit_branch)
            if row["branch_profit_contribution_pct"] is not None:
                row["branch_profit_contribution_pct"] *= 100


def build_branch_summary(rows: List[Dict[str, object]]) -> List[Dict[str, object]]:
    branch_info: Dict[str, Dict[str, object]] = defaultdict(lambda: {
        "total_products": 0,
        "total_profit": 0.0,
        "total_qty": 0.0,
        "stars_count": 0,
        "plowhorse_count": 0,
        "puzzle_count": 0,
        "dog_count": 0,
        "unclassified_count": 0,
        "stars_profit": 0.0,
        "plowhorse_profit": 0.0,
        "puzzle_profit": 0.0,
        "dog_profit": 0.0,
        "unclassified_profit": 0.0,
    })

    for row in rows:
        branch = str(row["branch"])
        quadrant = str(row.get("branch_quadrant", "unclassified"))
        profit = float(row["total_profit"])
        qty = float(row["qty"])
        info = branch_info[branch]

        info["total_products"] += 1
        info["total_profit"] += profit
        info["total_qty"] += qty

        if quadrant == "star":
            info["stars_count"] += 1
            info["stars_profit"] += profit
        elif quadrant == "plowhorse":
            info["plowhorse_count"] += 1
            info["plowhorse_profit"] += profit
        elif quadrant == "puzzle":
            info["puzzle_count"] += 1
            info["puzzle_profit"] += profit
        elif quadrant == "dog":
            info["dog_count"] += 1
            info["dog_profit"] += profit
        else:
            info["unclassified_count"] += 1
            info["unclassified_profit"] += profit

    summary_rows: List[Dict[str, object]] = []
    for branch, info in branch_info.items():
        total_profit = float(info["total_profit"])
        stars_profit_share = safe_div(float(info["stars_profit"]), total_profit)
        dog_profit_share = safe_div(float(info["dog_profit"]), total_profit)
        if stars_profit_share is not None:
            stars_profit_share *= 100
        if dog_profit_share is not None:
            dog_profit_share *= 100

        summary_rows.append({
            "branch": branch,
            "total_products": info["total_products"],
            "total_qty": round_or_none(info["total_qty"]),
            "total_profit": round_or_none(total_profit),
            "stars_count": info["stars_count"],
            "plowhorse_count": info["plowhorse_count"],
            "puzzle_count": info["puzzle_count"],
            "dog_count": info["dog_count"],
            "unclassified_count": info["unclassified_count"],
            "stars_profit": round_or_none(info["stars_profit"]),
            "plowhorse_profit": round_or_none(info["plowhorse_profit"]),
            "puzzle_profit": round_or_none(info["puzzle_profit"]),
            "dog_profit": round_or_none(info["dog_profit"]),
            "unclassified_profit": round_or_none(info["unclassified_profit"]),
            "stars_profit_share_pct": round_or_none(stars_profit_share),
            "dog_profit_share_pct": round_or_none(dog_profit_share),
        })

    summary_rows.sort(key=lambda row: row["total_profit"] if row["total_profit"] is not None else -10**18, reverse=True)
    return summary_rows


def build_menu_engineering_tables(cleaned_dir: Path) -> Tuple[List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, object]]]:
    source_path = cleaned_dir / "rep_00014_theoretical_profit_by_item_clean.csv"
    if not source_path.exists():
        raise FileNotFoundError(f"Missing cleaned file: {source_path}")

    overall_aggregate: Dict[Tuple[str, str, str], Dict[str, object]] = defaultdict(lambda: {
        "product_desc": "",
        "category": "",
        "division": "",
        "department": "",
        "qty": 0.0,
        "true_revenue": 0.0,
        "total_cost": 0.0,
        "total_profit": 0.0,
        "record_count": 0,
    })

    branch_aggregate: Dict[Tuple[str, str, str, str], Dict[str, object]] = defaultdict(lambda: {
        "branch": "",
        "product_desc": "",
        "category": "",
        "division": "",
        "department": "",
        "qty": 0.0,
        "true_revenue": 0.0,
        "total_cost": 0.0,
        "total_profit": 0.0,
        "record_count": 0,
    })

    for row in read_rows(source_path):
        if clean_text(row.get("row_type", "")) != "item":
            continue

        product = clean_text(row.get("product_desc", ""))
        category = clean_text(row.get("category", "UNKNOWN"))
        division = clean_text(row.get("division", "UNKNOWN"))
        department = clean_text(row.get("department", "UNKNOWN"))
        branch = clean_text(row.get("branch", ""))
        if not product or not branch:
            continue

        qty = to_float(row.get("qty", "")) or 0.0
        cost = to_float(row.get("total_cost", "")) or 0.0
        profit = to_float(row.get("total_profit", "")) or 0.0
        true_revenue = cost + profit

        o_key = (product, category, division)
        o = overall_aggregate[o_key]
        o["product_desc"] = product
        o["category"] = category
        o["division"] = division
        o["department"] = department
        o["qty"] += qty
        o["true_revenue"] += true_revenue
        o["total_cost"] += cost
        o["total_profit"] += profit
        o["record_count"] += 1

        b_key = (branch, product, category, division)
        b = branch_aggregate[b_key]
        b["branch"] = branch
        b["product_desc"] = product
        b["category"] = category
        b["division"] = division
        b["department"] = department
        b["qty"] += qty
        b["true_revenue"] += true_revenue
        b["total_cost"] += cost
        b["total_profit"] += profit
        b["record_count"] += 1

    overall_rows = build_base_rows(overall_aggregate)
    add_global_quadrants(overall_rows)
    overall_rows.sort(key=lambda row: float(row["total_profit"]), reverse=True)

    branch_rows = build_base_rows(branch_aggregate)
    add_branch_quadrants(branch_rows)
    branch_rows.sort(key=lambda row: (str(row["branch"]), -float(row["total_profit"])))

    branch_summary = build_branch_summary(branch_rows)
    return overall_rows, branch_rows, branch_summary


def write_csv(path: Path, rows: List[Dict[str, object]]) -> None:
    if not rows:
        raise ValueError(f"No rows to write for {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                k: round_or_none(v) if isinstance(v, float) else v
                for k, v in row.items()
            })


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[2]
    default_cleaned = repo_root / "Archive" / "Stories_data" / "cleaned"
    default_overall = repo_root / "reports" / "menu_engineering_overall.csv"
    default_branch = repo_root / "reports" / "menu_engineering_by_branch.csv"
    default_summary = repo_root / "reports" / "menu_engineering_branch_summary.csv"

    parser = argparse.ArgumentParser(description="Build menu-engineering outputs.")
    parser.add_argument("--cleaned-dir", type=Path, default=default_cleaned, help="Path to cleaned data directory.")
    parser.add_argument("--overall-output", type=Path, default=default_overall, help="Overall menu engineering CSV path.")
    parser.add_argument("--branch-output", type=Path, default=default_branch, help="Branch-level menu engineering CSV path.")
    parser.add_argument("--summary-output", type=Path, default=default_summary, help="Branch summary CSV path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    overall_rows, branch_rows, branch_summary = build_menu_engineering_tables(args.cleaned_dir)
    write_csv(args.overall_output, overall_rows)
    write_csv(args.branch_output, branch_rows)
    write_csv(args.summary_output, branch_summary)

    print(f"Overall menu table: {args.overall_output} ({len(overall_rows)} rows)")
    print(f"Branch menu table: {args.branch_output} ({len(branch_rows)} rows)")
    print(f"Branch summary table: {args.summary_output} ({len(branch_summary)} rows)")
    print("Top 5 overall stars by total profit:")
    stars = [row for row in overall_rows if row.get("quadrant") == "star"][:5]
    for row in stars:
        print(
            f"  - {row['product_desc']} [{row['category']}/{row['division']}]: "
            f"profit={round_or_none(float(row['total_profit']))}, qty={round_or_none(float(row['qty']))}"
        )


if __name__ == "__main__":
    main()
