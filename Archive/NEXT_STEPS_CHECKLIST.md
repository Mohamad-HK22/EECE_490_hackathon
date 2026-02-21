# Stories Hackathon - Concrete Next Steps

This checklist is optimized for the 12-hour challenge and your current repo state.

## 1) Target project structure

```text
/Users/mohamad22/Desktop/EECE_490_hackathon
  /Archive
    HACKATHON_BRIEF.md
    NEXT_STEPS_CHECKLIST.md
    /Stories_data
      /cleaned
      clean_stories_reports.py
      Stories_Data_EDA.ipynb
      Stories_Modeling_Preprocessing.ipynb
    /deliverables
      executive_summary.pdf
      recommendation_table.csv
  /src
    __init__.py
    config.py
    /data
      clean_reports.py
      validate_data.py
    /features
      build_feature_mart.py
    /analysis
      branch_kpi.py
      menu_engineering.py
    /modeling
      train_forecast.py
      evaluate.py
    /utils
      io.py
      metrics.py
  /app
    app.py
  /reports
    kpi_tables.csv
    model_results.json
    figures/
  /tests
    test_cleaning.py
    test_features.py
  README.md
  requirements.txt
  run_pipeline.py
```

## 2) File-by-file build checklist

## Core repo files
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/README.md`
  - Problem statement, methodology, key findings, how to run.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/requirements.txt`
  - Pin core libs (`pandas`, `numpy`, `scikit-learn`, `matplotlib`, `seaborn`, `plotly`, `jupyter`).
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/run_pipeline.py`
  - One command entrypoint that runs clean -> feature mart -> modeling -> outputs.

## Existing data pipeline (already started)
- [x] `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/Stories_data/clean_stories_reports.py`
  - Keep as raw-to-clean converter.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/data/validate_data.py`
  - Assertions: row counts, required columns, no unexpected null spikes, branch-name normalization checks.

## EDA + business insight generation
- [x] `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/Stories_data/Stories_Data_EDA.ipynb`
  - Keep for exploration and visuals.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/analysis/branch_kpi.py`
  - Produce branch-level KPIs: revenue proxy, profit, margin, YoY growth, category mix.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/analysis/menu_engineering.py`
  - Product quadrant labels (high/low volume vs high/low margin), top gainers/loss makers.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/reports/kpi_tables.csv`
  - Export summary tables used in slides/report.

## Modeling
- [x] `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/Stories_data/Stories_Modeling_Preprocessing.ipynb`
  - Use as baseline template.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/modeling/train_forecast.py`
  - Train baseline branch-month forecast model.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/modeling/evaluate.py`
  - MAE/RMSE/R2 by year and by branch; error table export.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/reports/model_results.json`
  - Save metrics + best model config.

## Feature mart
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/src/features/build_feature_mart.py`
  - Build one modeling table:
    - keys: `branch`, `year`, `month`
    - features: lag sales, rolling mean, category share, margin.
  - Save to `/Users/mohamad22/Desktop/EECE_490_hackathon/reports/feature_mart.csv`.

## Lightweight app/prototype (wow factor)
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/app/app.py`
  - Minimal interface:
    - branch selector
    - KPI cards
    - top recommendations table
    - forecast chart
  - Must run from cleaned files without hardcoded absolute paths.

## Submission deliverables
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/deliverables/executive_summary.pdf`
  - 2 pages max, CEO style.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/Archive/deliverables/recommendation_table.csv`
  - Columns: action, target, expected impact, confidence, risk, effort.

## Testing/reproducibility
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/tests/test_cleaning.py`
  - Smoke test cleaning script outputs and schemas.
- [ ] `/Users/mohamad22/Desktop/EECE_490_hackathon/tests/test_features.py`
  - Ensure feature mart columns exist and no duplicate keys.

## 3) Priority execution order (time-boxed)

## 0-2h
- [ ] Finalize and freeze cleaning + validation.

## 2-5h
- [ ] Generate branch KPI and menu engineering outputs.
- [ ] Identify 3-5 strongest insights with charts.

## 5-7h
- [ ] Build feature mart and train baseline forecast.
- [ ] Save error metrics and pick best simple model.

## 7-9h
- [ ] Implement lightweight app/prototype for reproducible decision support.

## 9-12h
- [ ] Write executive summary PDF.
- [ ] Polish README and run instructions.
- [ ] Final repo cleanup and submission check.

## 4) Final submission checklist

- [ ] Public GitHub repo link works.
- [ ] `README.md` includes problem, method, run steps, key findings.
- [ ] `requirements.txt` present.
- [ ] One-command or clear run flow exists.
- [ ] Executive summary PDF included.
- [ ] Recommendations are actionable and quantified.
- [ ] No hardcoded local paths in final scripts/app.
