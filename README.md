# Stories Profit Genome

**ML-powered profit intelligence dashboard for Stories Coffee**
React + Node.js · 25 branches · 504 products · Real POS data

---

## Quick Start

```bash
npm run install:all
npm run dev
```

- Backend API: http://localhost:4000
- Frontend: http://localhost:3000

For production:

```bash
npm run build
npm start
```

---

## ML Profit Simulator — How It Works

### The problem this solves

The simulator answers one question: **if we close operational gaps that the data says exist, how much extra profit do we get?**

The word "operational gaps" is key. These are not invented scenarios. They are specific, named inefficiencies found in the actual POS data — a branch charging less than the network for the same product, a product absent from branches it should be in, a branch earning lower margin than a model trained on 11,230 data points says it should earn.

---

### Why it is ML and not rule-based

A rule-based simulator would look like this:

```
impact = profit_pool × lever_percentage × hardcoded_factor
```

You pick the pool by hand, you pick the factor by hand, and you get a number that reflects your editorial judgment about what matters. This is what the first version of this simulator did.

The ML simulator replaces the critical parts of that formula with outputs from trained models:

**The pool is not chosen by hand.** For the margin gap lever, the pool is the sum of `(predicted_margin - actual_margin) × revenue` across every branch×product pair where the model predicts a higher margin than is currently achieved. That number — 5.28M LBP — is not an estimate. It is what a Random Forest with R²=0.855 says is structurally underperforming given everything else it has learned about the data.

**The specific items are not chosen by hand.** The Actions page shows you exactly which branch×product pairs the model flagged, ranked by uplift potential. You can hand that table to an operations manager. The model decided which rows appear there, not an analyst.

For the price and availability levers, the pools are also data-derived. Price anomalies are computed by finding every branch where the unit price for a given SKU sits below the network p25, and computing the revenue gap to p75. Availability gaps are computed by predicting how much profit a product would generate at a branch it is currently not sold at, weighted by that branch's total revenue.

---

### The four models and what they each do

**Model 1 — Random Forest margin predictor**

Trained on: 11,230 rows from `profit_by_item.csv`
Features: branch (encoded), product (encoded), division (encoded), category (encoded), unit price, quantity
Target: profit margin (total_profit / total_price), clipped to [-0.5, 1.0]
Accuracy: R² = 0.855 ± 0.028 (5-fold cross-validation)
Top feature: unit_price at 50.8% importance

This tells you that margin variance across the network is driven primarily by pricing differences, not by which branch a product is sold at. The branch identity contributes only 0.09% of the model's explanatory power.

After training, the model predicts what margin every branch×product pair *should* earn. The difference between that prediction and the actual margin is the residual. Positive residuals (model predicts higher than actual) are underperforming pairs. These are ranked and stored.

**Model 2 — KMeans branch clustering**

Trained on: 25 branches × 33 division profit mix vectors (each branch expressed as % of profit from each division, not absolute values)
Clusters: k=4
Best cluster: jbeil branch at 75.5% average margin
Pool: 8.96M LBP gap if all branches matched the best cluster's margin

The model finds that the best-performing cluster over-indexes on Grab&Go Beverages, Sandwiches, Healthy Section, and Croissant, and under-indexes on Cold Bar and Frozen Yoghurt. Branches in lower-margin clusters can close part of the gap by shifting their product mix toward those divisions.

**Model 3 — Cross-branch price anomaly detection**

For each SKU sold across multiple branches, computes the network p25 and p75 unit price. Branches below p25 are flagged. Profit gain is calculated as:

```
qty × (p75 − actual_price) × (1 − cost_ratio) × 0.85
```

The 0.85 is a volume-loss haircut — the assumption that raising price to p75 will cause some customers to stop buying that item. 266 branch×product pairs are flagged. Total pool: 7.70M LBP.

**Model 4 — Availability gap regression**

For products sold in fewer than 25 branches, predicts expected profit at missing branches. The prediction is weighted by the missing branches' total revenue relative to the network average — a larger branch gets a higher expected profit assigned. This is not a trained supervised model in the same sense as the Random Forest. It is a structured estimation using branch size as a proxy for demand.

---

### The conversion factors

Each lever in the simulator has a conversion factor applied on top of the pool:

| Lever | Pool | Conversion | Rationale |
|---|---|---|---|
| Margin Gap Closure | 5.28M LBP | 0.45 | Not all residuals are operationally recoverable in one period |
| Branch Mix Shift | 8.96M LBP | 0.30 | Restructuring product mix takes time and depends on supply |
| Price Standardisation | 7.70M LBP | 0.60 | Price changes are directly implementable with low friction |
| Availability Rollout | 4.55M LBP | 0.50 | Depends on supply chain and menu rollout timelines |

These factors are editorial — they represent judgment about execution difficulty, not statistical outputs. A proper calibration would use held-out error rates from a branch-level test set to derive them empirically. That test set does not exist in this version.

---

### Why there is no train/test split

Standard ML practice is to hold out a portion of data before training and evaluate the model on it after. We did not do this, for a specific reason rooted in the data structure.

The dataset has 11,230 rows but only 25 unique branches. A random 80/20 split would put rows from all 25 branches in both train and test sets. The model would then be evaluated on rows from branches it has already seen — which is not the hard problem. The hard problem is: **can the model predict what a product would earn at a branch it has never seen?** That is what the availability rollout lever depends on.

To test that properly, you would need to hold out entire branches — train on 20, test on 5 — and measure prediction error on the 5 unseen branches. With only 25 branches total, holding out 5 (20% of branches) leaves the training set with 20 branches and ~8,984 rows. That is a reasonable sample, but the test set becomes very small per branch (roughly 450 rows across 5 branches) and the variance in the held-out R² would be high.

Given those constraints, we used 5-fold **cross-validation** instead. This is not equivalent to a train/test split but it is a legitimate held-out accuracy estimate — the 0.855 R² is not training accuracy, it is the average score on data the model had not seen during that fold's training run. The ±0.028 standard deviation across folds confirms the model is stable.

The honest caveat is that because folds were split at the row level rather than the branch level, each fold still contained rows from all 25 branches during training. The model gets partial credit for having seen other rows from the same branch, which inflates the R² relative to a true branch-holdout evaluation. The conversion factors exist partly to absorb this optimism — they reduce the theoretical pool to a more conservative realizable estimate.

---

### What would make it more rigorous

1. **Branch-level holdout.** Hold out 5 complete branches, train on 20, evaluate on the 5. The resulting error rate on unseen branches would directly calibrate the conversion factor for the margin gap lever.

2. **Baseline comparison.** Compare the Random Forest against a naive baseline — for example, predicting the division average margin for every row. If that baseline achieves R²=0.80, the RF is only adding 5.5 percentage points of explanatory power beyond a simple lookup table.

3. **Temporal holdout.** If daily or weekly item-level sales data becomes available, a time-based split (train on Jan–Oct, test on Nov–Dec) would be the most realistic evaluation — the model would be tested on future data it has never seen.

---

## Files

```
stories-profit-genome/
├── backend/
│   ├── data/
│   │   ├── profit_by_item.csv          ← 13,143 rows, source of truth for all models
│   │   ├── monthly_sales_long.csv      ← branch-level monthly revenue
│   │   ├── monthly_sales_wide.csv      ← same data, wide format
│   │   ├── sales_by_group.csv          ← product group aggregates
│   │   ├── profit_by_category.csv      ← category totals per branch
│   │   └── ml/                         ← pre-computed ML artifacts (JSON)
│   │       ├── metadata.json           ← model R², pool sizes, feature importances
│   │       ├── margin_residuals.json   ← top 50 RF underperformer pairs
│   │       ├── branch_clusters.json    ← KMeans cluster per branch + gap LBP
│   │       ├── cluster_summary.json    ← 4 cluster centroids
│   │       ├── price_anomalies.json    ← 50 underpriced branch×SKU pairs
│   │       └── availability_gaps.json  ← 50 products missing from branches
│   ├── routes/
│   │   ├── ml.js                       ← /api/ml/* endpoints (reads JSON artifacts)
│   │   ├── actions.js                  ← /api/actions/* (menu engineering matrix)
│   │   ├── kpi.js
│   │   ├── branches.js
│   │   ├── products.js
│   │   └── monthly.js
│   ├── utils/csvLoader.js
│   └── server.js
├── frontend/src/
│   ├── pages/
│   │   ├── Simulator.js                ← 4 ML levers, calls /api/ml/simulate
│   │   ├── Actions.js                  ← 5 tabs, shows raw ML tables
│   │   ├── Executive.js                ← ML strip + KPI + recommendations
│   │   ├── WhatChanged.js
│   │   ├── GroupDNA.js
│   │   └── Reports.js
│   ├── utils/api.js                    ← all fetch calls incl. mlSimulate, mlMetadata
│   ├── hooks/useData.js
│   └── App.js
└── package.json
```

---

## API Endpoints

### Standard

| Method | Path | Description |
|---|---|---|
| GET | `/api/kpi/summary` | Global KPI metrics |
| GET | `/api/branches` | All branches with totals |
| GET | `/api/products/top` | Top products by profit |
| GET | `/api/products/loss-leaders` | Negative-profit items |
| GET | `/api/monthly/trend` | Monthly sales trend |
| GET | `/api/monthly/yoy` | Year-over-year comparison |
| GET | `/api/monthly/heatmap` | Branch × month heatmap |
| GET | `/api/actions/recommendations` | Menu Engineering Matrix |

### ML

| Method | Path | Description |
|---|---|---|
| GET | `/api/ml/metadata` | R², pool sizes, feature importances |
| GET | `/api/ml/margin-residuals` | RF underperformer pairs |
| GET | `/api/ml/branch-clusters` | KMeans cluster assignments |
| GET | `/api/ml/price-anomalies` | Underpriced branch×SKU pairs |
| GET | `/api/ml/availability-gaps` | Products missing from branches |
| POST | `/api/ml/simulate` | ML-computed profit simulation |

### Simulate request body

```json
{
  "marginGapClose": 30,
  "branchMixShift": 20,
  "priceStandardize": 50,
  "availabilityRollout": 20
}
```

Each value is 0–100, representing what percentage of that model's identified pool you are targeting. Returns `{ estimatedUplift, upliftPct, currentProfit, projectedProfit, confidence, breakdown[], topActions{} }`.

---

## Tech Stack

- **Frontend:** React 18, Chart.js, CSS custom properties
- **Backend:** Node.js, Express, csv-parse
- **ML training:** Python — scikit-learn RandomForestRegressor, KMeans, LinearRegression, numpy, pandas
- **ML serving:** Pre-computed JSON artifacts, pure Node.js at runtime (no Python dependency)
- **Data:** Stories Coffee POS exports — 25 branches, LBP currency, FY2025
