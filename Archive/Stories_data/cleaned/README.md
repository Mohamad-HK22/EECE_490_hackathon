# Cleaned Stories Reports

This folder contains cleaned outputs generated from the 4 raw report exports in `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/Stories_data`.

## Per-file summary

### `rep_s_00014_SMRY.csv` -> `rep_00014_theoretical_profit_by_item_clean.csv`
- Removed report/title/page/footer rows.
- Parsed hierarchy into columns: `branch`, `department`, `category`, `division`.
- Converted numeric fields to floats: `qty`, `total_price`, `total_cost`, `total_cost_pct`, `total_profit`, `total_profit_pct`.
- Added `row_type` to distinguish `item` vs totals (`division_total`, `category_total`, `department_total`, `branch_total`).

### `rep_s_00191_SMRY-3.csv` -> `rep_00191_sales_by_items_by_group_clean.csv`
- Removed report/title/page/footer rows.
- Parsed hierarchy into columns: `branch`, `division`, `group`.
- Converted `qty` and `total_amount` to floats.
- Preserved detail rows and totals using `row_type` (`item`, `group_total`, `division_total`, `branch_total`).

### `rep_s_00673_SMRY.csv` -> `rep_00673_theoretical_profit_by_category_clean.csv`
- Removed report/title/page/footer rows.
- Parsed `branch` sections and category rows.
- Converted numeric fields to floats (`qty`, `total_price`, `total_cost`, `total_cost_pct`, `total_profit`, `total_profit_pct`).
- Added `row_type` (`category`, `branch_total`).

### `REP_S_00134_SMRY.csv` -> monthly sales outputs
- `rep_00134_comparative_monthly_sales_clean_wide.csv`: one row per `(year, branch)` with monthly columns + `total_by_year`.
- `rep_00134_comparative_monthly_sales_clean_long.csv`: normalized format with `period`, `period_type`, `month_number`, `sales_amount`.
- Removed repeated header blocks, parsed dynamic month columns, merged split blocks safely.

## Quality checks output

See `cleaning_report.json` for:
- Row counts before/after cleaning.
- Row-type distributions.
- Validation checks (including flagged `rep_00673` branch/category `total_price` mismatches).
