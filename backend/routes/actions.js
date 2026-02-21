const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/actions/recommendations
// AI-style recommendations based on real data
router.get('/recommendations', (req, res) => {
  const { branch } = req.query;
  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const cats  = getDataset('profit_by_category.csv').filter(r => r.row_type === 'category');

  let filteredItems = branch && branch !== 'all'
    ? items.filter(r => r.branch === branch) : items;

  // Aggregate products
  const productMap = {};
  filteredItems.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!productMap[k]) productMap[k] = { product_desc: k, category: r.category, division: r.division, qty: 0, total_price: 0, total_cost: 0, total_profit: 0 };
    productMap[k].qty          += (r.qty || 0);
    productMap[k].total_price  += (r.total_price || 0);
    productMap[k].total_cost   += (r.total_cost || 0);
    productMap[k].total_profit += (r.total_profit || 0);
  });

  const products = Object.values(productMap).map(p => ({
    ...p,
    profit_margin_pct: p.total_price > 0 ? (p.total_profit / p.total_price * 100) : 0,
  }));

  const totalProfit = products.reduce((s,p) => s + p.total_profit, 0);
  const avgMargin   = products.filter(p => p.total_price > 0)
    .reduce((s,p,_,a) => s + p.profit_margin_pct / a.length, 0);

  // Promote: high margin, high qty — underexploited stars
  const promote = products
    .filter(p => p.profit_margin_pct > avgMargin * 1.1 && p.total_profit > 0)
    .sort((a,b) => b.total_profit - a.total_profit)
    .slice(0, 3)
    .map(p => ({
      type: 'promote',
      icon: '🚀',
      product: p.product_desc,
      category: p.category,
      division: p.division,
      profit_margin_pct: p.profit_margin_pct,
      total_profit: p.total_profit,
      total_qty: p.qty,
      title: `Promote ${p.product_desc}`,
      description: `High-margin item at ${p.profit_margin_pct.toFixed(1)}% profit margin. Increase visibility and upsell frequency across branches.`,
      impact: p.total_profit * 0.15,
    }));

  // Fix: loss leaders — items with negative profit
  const fix = products
    .filter(p => p.total_profit < 0 && p.qty > 100)
    .sort((a,b) => a.total_profit - b.total_profit)
    .slice(0, 3)
    .map(p => ({
      type: 'fix',
      icon: '⚠️',
      product: p.product_desc,
      category: p.category,
      division: p.division,
      profit_margin_pct: p.profit_margin_pct,
      total_profit: p.total_profit,
      total_qty: p.qty,
      title: `Fix: ${p.product_desc}`,
      description: `Losing ${Math.abs(p.total_profit).toLocaleString('en', {maximumFractionDigits:0})} LBP. Review COGS, pricing, or consider removal from menu.`,
      impact: Math.abs(p.total_profit) * 0.8,
    }));

  // Optimize category mix
  const catMap = {};
  (branch && branch !== 'all' ? cats.filter(r => r.branch === branch) : cats).forEach(r => {
    const k = r.category;
    if (!k) return;
    if (!catMap[k]) catMap[k] = { category: k, total_profit: 0, total_cost_pct: 0, count: 0 };
    catMap[k].total_profit    += (r.total_profit || 0);
    catMap[k].total_cost_pct  += (r.total_cost_pct || 0);
    catMap[k].count++;
  });

  const catList = Object.values(catMap).map(c => ({
    ...c,
    avg_cost_pct: c.count > 0 ? c.total_cost_pct / c.count : 0,
  })).sort((a,b) => b.total_profit - a.total_profit);

  const optimize = catList.slice(0, 2).map(c => ({
    type: 'optimize',
    icon: '📊',
    product: c.category,
    category: c.category,
    title: `Optimize ${c.category} Mix`,
    description: `${c.category} contributes ${((c.total_profit / totalProfit) * 100).toFixed(1)}% of total profit. Shift volume toward highest-margin items within this category.`,
    impact: c.total_profit * 0.08,
    total_profit: c.total_profit,
  }));

  res.json({ promote, fix, optimize, meta: { totalProfit, avgMargin, productCount: products.length } });
});

// GET /api/actions/promote-opportunities
router.get('/promote-opportunities', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) > 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const map = {};
  items.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!map[k]) map[k] = { product_desc: k, category: r.category, division: r.division, qty: 0, total_price: 0, total_cost: 0, total_profit: 0 };
    map[k].qty          += (r.qty || 0);
    map[k].total_price  += (r.total_price || 0);
    map[k].total_cost   += (r.total_cost || 0);
    map[k].total_profit += (r.total_profit || 0);
  });

  const result = Object.values(map)
    .map(p => ({ ...p, profit_margin_pct: p.total_price > 0 ? (p.total_profit / p.total_price * 100) : 0 }))
    .filter(p => p.profit_margin_pct > 50)
    .sort((a,b) => b.total_profit - a.total_profit)
    .slice(0, Number(limit));

  res.json(result);
});

// GET /api/actions/profit-traps
router.get('/profit-traps', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) < 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const map = {};
  items.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!map[k]) map[k] = { product_desc: k, category: r.category, division: r.division, qty: 0, total_price: 0, total_cost: 0, total_profit: 0 };
    map[k].qty          += (r.qty || 0);
    map[k].total_price  += (r.total_price || 0);
    map[k].total_cost   += (r.total_cost || 0);
    map[k].total_profit += (r.total_profit || 0);
  });

  const result = Object.values(map)
    .sort((a,b) => a.total_profit - b.total_profit)
    .slice(0, Number(limit));

  res.json(result);
});

// POST /api/actions/simulate
// Profit simulator — compute projected profit changes
router.post('/simulate', (req, res) => {
  const { coldBrewBoost = 0, beverageShare = 0, pastryBundles = 0, reduceLowMargin = 0 } = req.body;

  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const totalProfit = items.reduce((s,r) => s + (r.total_profit||0), 0);

  // Cold brew boost: affects cold bar section items
  const coldBrewItems = items.filter(r => r.division === 'COLD BAR SECTION' && (r.total_profit||0) > 0);
  const cbProfit = coldBrewItems.reduce((s,r) => s + (r.total_profit||0), 0);
  const cbImpact = cbProfit * (coldBrewBoost / 100) * 0.18;

  // Beverage share shift
  const bevItems = items.filter(r => r.category === 'BEVERAGES' && (r.total_profit||0) > 0);
  const bevProfit = bevItems.reduce((s,r) => s + (r.total_profit||0), 0);
  const bevImpact = bevProfit * (beverageShare / 100) * 0.12;

  // Pastry bundles
  const pastryItems = items.filter(r => (r.division === 'COFFEE PASTRY' || r.division === 'CROISSANT' || r.division === 'FRENCH PASTRY') && (r.total_profit||0) > 0);
  const pastryProfit = pastryItems.reduce((s,r) => s + (r.total_profit||0), 0);
  const pastryImpact = pastryProfit * (pastryBundles / 100) * 0.22;

  // Reduce low margin: recover from loss leaders
  const lossItems = items.filter(r => (r.total_profit||0) < 0);
  const lossTotal = Math.abs(lossItems.reduce((s,r) => s + (r.total_profit||0), 0));
  const lossImpact = lossTotal * (reduceLowMargin / 100) * 0.7;

  const totalImpact = cbImpact + bevImpact + pastryImpact + lossImpact;
  const changePct   = totalProfit > 0 ? (totalImpact / totalProfit * 100) : 0;
  const confidence  = Math.min(95, 55 + (coldBrewBoost + beverageShare + pastryBundles + reduceLowMargin) / 10);

  res.json({
    predicted_profit_change: totalImpact,
    change_pct: changePct,
    confidence_pct: confidence,
    breakdown: {
      cold_brew:      cbImpact,
      beverage_shift: bevImpact,
      pastry_bundles: pastryImpact,
      loss_reduction: lossImpact,
    },
    base_profit: totalProfit,
    projected_profit: totalProfit + totalImpact,
  });
});

module.exports = router;
