const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const ML_DIR = path.join(__dirname, '../data/ml');

function loadML(name) {
  return JSON.parse(fs.readFileSync(path.join(ML_DIR, name), 'utf-8'));
}

// Cache in memory at startup
let _meta, _residuals, _clusters, _clusterSummary, _priceAnomalies, _availGaps,
    _productCatalog, _branches;

function ensureLoaded() {
  if (!_meta) {
    _meta           = loadML('metadata.json');
    _residuals      = loadML('margin_residuals.json');
    _clusters       = loadML('branch_clusters.json');
    _clusterSummary = loadML('cluster_summary.json');
    _priceAnomalies = loadML('price_anomalies.json');
    _availGaps      = loadML('availability_gaps.json');
    _productCatalog = loadML('product_catalog.json');
    _branches       = loadML('branches.json');
  }
}

function getBranchCount() {
  const fromList = Array.isArray(_branches) ? _branches.length : 0;
  const fromMeta = Number(_meta?.n_branches);
  if (fromList > 0) return fromList;
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  return 1;
}

// ── GET /api/ml/metadata ──────────────────────────────────────────────────────
router.get('/metadata', (req, res) => {
  ensureLoaded();
  res.json(_meta);
});

// ── GET /api/ml/product-catalog ───────────────────────────────────────────────
router.get('/product-catalog', (req, res) => {
  ensureLoaded();
  res.json(_productCatalog);
});

// ── GET /api/ml/branches ──────────────────────────────────────────────────────
router.get('/branches', (req, res) => {
  ensureLoaded();
  res.json(_branches);
});

// ── GET /api/ml/margin-residuals ──────────────────────────────────────────────
router.get('/margin-residuals', (req, res) => {
  ensureLoaded();
  const { branch, limit } = req.query;
  let data = _residuals;
  if (branch && branch !== 'all') {
    data = data.filter(r => r.branch === branch);
  }
  const n = Number(limit);
  res.json(Number.isFinite(n) && n > 0 ? data.slice(0, n) : data);
});

// ── GET /api/ml/branch-clusters ───────────────────────────────────────────────
router.get('/branch-clusters', (req, res) => {
  ensureLoaded();
  res.json({
    branches: _clusters,
    summary:  _clusterSummary,
    best_cluster: _meta.best_cluster,
    best_cluster_margin: _meta.best_cluster_margin,
    best_cluster_drivers: _meta.best_cluster_drivers,
  });
});

// ── GET /api/ml/price-anomalies ───────────────────────────────────────────────
router.get('/price-anomalies', (req, res) => {
  ensureLoaded();
  const { branch, limit } = req.query;
  let data = _priceAnomalies;
  if (branch && branch !== 'all') {
    data = data.filter(r => r.branch === branch);
  }
  const n = Number(limit);
  res.json(Number.isFinite(n) && n > 0 ? data.slice(0, n) : data);
});

// ── GET /api/ml/availability-gaps ─────────────────────────────────────────────
router.get('/availability-gaps', (req, res) => {
  ensureLoaded();
  const { limit } = req.query;
  const n = Number(limit);
  res.json(Number.isFinite(n) && n > 0 ? _availGaps.slice(0, n) : _availGaps);
});

// ── POST /api/ml/simulate-scenario ───────────────────────────────────────────
//
// Three scenario types:
//
// 1. PRICE CHANGE  — change the selling price of a specific product (optionally at one branch)
//    body: { type: 'price_change', product, newPrice, branch }
//    Logic:
//      - Look up product in catalog (cost_pct, current unit_price, total_qty)
//      - If branch specified, scale qty to that branch's share (~1 / number_of_branches)
//      - New revenue  = qty × newPrice
//      - Cost stays fixed (unit_cost = unit_price × cost_pct / 100)
//      - New profit   = new_revenue − (qty × unit_cost)
//      - Old profit   = qty × unit_price × (1 − cost_pct/100)
//      - Delta profit = new_profit − old_profit
//
// 2. BUNDLE        — sell N items together at a bundle price
//    body: { type: 'bundle', items: [{product, qty}], bundlePrice, expectedDailySales, branch }
//    Logic:
//      - For each item, cost per unit = catalog unit_cost
//      - Total bundle cost = sum(item_cost × item_qty)
//      - Bundle margin = (bundlePrice − total_bundle_cost) / bundlePrice × 100
//      - Monthly profit = bundlePrice × expectedDailySales × 30 × (1 − total_bundle_cost/bundlePrice)
//      - Compare to selling items individually at catalog prices
//
// 3. SALE (discount) — put a product on sale at reduced price
//    body: { type: 'sale', product, discountPct, volumeBoost, branch }
//    Logic:
//      - salePrice    = unit_price × (1 − discountPct/100)
//      - boostedQty   = qty × (1 + volumeBoost/100)  — user estimates demand lift
//      - Old profit   = qty × unit_price × margin_pct/100
//      - New profit   = boostedQty × salePrice × margin_pct_new/100
//        where margin_pct_new = (salePrice − unit_cost) / salePrice × 100
//      - Delta profit = new_profit − old_profit
//
// ─────────────────────────────────────────────────────────────────────────────
router.post('/simulate-scenario', (req, res) => {
  ensureLoaded();

  const { type } = req.body;
  const baseline = _meta.total_profit_baseline;

  // Helper: find product in catalog
  function findProduct(name) {
    return _productCatalog.find(p => p.product_desc === name) || null;
  }

  // ── 1. PRICE CHANGE ──────────────────────────────────────────────────────
  if (type === 'price_change') {
    const { product, newPrice, branch } = req.body;

    const p = findProduct(product);
    if (!p) return res.status(400).json({ error: 'Product not found' });

    const unitCost    = p.unit_price * (p.cost_pct / 100);
    let   qty         = p.total_qty;
    const branchNote  = branch && branch !== 'all' ? branch : null;
    if (branchNote) qty = qty / getBranchCount();   // approximate single-branch share

    const oldProfit   = qty * (p.unit_price - unitCost);
    const newProfit   = qty * (Number(newPrice) - unitCost);
    const delta       = newProfit - oldProfit;
    const newMarginPct = ((Number(newPrice) - unitCost) / Number(newPrice) * 100);

    // Warn if price goes below cost
    const belowCost = Number(newPrice) < unitCost;

    return res.json({
      scenario: 'Price Change',
      product,
      branch: branchNote || 'All branches',
      currentPrice:   p.unit_price,
      newPrice:       Number(newPrice),
      currentMargin:  p.avg_margin,
      newMargin:      parseFloat(newMarginPct.toFixed(1)),
      unitCost:       parseFloat(unitCost.toFixed(0)),
      qty:            Math.round(qty),
      oldProfit:      Math.round(oldProfit),
      newProfit:      Math.round(newProfit),
      deltaProfit:    Math.round(delta),
      deltaDirection: delta >= 0 ? 'gain' : 'loss',
      annualisedDelta: Math.round(delta * 12),
      baselineProfit: Math.round(baseline),
      newTotalProfit: Math.round(baseline + delta),
      newTotalMarginPct: parseFloat(((baseline + delta) / _meta.total_revenue_baseline * 100).toFixed(2)),
      belowCost,
      warning: belowCost ? 'New price is below unit cost — this item will sell at a loss.' : null,
    });
  }

  // ── 2. BUNDLE ────────────────────────────────────────────────────────────
  if (type === 'bundle') {
    const { items, bundlePrice, expectedDailySales, branch } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'No items provided' });

    const enriched = items.map(item => {
      const p = findProduct(item.product);
      if (!p) return null;
      const unitCost = p.unit_price * (p.cost_pct / 100);
      return {
        product: item.product,
        qty: Number(item.qty) || 1,
        unitPrice: p.unit_price,
        unitCost: parseFloat(unitCost.toFixed(0)),
        division: p.division,
        category: p.category,
      };
    }).filter(Boolean);

    if (enriched.length === 0) return res.status(400).json({ error: 'No valid products found' });

    const totalBundleCost    = enriched.reduce((s, i) => s + i.unitCost * i.qty, 0);
    const totalIndividualRRP = enriched.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const bPrice             = Number(bundlePrice);
    const dailySales         = Number(expectedDailySales) || 10;
    const bundleMarginPct    = bPrice > 0 ? ((bPrice - totalBundleCost) / bPrice * 100) : 0;
    const monthlyBundleProfit = bPrice * dailySales * 30 * (bundleMarginPct / 100);

    // What the same volume would earn sold separately (weighted avg margin on each item)
    const monthlyIndividualProfit = enriched.reduce((s, i) => {
      const itemMarginLBP = (i.unitPrice - i.unitCost) * i.qty;
      return s + itemMarginLBP * dailySales * 30;
    }, 0);

    const delta    = monthlyBundleProfit - monthlyIndividualProfit;
    const discount = ((totalIndividualRRP - bPrice) / totalIndividualRRP * 100);

    return res.json({
      scenario: 'Bundle',
      branch: branch || 'All branches',
      items: enriched,
      bundlePrice: bPrice,
      totalIndividualRRP: parseFloat(totalIndividualRRP.toFixed(0)),
      totalBundleCost: parseFloat(totalBundleCost.toFixed(0)),
      bundleMarginPct: parseFloat(bundleMarginPct.toFixed(1)),
      discountOffRRP: parseFloat(discount.toFixed(1)),
      dailySales,
      monthlyBundleProfit:     Math.round(monthlyBundleProfit),
      monthlyIndividualProfit: Math.round(monthlyIndividualProfit),
      deltaMonthlyProfit: Math.round(delta),
      deltaDirection: delta >= 0 ? 'gain' : 'loss',
      annualisedDelta: Math.round(delta * 12),
      belowCost: bPrice < totalBundleCost,
      warning: bPrice < totalBundleCost ? 'Bundle price is below total ingredient cost — this bundle loses money.' : null,
    });
  }

  // ── 3. SALE (DISCOUNT) ───────────────────────────────────────────────────
  if (type === 'sale') {
    const { product, discountPct, volumeBoost, branch } = req.body;

    const p = findProduct(product);
    if (!p) return res.status(400).json({ error: 'Product not found' });

    const unitCost    = p.unit_price * (p.cost_pct / 100);
    let   baseQty     = p.total_qty;
    const branchNote  = branch && branch !== 'all' ? branch : null;
    if (branchNote) baseQty = baseQty / getBranchCount();

    const disc        = Number(discountPct) || 0;
    const boost       = Number(volumeBoost) || 0;
    const salePrice   = p.unit_price * (1 - disc / 100);
    const boostedQty  = baseQty * (1 + boost / 100);

    const oldProfit   = baseQty * (p.unit_price - unitCost);
    const newMarginLBP = salePrice - unitCost;
    const newProfit   = boostedQty * newMarginLBP;
    const delta       = newProfit - oldProfit;

    const newMarginPct = salePrice > 0 ? (newMarginLBP / salePrice * 100) : 0;
    const breakEvenBoost = p.unit_price > salePrice
      ? ((oldProfit / (newMarginLBP > 0 ? newMarginLBP : 1)) / baseQty - 1) * 100
      : 0;

    return res.json({
      scenario: 'Sale / Discount',
      product,
      branch: branchNote || 'All branches',
      currentPrice:    p.unit_price,
      salePrice:       parseFloat(salePrice.toFixed(0)),
      discountPct:     disc,
      unitCost:        parseFloat(unitCost.toFixed(0)),
      currentMarginPct: p.avg_margin,
      newMarginPct:    parseFloat(newMarginPct.toFixed(1)),
      baseQty:         Math.round(baseQty),
      boostedQty:      Math.round(boostedQty),
      volumeBoostPct:  boost,
      oldProfit:       Math.round(oldProfit),
      newProfit:       Math.round(newProfit),
      deltaProfit:     Math.round(delta),
      deltaDirection:  delta >= 0 ? 'gain' : 'loss',
      annualisedDelta: Math.round(delta * 12),
      breakEvenVolumeBoostNeeded: parseFloat(breakEvenBoost.toFixed(1)),
      baselineProfit:  Math.round(baseline),
      newTotalProfit:  Math.round(baseline + delta),
      belowCost: salePrice < unitCost,
      warning: salePrice < unitCost
        ? 'Sale price is below unit cost — every unit sold loses money.'
        : newMarginLBP < 0.3 * (p.unit_price - unitCost)
        ? `Margin drops to ${parseFloat(newMarginPct.toFixed(1))}% — you need a ${parseFloat(breakEvenBoost.toFixed(0))}% volume increase just to break even.`
        : null,
    });
  }

  return res.status(400).json({ error: 'Unknown scenario type. Use price_change, bundle, or sale.' });
});

// ── POST /api/ml/simulate (legacy ML levers) ─────────────────────────────────
router.post('/simulate', (req, res) => {
  ensureLoaded();
  const {
    marginGapClose       = 0,
    branchMixShift       = 0,
    priceStandardize     = 0,
    availabilityRollout  = 0,
  } = req.body;

  const pools = _meta.pools;

  const marginImpact   = pools.margin_residual       * (marginGapClose      / 100) * 0.45;
  const mixImpact      = pools.branch_mix            * (branchMixShift      / 100) * 0.30;
  const priceImpact    = pools.price_standardization * (priceStandardize    / 100) * 0.60;
  const availImpact    = pools.availability_gap      * (availabilityRollout  / 100) * 0.50;

  const totalUplift    = marginImpact + mixImpact + priceImpact + availImpact;
  const currentProfit  = _meta.total_profit_baseline;
  const upliftPct      = currentProfit > 0 ? (totalUplift / currentProfit) * 100 : 0;

  const levers = [marginGapClose, branchMixShift, priceStandardize, availabilityRollout];
  const activeCount     = levers.filter(v => v > 0).length;
  const aggressiveCount = levers.filter(v => v > 70).length;

  let confidence = 76;
  if (marginGapClose   > 0)  confidence += 10;
  if (priceStandardize > 0)  confidence += 6;
  if (activeCount >= 3)      confidence += 4;
  confidence -= aggressiveCount * 5;
  confidence = Math.min(95, Math.max(45, confidence));

  const maxImpact = Math.max(marginImpact, mixImpact, priceImpact, availImpact, 1);

  const topMarginItems = _residuals.slice(0, 5).map(r => ({
    branch: r.branch, product: r.product_desc,
    actual_margin: r.actual_margin, pred_margin: r.pred_margin,
    gap_pct: r.gap_pct, potential: r.uplift_potential,
  }));
  const topPriceItems = _priceAnomalies.slice(0, 5).map(r => ({
    branch: r.branch, product: r.product,
    actual_price: r.actual_price, target_price: r.target_price,
    gap_pct: r.gap_pct, profit_gain: r.profit_gain,
  }));
  const topAvailItems = _availGaps.slice(0, 5).map(r => ({
    product: r.product, n_missing: r.n_missing,
    avg_margin: r.avg_margin, expected_profit: r.expected_profit,
  }));

  res.json({
    estimatedUplift:  Math.round(totalUplift),
    upliftPct:        parseFloat(upliftPct.toFixed(2)),
    currentProfit:    Math.round(currentProfit),
    projectedProfit:  Math.round(currentProfit + totalUplift),
    confidence,
    maxImpact:        Math.round(maxImpact),
    breakdown: [
      { lever: 'Margin Gap Closure',    model: `Random Forest R²=${_meta.model_r2}`,       pool: Math.round(pools.margin_residual),       pct: marginGapClose,      conversion: 0.45, impact: Math.round(marginImpact)  },
      { lever: 'Branch Mix Shift',      model: 'KMeans (4 clusters)',                       pool: Math.round(pools.branch_mix),            pct: branchMixShift,      conversion: 0.30, impact: Math.round(mixImpact)     },
      { lever: 'Price Standardization', model: 'Cross-branch price anomaly (p75 target)',   pool: Math.round(pools.price_standardization), pct: priceStandardize,    conversion: 0.60, impact: Math.round(priceImpact)   },
      { lever: 'Availability Rollout',  model: 'Branch-revenue weighted regression',        pool: Math.round(pools.availability_gap),      pct: availabilityRollout, conversion: 0.50, impact: Math.round(availImpact)   },
    ],
    topActions: { marginItems: topMarginItems, priceItems: topPriceItems, availItems: topAvailItems },
    modelStats: { r2: _meta.model_r2, r2_std: _meta.model_r2_std, n_samples: _meta.n_samples, n_branches: _meta.n_branches, n_products: _meta.n_products },
  });
});

module.exports = router;
