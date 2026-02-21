#!/usr/bin/env python3
"""Clean Stories POS report exports into analysis-ready CSV files."""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "cleaned"

RAW_FILES = {
    "rep_00014": BASE_DIR / "rep_s_00014_SMRY.csv",
    "rep_00134": BASE_DIR / "REP_S_00134_SMRY.csv",
    "rep_00191": BASE_DIR / "rep_s_00191_SMRY-3.csv",
    "rep_00673": BASE_DIR / "rep_s_00673_SMRY.csv",
}

DATE_RE = re.compile(r"^\d{1,2}-[A-Za-z]{3}-\d{2,4}$")
SPACE_RE = re.compile(r"\s+")

SALES_KEY_ORDER = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
    "total_by_year",
]

HEADER_TO_SALES_KEY = {
    "january": "january",
    "february": "february",
    "march": "march",
    "april": "april",
    "may": "may",
    "june": "june",
    "july": "july",
    "august": "august",
    "september": "september",
    "october": "october",
    "november": "november",
    "december": "december",
    "total by year": "total_by_year",
}

SALES_MONTH_NUMBER = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "total_by_year": None,
}


def clean_cell(value: str) -> str:
    return value.strip()


def compact_spaces(value: str) -> str:
    return SPACE_RE.sub(" ", value.strip())


def to_float(value: str) -> Optional[float]:
    value = compact_spaces(value)
    if not value:
        return None
    value = value.replace(",", "")
    try:
        return float(value)
    except ValueError:
        return None


def pad_row(row: List[str], width: int) -> List[str]:
    if len(row) >= width:
        return row
    return row + [""] * (width - len(row))


def has_any_text(row: Iterable[str]) -> bool:
    return any(compact_spaces(cell) for cell in row)


def is_date_token(token: str) -> bool:
    return bool(DATE_RE.match(token))


def normalize_sales_header(token: str) -> Optional[str]:
    normalized = compact_spaces(token).lower()
    if not normalized:
        return None
    if normalized.startswith("total by year"):
        return "total_by_year"
    return HEADER_TO_SALES_KEY.get(normalized)


def parse_profit_metrics(row: List[str]) -> Dict[str, Optional[float]]:
    row = pad_row(row, 10)
    return {
        "qty": to_float(row[1]),
        "total_price": to_float(row[2]),
        "total_cost": to_float(row[4]),
        "total_cost_pct": to_float(row[5]),
        "total_profit": to_float(row[6]),
        "total_profit_pct": to_float(row[8]),
    }


def read_rows(path: Path) -> List[List[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        return [[clean_cell(cell) for cell in row] for row in reader]


def write_csv(path: Path, rows: List[Dict[str, object]], fieldnames: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_rep_00014(rows: List[List[str]]) -> List[Dict[str, object]]:
    records: List[Dict[str, object]] = []
    branch: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    division: Optional[str] = None

    for raw_row in rows:
        row = pad_row(raw_row, 10)
        c0 = row[0]
        c0_lower = c0.lower()

        if not has_any_text(row):
            continue
        if c0 in {"Stories", "Theoretical Profit By Item", "Product Desc"}:
            continue
        if is_date_token(c0):
            continue
        if c0.startswith("REP_S_"):
            continue
        if "copyright" in row[1].lower() or "omegapos.com" in ",".join(row).lower():
            continue

        if c0.startswith("Stories") and c0 != "Stories" and all(not cell for cell in row[1:]):
            branch = c0
            department = None
            category = None
            division = None
            continue

        metrics = parse_profit_metrics(row)
        has_numeric = any(value is not None for value in metrics.values())

        if c0_lower.startswith("total by division"):
            records.append(
                {
                    "source_file": "rep_s_00014_SMRY.csv",
                    "row_type": "division_total",
                    "branch": branch,
                    "department": department,
                    "category": category,
                    "division": division,
                    "product_desc": c0,
                    **metrics,
                }
            )
            division = None
            continue

        if c0_lower.startswith("total by category"):
            records.append(
                {
                    "source_file": "rep_s_00014_SMRY.csv",
                    "row_type": "category_total",
                    "branch": branch,
                    "department": department,
                    "category": category,
                    "division": None,
                    "product_desc": c0,
                    **metrics,
                }
            )
            category = None
            division = None
            continue

        if c0_lower.startswith("total by department"):
            records.append(
                {
                    "source_file": "rep_s_00014_SMRY.csv",
                    "row_type": "department_total",
                    "branch": branch,
                    "department": department,
                    "category": None,
                    "division": None,
                    "product_desc": c0,
                    **metrics,
                }
            )
            department = None
            category = None
            division = None
            continue

        if c0_lower.startswith("total by branch"):
            records.append(
                {
                    "source_file": "rep_s_00014_SMRY.csv",
                    "row_type": "branch_total",
                    "branch": branch,
                    "department": None,
                    "category": None,
                    "division": None,
                    "product_desc": c0,
                    **metrics,
                }
            )
            department = None
            category = None
            division = None
            continue

        if has_numeric:
            records.append(
                {
                    "source_file": "rep_s_00014_SMRY.csv",
                    "row_type": "item",
                    "branch": branch,
                    "department": department,
                    "category": category,
                    "division": division,
                    "product_desc": c0,
                    **metrics,
                }
            )
            continue

        if department is None:
            department = c0
        elif category is None:
            category = c0
        else:
            division = c0

    return records


def parse_rep_00191(rows: List[List[str]]) -> List[Dict[str, object]]:
    records: List[Dict[str, object]] = []
    branch: Optional[str] = None
    division: Optional[str] = None
    group: Optional[str] = None

    for raw_row in rows:
        row = pad_row(raw_row, 5)
        c0 = row[0]
        c0_lower = c0.lower()

        if not has_any_text(row):
            continue
        if c0 in {"Stories", "Sales by Items By Group", "Description"}:
            continue
        if is_date_token(c0):
            continue
        if c0.startswith("REP_S_") or "omegapos.com" in ",".join(row).lower():
            continue

        if c0.startswith("Branch:"):
            branch = c0.split(":", 1)[1].strip()
            division = None
            group = None
            continue

        if c0.startswith("Division:"):
            division = c0.split(":", 1)[1].strip()
            group = None
            continue

        if c0.startswith("Group:"):
            group = c0.split(":", 1)[1].strip()
            continue

        qty = to_float(row[2])
        total_amount = to_float(row[3])

        if c0_lower.startswith("total by group:"):
            group_name = c0.split(":", 1)[1].strip() if ":" in c0 else group
            records.append(
                {
                    "source_file": "rep_s_00191_SMRY-3.csv",
                    "row_type": "group_total",
                    "branch": branch,
                    "division": division,
                    "group": group_name or group,
                    "description": c0,
                    "barcode": None,
                    "qty": qty,
                    "total_amount": total_amount,
                }
            )
            continue

        if c0_lower.startswith("total by division:"):
            division_name = c0.split(":", 1)[1].strip() if ":" in c0 else division
            records.append(
                {
                    "source_file": "rep_s_00191_SMRY-3.csv",
                    "row_type": "division_total",
                    "branch": branch,
                    "division": division_name or division,
                    "group": None,
                    "description": c0,
                    "barcode": None,
                    "qty": qty,
                    "total_amount": total_amount,
                }
            )
            division = None
            group = None
            continue

        if c0_lower.startswith("total by branch:"):
            parsed_branch = c0.split(":", 1)[1].strip() if ":" in c0 else branch
            records.append(
                {
                    "source_file": "rep_s_00191_SMRY-3.csv",
                    "row_type": "branch_total",
                    "branch": parsed_branch or branch,
                    "division": None,
                    "group": None,
                    "description": c0,
                    "barcode": None,
                    "qty": qty,
                    "total_amount": total_amount,
                }
            )
            branch = parsed_branch or branch
            division = None
            group = None
            continue

        if qty is None and total_amount is None:
            continue

        records.append(
            {
                "source_file": "rep_s_00191_SMRY-3.csv",
                "row_type": "item",
                "branch": branch,
                "division": division,
                "group": group,
                "description": c0,
                "barcode": row[1] or None,
                "qty": qty,
                "total_amount": total_amount,
            }
        )

    return records


def parse_rep_00673(rows: List[List[str]]) -> List[Dict[str, object]]:
    records: List[Dict[str, object]] = []
    branch: Optional[str] = None

    for raw_row in rows:
        row = pad_row(raw_row, 10)
        c0 = row[0]
        c0_lower = c0.lower()

        if not has_any_text(row):
            continue
        if c0 in {"Stories", "Theoretical Profit By Category", "Category"}:
            continue
        if is_date_token(c0):
            continue
        if c0.startswith("REP_S_"):
            continue
        if "copyright" in row[1].lower() or "omegapos.com" in ",".join(row).lower():
            continue

        if c0.startswith("Stories") and c0 != "Stories" and all(not cell for cell in row[1:]):
            branch = c0
            continue

        metrics = parse_profit_metrics(row)
        has_numeric = any(value is not None for value in metrics.values())
        if not has_numeric:
            continue

        if c0_lower.startswith("total by branch"):
            records.append(
                {
                    "source_file": "rep_s_00673_SMRY.csv",
                    "row_type": "branch_total",
                    "branch": branch,
                    "category": "Total By Branch",
                    **metrics,
                }
            )
            continue

        records.append(
            {
                "source_file": "rep_s_00673_SMRY.csv",
                "row_type": "category",
                "branch": branch,
                "category": c0,
                **metrics,
            }
        )

    return records


def parse_rep_00134(
    rows: List[List[str]],
) -> Tuple[List[Dict[str, object]], List[Dict[str, object]], List[Dict[str, object]]]:
    partial_rows: List[Dict[str, object]] = []
    merge_conflicts: List[Dict[str, object]] = []

    current_year: Optional[int] = None
    active_metric_cols: Dict[int, str] = {}

    for raw_row in rows:
        row = [compact_spaces(cell) for cell in raw_row]
        if not has_any_text(row):
            continue

        c0 = row[0] if len(row) > 0 else ""
        c1 = row[1] if len(row) > 1 else ""

        if c0 in {"Stories", "Comparative Monthly Sales"}:
            continue
        if is_date_token(c0):
            continue
        if c0.startswith("REP_S_"):
            continue

        candidate_metrics: Dict[int, str] = {}
        for idx, token in enumerate(row):
            key = normalize_sales_header(token)
            if key:
                candidate_metrics[idx] = key

        if len(candidate_metrics) >= 3:
            active_metric_cols = candidate_metrics
            continue

        if c0.isdigit():
            current_year = int(c0)

        if current_year is None or not active_metric_cols:
            continue
        if not c1:
            continue

        branch = c1
        if branch == "Year: 2026,2025":
            continue

        values = {key: None for key in SALES_KEY_ORDER}
        has_numeric_value = False
        for idx, key in active_metric_cols.items():
            if idx >= len(row):
                continue
            value = to_float(row[idx])
            values[key] = value
            if value is not None:
                has_numeric_value = True

        if not has_numeric_value:
            continue

        partial_rows.append(
            {
                "source_file": "REP_S_00134_SMRY.csv",
                "row_type": "grand_total" if branch.lower() == "total" else "branch",
                "year": current_year,
                "branch": branch,
                **values,
            }
        )

    merged_rows: Dict[Tuple[int, str, str], Dict[str, object]] = {}
    for row in partial_rows:
        key = (row["year"], row["branch"], row["row_type"])
        if key not in merged_rows:
            merged_rows[key] = {
                "source_file": row["source_file"],
                "row_type": row["row_type"],
                "year": row["year"],
                "branch": row["branch"],
                **{col: None for col in SALES_KEY_ORDER},
            }

        for col in SALES_KEY_ORDER:
            current_value = merged_rows[key][col]
            new_value = row[col]
            if new_value is None:
                continue
            if current_value is None:
                merged_rows[key][col] = new_value
                continue
            if abs(float(current_value) - float(new_value)) > 0.01:
                merge_conflicts.append(
                    {
                        "year": row["year"],
                        "branch": row["branch"],
                        "metric": col,
                        "first_value": current_value,
                        "conflicting_value": new_value,
                    }
                )

    wide_rows = list(merged_rows.values())
    wide_rows.sort(key=lambda item: (int(item["year"]), item["row_type"], item["branch"].lower()))

    long_rows: List[Dict[str, object]] = []
    for row in wide_rows:
        for metric in SALES_KEY_ORDER:
            value = row[metric]
            if value is None:
                continue
            month_number = SALES_MONTH_NUMBER[metric]
            long_rows.append(
                {
                    "source_file": row["source_file"],
                    "row_type": row["row_type"],
                    "year": row["year"],
                    "branch": row["branch"],
                    "period": metric,
                    "period_type": "year_total" if metric == "total_by_year" else "month",
                    "month_number": month_number,
                    "sales_amount": value,
                }
            )

    return wide_rows, long_rows, merge_conflicts


def quality_check_rep_00673(records: List[Dict[str, object]]) -> List[Dict[str, object]]:
    detail_sums: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    detail_counts: Dict[str, int] = defaultdict(int)
    branch_totals: Dict[str, Dict[str, object]] = {}
    fields = ["qty", "total_price", "total_cost", "total_profit"]

    for row in records:
        branch = str(row.get("branch") or "").strip()
        if not branch:
            continue
        if row["row_type"] == "category":
            detail_counts[branch] += 1
            for field in fields:
                value = row.get(field)
                if value is not None:
                    detail_sums[branch][field] += float(value)
        elif row["row_type"] == "branch_total":
            branch_totals[branch] = row

    mismatches: List[Dict[str, object]] = []
    for branch, total_row in branch_totals.items():
        if detail_counts[branch] == 0:
            continue
        for field in fields:
            total_value = total_row.get(field)
            summed_value = detail_sums[branch].get(field)
            if total_value is None:
                continue
            difference = float(total_value) - float(summed_value)
            if abs(difference) > 1.0:
                mismatches.append(
                    {
                        "branch": branch,
                        "metric": field,
                        "branch_total": total_value,
                        "category_sum": round(summed_value, 2),
                        "difference": round(difference, 2),
                    }
                )

    return mismatches


def quality_check_rep_00134(records: List[Dict[str, object]]) -> List[Dict[str, object]]:
    mismatches: List[Dict[str, object]] = []
    month_keys = SALES_KEY_ORDER[:-1]

    for row in records:
        if row["row_type"] != "branch":
            continue
        total_by_year = row.get("total_by_year")
        if total_by_year is None:
            continue
        month_sum = 0.0
        has_any_month = False
        for month in month_keys:
            value = row.get(month)
            if value is None:
                continue
            has_any_month = True
            month_sum += float(value)
        if not has_any_month:
            continue
        difference = float(total_by_year) - month_sum
        if abs(difference) > 1.0:
            mismatches.append(
                {
                    "year": row["year"],
                    "branch": row["branch"],
                    "total_by_year": total_by_year,
                    "sum_of_months": round(month_sum, 2),
                    "difference": round(difference, 2),
                }
            )

    return mismatches


def count_by_row_type(rows: List[Dict[str, object]]) -> Dict[str, int]:
    counts: Dict[str, int] = defaultdict(int)
    for row in rows:
        counts[str(row["row_type"])] += 1
    return dict(sorted(counts.items()))


def ensure_files_exist() -> None:
    missing = [str(path) for path in RAW_FILES.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing input files: {', '.join(missing)}")


def main() -> None:
    ensure_files_exist()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows_00014 = read_rows(RAW_FILES["rep_00014"])
    rows_00134 = read_rows(RAW_FILES["rep_00134"])
    rows_00191 = read_rows(RAW_FILES["rep_00191"])
    rows_00673 = read_rows(RAW_FILES["rep_00673"])

    clean_00014 = parse_rep_00014(rows_00014)
    clean_00191 = parse_rep_00191(rows_00191)
    clean_00673 = parse_rep_00673(rows_00673)
    clean_00134_wide, clean_00134_long, merge_conflicts_00134 = parse_rep_00134(rows_00134)

    write_csv(
        OUTPUT_DIR / "rep_00014_theoretical_profit_by_item_clean.csv",
        clean_00014,
        [
            "source_file",
            "row_type",
            "branch",
            "department",
            "category",
            "division",
            "product_desc",
            "qty",
            "total_price",
            "total_cost",
            "total_cost_pct",
            "total_profit",
            "total_profit_pct",
        ],
    )

    write_csv(
        OUTPUT_DIR / "rep_00191_sales_by_items_by_group_clean.csv",
        clean_00191,
        [
            "source_file",
            "row_type",
            "branch",
            "division",
            "group",
            "description",
            "barcode",
            "qty",
            "total_amount",
        ],
    )

    write_csv(
        OUTPUT_DIR / "rep_00673_theoretical_profit_by_category_clean.csv",
        clean_00673,
        [
            "source_file",
            "row_type",
            "branch",
            "category",
            "qty",
            "total_price",
            "total_cost",
            "total_cost_pct",
            "total_profit",
            "total_profit_pct",
        ],
    )

    write_csv(
        OUTPUT_DIR / "rep_00134_comparative_monthly_sales_clean_wide.csv",
        clean_00134_wide,
        ["source_file", "row_type", "year", "branch", *SALES_KEY_ORDER],
    )

    write_csv(
        OUTPUT_DIR / "rep_00134_comparative_monthly_sales_clean_long.csv",
        clean_00134_long,
        [
            "source_file",
            "row_type",
            "year",
            "branch",
            "period",
            "period_type",
            "month_number",
            "sales_amount",
        ],
    )

    report = {
        "input_files": {name: str(path) for name, path in RAW_FILES.items()},
        "output_files": {
            "rep_00014": str(OUTPUT_DIR / "rep_00014_theoretical_profit_by_item_clean.csv"),
            "rep_00191": str(OUTPUT_DIR / "rep_00191_sales_by_items_by_group_clean.csv"),
            "rep_00673": str(OUTPUT_DIR / "rep_00673_theoretical_profit_by_category_clean.csv"),
            "rep_00134_wide": str(OUTPUT_DIR / "rep_00134_comparative_monthly_sales_clean_wide.csv"),
            "rep_00134_long": str(OUTPUT_DIR / "rep_00134_comparative_monthly_sales_clean_long.csv"),
        },
        "row_counts": {
            "rep_00014_raw_rows": len(rows_00014),
            "rep_00191_raw_rows": len(rows_00191),
            "rep_00673_raw_rows": len(rows_00673),
            "rep_00134_raw_rows": len(rows_00134),
            "rep_00014_clean_rows": len(clean_00014),
            "rep_00191_clean_rows": len(clean_00191),
            "rep_00673_clean_rows": len(clean_00673),
            "rep_00134_wide_clean_rows": len(clean_00134_wide),
            "rep_00134_long_clean_rows": len(clean_00134_long),
        },
        "row_type_counts": {
            "rep_00014": count_by_row_type(clean_00014),
            "rep_00191": count_by_row_type(clean_00191),
            "rep_00673": count_by_row_type(clean_00673),
            "rep_00134_wide": count_by_row_type(clean_00134_wide),
        },
        "quality_checks": {
            "rep_00673_branch_total_mismatches": quality_check_rep_00673(clean_00673),
            "rep_00134_total_by_year_mismatches": quality_check_rep_00134(clean_00134_wide),
            "rep_00134_merge_conflicts": merge_conflicts_00134,
        },
    }

    report_path = OUTPUT_DIR / "cleaning_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("Cleaning completed.")
    print(f"Output folder: {OUTPUT_DIR}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
