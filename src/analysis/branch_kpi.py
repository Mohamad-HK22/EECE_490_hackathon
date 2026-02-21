#!/usr/bin/env python3
"""Build branch-level KPI table from cleaned Stories datasets."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple


def clean_text(value: str) -> str:
    return " ".join((value or "").strip().split())


def canonical_branch(value: str) -> str:
    return clean_text(value).lower()


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


def recommendation_tag(growth_pct: Optional[float], margin_pct: Optional[float]) -> str:
    if growth_pct is None or margin_pct is None:
        return "insufficient_history"
    if growth_pct >= 10 and margin_pct >= 70:
        return "scale_winner"
    if growth_pct < 0 and margin_pct < 68:
        return "turnaround"
    if margin_pct >= 72 and growth_pct < 5:
        return "protect_margin_drive_traffic"
    return "balanced_optimize"


def read_rows(path: Path) -> Iterable[Dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        yield from csv.DictReader(handle)


def build_branch_kpis(cleaned_dir: Path) -> List[Dict[str, object]]:
    file_00014 = cleaned_dir / "rep_00014_theoretical_profit_by_item_clean.csv"
    file_00134 = cleaned_dir / "rep_00134_comparative_monthly_sales_clean_wide.csv"
    file_00191 = cleaned_dir / "rep_00191_sales_by_items_by_group_clean.csv"
    file_00673 = cleaned_dir / "rep_00673_theoretical_profit_by_category_clean.csv"

    required = [file_00014, file_00134, file_00191, file_00673]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing cleaned files: {', '.join(missing)}")

    branch_display: Dict[str, str] = {}

    monthly_2025_total: Dict[str, float] = {}
    jan_2025: Dict[str, float] = {}
    jan_2026: Dict[str, float] = {}

    branch_cost_2025: Dict[str, float] = {}
    branch_profit_2025: Dict[str, float] = {}
    category_profit_2025: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    item_row_count: Dict[str, int] = defaultdict(int)
    item_qty_2025: Dict[str, float] = defaultdict(float)
    unique_items: Dict[str, Set[str]] = defaultdict(set)
    loss_item_count: Dict[str, int] = defaultdict(int)
    low_margin_item_count: Dict[str, int] = defaultdict(int)

    group_totals: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    group_branch_total_amount: Dict[str, float] = {}

    for row in read_rows(file_00134):
        if clean_text(row.get("row_type", "")) != "branch":
            continue
        branch = clean_text(row.get("branch", ""))
        if not branch:
            continue
        key = canonical_branch(branch)
        branch_display.setdefault(key, branch)

        year = int(float(row.get("year", "0") or 0))
        jan_value = to_float(row.get("january", ""))
        total_by_year = to_float(row.get("total_by_year", ""))
        if year == 2025:
            if jan_value is not None:
                jan_2025[key] = jan_value
            if total_by_year is not None:
                monthly_2025_total[key] = total_by_year
        elif year == 2026 and jan_value is not None:
            jan_2026[key] = jan_value

    for row in read_rows(file_00673):
        row_type = clean_text(row.get("row_type", ""))
        branch = clean_text(row.get("branch", ""))
        if not branch:
            continue
        key = canonical_branch(branch)
        branch_display.setdefault(key, branch)

        cost = to_float(row.get("total_cost", ""))
        profit = to_float(row.get("total_profit", ""))
        if row_type == "branch_total":
            if cost is not None:
                branch_cost_2025[key] = cost
            if profit is not None:
                branch_profit_2025[key] = profit
        elif row_type == "category":
            category = clean_text(row.get("category", "UNKNOWN")).upper()
            category_profit_2025[key][category] += profit or 0.0

    for row in read_rows(file_00014):
        if clean_text(row.get("row_type", "")) != "item":
            continue
        branch = clean_text(row.get("branch", ""))
        if not branch:
            continue
        key = canonical_branch(branch)
        branch_display.setdefault(key, branch)

        item_row_count[key] += 1
        qty = to_float(row.get("qty", "")) or 0.0
        item_qty_2025[key] += qty

        product = clean_text(row.get("product_desc", ""))
        if product:
            unique_items[key].add(product)

        total_profit = to_float(row.get("total_profit", ""))
        if total_profit is not None and total_profit < 0:
            loss_item_count[key] += 1

        margin_pct = to_float(row.get("total_profit_pct", ""))
        if margin_pct is not None and margin_pct < 20:
            low_margin_item_count[key] += 1

    for row in read_rows(file_00191):
        row_type = clean_text(row.get("row_type", ""))
        branch = clean_text(row.get("branch", ""))
        if not branch:
            continue
        key = canonical_branch(branch)
        branch_display.setdefault(key, branch)

        amount = to_float(row.get("total_amount", ""))
        if row_type == "group_total":
            group_name = clean_text(row.get("group", "")).upper()
            if group_name and amount is not None:
                group_totals[key][group_name] += amount
        elif row_type == "branch_total" and amount is not None:
            group_branch_total_amount[key] = amount

    all_branch_keys = sorted(branch_display.keys())
    rows: List[Dict[str, object]] = []
    for key in all_branch_keys:
        branch = branch_display[key]

        monthly_total = monthly_2025_total.get(key)
        jan25 = jan_2025.get(key)
        jan26 = jan_2026.get(key)
        jan_growth_pct = None
        if jan25 not in (None, 0) and jan26 is not None:
            jan_growth_pct = ((jan26 - jan25) / jan25) * 100

        cost = branch_cost_2025.get(key)
        profit = branch_profit_2025.get(key)
        true_revenue = None
        if cost is not None and profit is not None:
            true_revenue = cost + profit
        margin_pct = safe_div(profit, true_revenue)
        if margin_pct is not None:
            margin_pct *= 100

        bev_profit = category_profit_2025[key].get("BEVERAGES", 0.0)
        food_profit = category_profit_2025[key].get("FOOD", 0.0)
        other_profit = sum(v for c, v in category_profit_2025[key].items() if c not in {"BEVERAGES", "FOOD"})
        category_profit_sum = bev_profit + food_profit + other_profit

        bev_share_pct = safe_div(bev_profit, category_profit_sum)
        food_share_pct = safe_div(food_profit, category_profit_sum)
        other_share_pct = safe_div(other_profit, category_profit_sum)
        if bev_share_pct is not None:
            bev_share_pct *= 100
        if food_share_pct is not None:
            food_share_pct *= 100
        if other_share_pct is not None:
            other_share_pct *= 100

        top_group = None
        top_group_amount = None
        if group_totals[key]:
            top_group, top_group_amount = max(group_totals[key].items(), key=lambda item: item[1])

        group_total_amount = group_branch_total_amount.get(key)
        if group_total_amount is None and group_totals[key]:
            # Fallback for cases where branch_total rows were dropped during cleaning.
            group_total_amount = sum(group_totals[key].values())

        top_group_share_pct = None
        if top_group_amount is not None:
            top_group_share_pct = safe_div(top_group_amount, group_total_amount)
            if top_group_share_pct is not None:
                top_group_share_pct *= 100

        item_count = item_row_count[key]
        unique_count = len(unique_items[key])
        loss_count = loss_item_count[key]
        low_margin_count = low_margin_item_count[key]

        loss_share_pct = safe_div(float(loss_count), float(item_count) if item_count else None)
        low_margin_share_pct = safe_div(float(low_margin_count), float(item_count) if item_count else None)
        if loss_share_pct is not None:
            loss_share_pct *= 100
        if low_margin_share_pct is not None:
            low_margin_share_pct *= 100

        rows.append(
            {
                "branch": branch,
                "revenue_proxy_2025": round_or_none(monthly_total),
                "revenue_jan_2025": round_or_none(jan25),
                "revenue_jan_2026": round_or_none(jan26),
                "jan_yoy_growth_pct": round_or_none(jan_growth_pct),
                "true_revenue_2025": round_or_none(true_revenue),
                "total_cost_2025": round_or_none(cost),
                "total_profit_2025": round_or_none(profit),
                "profit_margin_pct_2025": round_or_none(margin_pct),
                "beverages_profit_2025": round_or_none(bev_profit),
                "food_profit_2025": round_or_none(food_profit),
                "other_profit_2025": round_or_none(other_profit),
                "beverages_profit_share_pct": round_or_none(bev_share_pct),
                "food_profit_share_pct": round_or_none(food_share_pct),
                "other_profit_share_pct": round_or_none(other_share_pct),
                "items_sold_qty_2025": round_or_none(item_qty_2025.get(key, 0.0)),
                "item_row_count": item_count,
                "unique_item_count": unique_count,
                "loss_making_item_count": loss_count,
                "loss_making_item_share_pct": round_or_none(loss_share_pct),
                "low_margin_item_count": low_margin_count,
                "low_margin_item_share_pct": round_or_none(low_margin_share_pct),
                "group_total_amount_2025": round_or_none(group_total_amount),
                "top_group_by_sales": top_group,
                "top_group_sales_amount": round_or_none(top_group_amount),
                "top_group_sales_share_pct": round_or_none(top_group_share_pct),
                "recommendation_tag": recommendation_tag(jan_growth_pct, margin_pct),
            }
        )

    # Add ranks for easier branch comparison.
    def add_rank(metric: str, rank_col: str, reverse: bool = True) -> None:
        valid = [(i, rows[i][metric]) for i in range(len(rows)) if rows[i][metric] is not None]
        sorted_rows = sorted(valid, key=lambda item: item[1], reverse=reverse)
        for rank, (idx, _) in enumerate(sorted_rows, start=1):
            rows[idx][rank_col] = rank
        for idx in range(len(rows)):
            rows[idx].setdefault(rank_col, None)

    add_rank("total_profit_2025", "rank_total_profit_2025", reverse=True)
    add_rank("profit_margin_pct_2025", "rank_profit_margin_2025", reverse=True)
    add_rank("jan_yoy_growth_pct", "rank_jan_yoy_growth", reverse=True)

    rows.sort(key=lambda row: (row["rank_total_profit_2025"] is None, row["rank_total_profit_2025"] or 9999))
    return rows


def write_csv(path: Path, rows: List[Dict[str, object]]) -> None:
    if not rows:
        raise ValueError("No KPI rows generated.")
    fieldnames = list(rows[0].keys())
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[2]
    default_cleaned = repo_root / "Archive" / "Stories_data" / "cleaned"
    default_output = repo_root / "reports" / "branch_kpis.csv"

    parser = argparse.ArgumentParser(description="Build branch-level KPI table.")
    parser.add_argument("--cleaned-dir", type=Path, default=default_cleaned, help="Path to cleaned data directory.")
    parser.add_argument("--output", type=Path, default=default_output, help="Output CSV path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = build_branch_kpis(args.cleaned_dir)
    write_csv(args.output, rows)

    print(f"KPI table generated: {args.output}")
    print(f"Branches: {len(rows)}")
    print("Top 5 branches by total profit (2025):")
    for row in rows[:5]:
        print(
            f"  - {row['branch']}: profit={row['total_profit_2025']}, "
            f"margin={row['profit_margin_pct_2025']}%, jan_yoy={row['jan_yoy_growth_pct']}%"
        )


if __name__ == "__main__":
    main()
