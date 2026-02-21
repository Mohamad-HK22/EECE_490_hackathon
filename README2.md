# ML Methodology: Profit Simulator & Action Generator
## Stories Profit Genome â€” Hackathon Edition

> Based on EDA findings + 5 cleaned POS datasets (25 branches, 12,522 item-level rows, 2025â€“2026 monthly data)

---

## Part 1 â€” What You Currently Have (Rule-Based Baseline)

The current simulator uses **hand-crafted multipliers**:
- Cold Brew Boost: `COLD BAR SECTION profit Ã— lever% Ã— 0.18`
- Beverage Mix: `BEVERAGES profit Ã— lever% Ã— 0.12`
- Pastry Bundles: category profit Ã— multiplier
- Reduce Loss Leaders: `|loss leader sum| Ã— lever% Ã— 0.7`
- Confidence: `55 + sum_of_levers / 10`

This is fine for a demo, but it has no grounding in the actual variance or covariance in the data. The multipliers are made up. Here's how to replace and augment them with real ML.

---

## Part 2 â€” ML Approach for the Profit Simulator

### The Core Question
> "If I change lever X by Y%, what is the realistic profit impact?"

This is a **causal inference / regression problem**, not a classification problem.

---

### 2.1 Feature Engineering (from your data)

From `profit_by_item.csv` (12,522 item-level rows, 25 branches, 551 products):

| Feature | Source | Type |
|---------|--------|------|
| `bev_share` | BEVERAGES profit / total branch profit | Continuous |
| `food_share` | FOOD profit / total branch profit | Continuous |
| `cold_bar_pct` | COLD BAR SECTION profit / total | Continuous |
| `hot_bar_pct` | HOT BAR SECTION profit / total | Continuous |
| `frozen_yoghurt_pct` | FROZEN YOGHURT profit / total | Continuous |
| `loss_leader_ratio` | sum(negative profits) / total profit | Continuous |
| `pastry_attach_rate` | (COFFEE PASTRY + CROISSANT qty) / total qty | Continuous |
| `avg_margin_pct` | mean total_profit_pct across items | Continuous |
| `n_loss_items` | count of items where total_profit < 0 | Integer |
| `branch` | branch name | Categorical (one-hot or embed) |
| `month_number` | 1â€“12 | Cyclical (sin/cos) |
| `year` | 2025 or 2026 | Ordinal |

**Your data gives you these at branch level** â€” one row per branch = 25 data points.
That's too small for a standalone ML model, but you can use it in a **hierarchical / pooling** approach.

**At item level (12,522 rows):** you have enough for individual item-level models.

---

### 2.2 Model Choice: Gradient Boosted Regression Tree (XGBoost / LightGBM)

**Why XGBoost?**
- Handles mixed feature types (numeric + categorical)
- Works well on tabular data of this size
- Interpretable via SHAP values (critical for hackathon judging)
- No need for normalization

**Target variable:**
```
y = total_profit   (at item or branch level)
```

**Two levels to model:**

#### Level 1 â€” Item-level profit predictor
```
X = [category, division, branch, qty, total_price, total_cost, total_cost_pct]
y = total_profit
```
- Train on 12,522 item rows
- Use cross-validation (5-fold) stratified by branch
- Purpose: understand which features drive profit at item granularity

#### Level 2 â€” Branch-level simulator
```
X = [cold_bar_pct, loss_leader_ratio, pastry_attach_rate, bev_share, avg_margin_pct, month_number_sin, month_number_cos]
y = branch_monthly_profit
```
- Built from aggregating item data by branch + joining monthly_sales_long
- 25 branches Ã— 12 months = 300 rows (enough for a linear model)
- Use Ridge Regression or LightGBM with leave-one-branch-out CV

---

### 2.3 Simulator Architecture: "What-If" Simulation with Perturbation

The cleanest approach for a simulator with your data:

```
1. Fit XGBoost on full item dataset
2. For each lever, PERTURB the relevant features in the dataset
3. Predict new profits with perturbed features
4. Difference = estimated uplift
```

**Concretely:**

```python
# Cold Brew Boost lever = +10%
# â†’ Multiply qty of COLD BAR SECTION items by 1.10, re-predict profit
cold_bar_mask = X_test['division'] == 'COLD BAR SECTION'
X_perturbed = X_test.copy()
X_perturbed.loc[cold_bar_mask, 'qty'] *= 1.10
X_perturbed.loc[cold_bar_mask, 'total_price'] *= 1.10

uplift = model.predict(X_perturbed).sum() - model.predict(X_test).sum()
```

This is called **"do-calculus" perturbation** â€” you're simulating an intervention.

**Levers â†’ data perturbation mapping:**

| Lever | Feature to Perturb | Constraint |
|-------|--------------------|------------|
| Cold Brew Boost | `qty` + `total_price` for `division == 'COLD BAR SECTION'` | cap at +50% |
| Beverage Mix Shift | Reduce `qty` of low-margin BEV items, increase high-margin BEV items | zero-sum on total qty |
| Pastry Bundle Attach | `qty` of COFFEE PASTRY / CROISSANT / CINNAMON ROLLS | cap at +40% |
| Reduce Loss Leaders | Set `qty *= (1 - lever/100)` for items where `total_profit < 0` | can't go negative qty |

**Confidence score** â€” replace the fake formula with:
```python
# Based on actual coefficient of variation and model RÂ²
base_r2 = model.score(X_val, y_val)   # e.g., 0.82
cv_profit = df_item['total_profit'].std() / df_item['total_profit'].mean()  # ~3.37 from EDA
stability_factor = max(0, 1 - cv_profit / 10)
confidence = int((0.5 * base_r2 + 0.5 * stability_factor) * 100)
```

---

### 2.4 SHAP for Explainability (Hackathon Gold)

```python
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test)
```

This tells you **which features actually drive profit** and replaces hand-written recommendation strings with data-backed explanations. Judges love this.

---

### 2.5 Monthly Forecasting (Time Series)

From `monthly_sales_long.csv`: 300 rows (25 branches Ã— 12 months, 2025). You have partial 2026 data.

**Model:** Facebook Prophet or SARIMAX per branch.

```python
from prophet import Prophet

# Per branch
for branch in df_long['branch'].unique():
    b_df = df_long[
        (df_long['branch'] == branch) &
        (df_long['period_type'] == 'month')
    ][['year', 'month_number', 'sales_amount']].copy()

    # Create ds column (Prophet needs datetime)
    b_df['ds'] = pd.to_datetime(b_df['year'].astype(str) + '-' + b_df['month_number'].astype(int).astype(str) + '-01')
    b_df = b_df.rename(columns={'sales_amount': 'y'})

    m = Prophet(seasonality_mode='multiplicative', yearly_seasonality=True)
    m.fit(b_df)
    future = m.make_future_dataframe(periods=6, freq='MS')
    forecast = m.predict(future)
```

**Why Prophet?**
- You have annual seasonality (your EDA shows August = peak, June = valley)
- You have a trend break in some branches (Airport opened mid-2025)
- Prophet handles missing months and changepoints automatically

**Alternative: Linear seasonal model (simpler, more explainable):**
```python
from sklearn.linear_model import Ridge
# Features: [sin(2Ï€*month/12), cos(2Ï€*month/12), year_index]
# Target: sales_amount
# One model per branch, or pooled with branch dummy
```

---

## Part 3 â€” ML Approach for the Action Generator

### The Core Question
> "Which products/branches/groups should I act on, and why?"

This is a **ranking + segmentation problem**, not pure prediction.

---

### 3.1 Menu Engineering Matrix (BCG-style, Data-Driven)

Classic restaurant consulting framework, but computed from your data:

```
Quadrant    | Profit Margin | Qty Sold    | Action
------------|---------------|-------------|--------------------
Stars       | High          | High        | Protect & promote
Plowhorses  | Low           | High        | Reprice or bundle
Puzzles     | High          | Low         | Market harder
Dogs        | Low (or neg)  | Low         | Eliminate or redesign
```

**Implementation:**
```python
item_agg = df_item[df_item['row_type'] == 'item'].groupby('product_desc').agg(
    total_profit  = ('total_profit', 'sum'),
    total_qty     = ('qty', 'sum'),
    avg_margin    = ('total_profit_pct', 'mean'),
    branch_count  = ('branch', 'nunique'),
).reset_index()

# Use median as threshold (data-driven, not arbitrary)
profit_thresh = item_agg['total_profit'].median()   # ~5,833 LBP
qty_thresh    = item_agg['total_qty'].median()

def classify(row):
    hi_p = row['total_profit'] > profit_thresh
    hi_q = row['total_qty']    > qty_thresh
    if hi_p and hi_q:   return 'Star'
    if hi_p and not hi_q: return 'Puzzle'
    if not hi_p and hi_q: return 'Plowhorse'
    return 'Dog'

item_agg['menu_class'] = item_agg.apply(classify, axis=1)
```

**From your EDA:**
- Stars: Mango Yoghurt Combo, Original Yoghurt Combo, Water, Americano Large
- Dogs: Blueberries Combo (-8M), Strawberry Combo (-5M) â€” 9.6% of items are loss-making
- Puzzles: High-margin specialty items sold in only 1-3 branches

---

### 3.2 Branch Clustering (K-Means on Branch DNA)

Your EDA noted "store clustering" as a next step. Here's exactly how:

```python
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

# Build branch feature matrix
branch_feats = df_item[df_item['row_type'] == 'item'].groupby('branch').agg(
    total_profit     = ('total_profit', 'sum'),
    avg_margin       = ('total_profit_pct', 'mean'),
    n_items          = ('product_desc', 'nunique'),
    loss_item_ratio  = ('total_profit', lambda x: (x < 0).sum() / len(x)),
    bev_profit_share = ...,   # join with category data
    food_profit_share= ...,
).reset_index()

scaler = StandardScaler()
X_clust = scaler.fit_transform(branch_feats.drop('branch', axis=1))

kmeans = KMeans(n_clusters=4, random_state=42)
branch_feats['cluster'] = kmeans.fit_predict(X_clust)
```

**Expected clusters (based on EDA patterns):**
- Cluster 0: High-volume, high-margin urban flagships (Ain el Mreisseh-style)
- Cluster 1: Mid-size, balanced BEV/FOOD mix
- Cluster 2: New/small branches with low sales and incomplete menus
- Cluster 3: Specialized branches (Airport â€” high GRAB&GO, less fresh food)

**Action from clusters:** Generate cluster-specific recommendations rather than one-size-fits-all. E.g., "Cluster 2 branches underperform on COLD BAR â€” target training + promo."

---

### 3.3 Anomaly Detection for Profit Traps

Instead of manually defining loss leaders, use **Isolation Forest**:

```python
from sklearn.ensemble import IsolationForest

item_only = df_item[df_item['row_type'] == 'item'][
    ['total_profit', 'total_cost_pct', 'qty', 'total_profit_pct']
].dropna()

iso = IsolationForest(contamination=0.05, random_state=42)
item_only['anomaly'] = iso.fit_predict(item_only)
# anomaly == -1 â†’ profit trap candidate
```

This catches items that are abnormal in multiple dimensions simultaneously (not just negative profit), e.g. an item with low qty, high cost, and thin margin even if technically profitable.

---

### 3.4 Association Rule Mining for Bundle Recommendations

From `sales_by_group.csv`, you have item descriptions per branch. Use Apriori or FP-Growth to find what sells together:

```python
from mlxtend.frequent_patterns import apriori, association_rules

# Build a basket matrix: branch Ã— item (binary)
basket = df_group.pivot_table(
    index='branch',
    columns='description',
    values='qty',
    aggfunc='sum'
).fillna(0).gt(0).astype(int)

freq_items = apriori(basket, min_support=0.4, use_colnames=True)
rules = association_rules(freq_items, metric='lift', min_threshold=1.5)
rules = rules.sort_values('lift', ascending=False)
```

**Expected output:**
- "Branches that sell Cinnamon Roll also sell Americano Large with lift=2.3 â†’ Bundle them"
- "Frozen Yoghurt â†’ Mixed Cold Beverage has 80% confidence â†’ Combo opportunity"

This replaces your hand-coded bundle recommendations with data-derived ones.

---

### 3.5 LLM Layer (Optional Stretch Goal)

Once you have model outputs, you can pass structured results to an LLM for natural-language action cards:

```python
import openai  # or use Anthropic Claude API

context = f"""
Branch: {branch}
Menu Engineering Result:
  - Stars: {stars_list}
  - Dogs (loss-makers): {dogs_list}
  - Cluster: {cluster_label}
  - Monthly trend: {trend_direction}, peak month: {peak_month}
  - Anomaly items: {anomaly_items}

Generate 3 specific, actionable business recommendations for this branch.
"""

response = openai.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": context}]
)
```

This turns ML outputs into the polished action cards the UI already shows.

---

## Part 4 â€” Full Pipeline Architecture

```
Raw CSVs
    â”‚
    â–¼
Feature Engineering
(branch_feats.py, item_feats.py)
    â”‚
    â”œâ”€â”€â–º XGBoost Item Model â”€â”€â–º SHAP Explanations â”€â”€â–º Action Cards
    â”‚
    â”œâ”€â”€â–º KMeans Branch Clusters â”€â”€â–º Cluster Labels â”€â”€â–º Group DNA Page
    â”‚
    â”œâ”€â”€â–º Prophet / SARIMAX â”€â”€â–º 6-month Forecast â”€â”€â–º What Changed Page
    â”‚
    â”œâ”€â”€â–º Menu Engineering Matrix â”€â”€â–º Stars/Dogs/Puzzles â”€â”€â–º Action Generator
    â”‚
    â”œâ”€â”€â–º Isolation Forest â”€â”€â–º Anomaly Items â”€â”€â–º Profit Traps
    â”‚
    â””â”€â”€â–º Perturbation Engine â”€â”€â–º Uplift Estimates â”€â”€â–º Profit Simulator
```

**Backend integration:** Your existing Express API can call a Python microservice (Flask/FastAPI) for ML inference, or you can pre-compute and embed results as JSON files served statically.

---

## Part 5 â€” Realistic Scoping for a Hackathon

Given your timeline, here's what's actually doable:

| Priority | Model | Lines of Code | Impact |
|----------|-------|--------------|--------|
| P0 | Menu Engineering Matrix (no ML needed) | ~30 | Replaces entire Action Generator with real data |
| P0 | Item-level profit regression (XGBoost) | ~60 | Powers Simulator with real predictions |
| P1 | Branch clusters (KMeans, k=4) | ~40 | Powers Group DNA profiles |
| P1 | Isolation Forest anomalies | ~20 | Better profit traps than rule-based |
| P2 | Prophet monthly forecast | ~50 | Better What Changed trend |
| P3 | Association rules | ~40 | Bundle recommendations |
| P3 | LLM narrative layer | ~30 | Polish on action card text |

**Suggested execution order:**
1. Menu Engineering Matrix â†’ drop into Action Generator immediately
2. XGBoost item model â†’ replace simulator multipliers with perturbation engine
3. KMeans clusters â†’ feed into Group DNA branch cards
4. Isolation Forest â†’ replace hard-coded loss-leader filter
5. If time: Prophet + LLM layer for polish

---

## Part 6 â€” Key Data Facts That Shape Every Model

From the EDA and data profiling:

| Fact | Implication |
|------|------------|
| 9.6% of items (1,199) have negative profit | Large enough to model; small enough to fix |
| COLD BAR SECTION = 174M LBP, largest division | Simulator lever has biggest real impact here |
| August = peak month (109M LBP), June = valley (18M) | Any forecast must capture this seasonality |
| 441 of 551 products appear in 10+ branches | Enough cross-branch data for pooled models |
| Total profit std/mean â‰ˆ 3.4Ã— (high variance) | Models need log-transform of target or quantile regression |
| BEVERAGES 62% vs FOOD 38% of profit | Bev-shift lever has real leverage |
| 25 branches is small for branch-level models | Use item-level as primary, branch as grouping variable |

**Critical preprocessing note:** Apply `log1p(total_profit + offset)` transformation to the target variable before any regression, since profit is heavily right-skewed (std = 161K, mean = 47K from EDA).

---

## Part 7 â€” Quick-Start Code Structure

```
backend/
â”œâ”€â”€ ml/
â”‚   â”œâ”€â”€ train.py              # One-time training script
â”‚   â”œâ”€â”€ menu_engineering.py   # Stars/Dogs/Puzzles classification
â”‚   â”œâ”€â”€ simulator.py          # XGBoost perturbation engine
â”‚   â”œâ”€â”€ clustering.py         # KMeans branch profiles
â”‚   â”œâ”€â”€ anomaly.py            # Isolation Forest
â”‚   â”œâ”€â”€ forecast.py           # Prophet per branch
â”‚   â””â”€â”€ models/               # Saved .pkl / .joblib files
â”‚       â”œâ”€â”€ xgb_item_profit.joblib
â”‚       â”œâ”€â”€ kmeans_branches.joblib
â”‚       â””â”€â”€ forecasts/        # One .pkl per branch
â”œâ”€â”€ routes/
â”‚   â””â”€â”€ ml_insights.js        # Express route calling Python subprocess or pre-computed JSON
â””â”€â”€ data/
    â””â”€â”€ ml_cache/             # Pre-computed JSON results (fast API response)
        â”œâ”€â”€ menu_matrix.json
        â”œâ”€â”€ branch_clusters.json
        â”œâ”€â”€ anomalies.json
        â””â”€â”€ forecasts.json
```

For the hackathon: **pre-compute everything at startup**, write to JSON cache, serve via existing Express API. No real-time ML inference needed.