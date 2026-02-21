const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/products/top?limit=15&sort=profit
router.get('/top', (req, res) => {
  const { limit = 15, sort = 'profit', category, branch } = req.query;

  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  if (category) items = items.filter(r => r.category === category);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  // Aggregate by product
  const map = {};
  items.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!map[k]) map[k] = { product_desc: k, category: r.category, division: r.division, qty: 0, total_price: 0, total_cost: 0, total_profit: 0, true_revenue: 0, branch_count: new Set() };
    map[k].qty           += (r.qty || 0);
    map[k].total_price   += (r.total_price || 0);
    map[k].total_cost    += (r.total_cost || 0);
    map[k].total_profit  += (r.total_profit || 0);
    map[k].true_revenue  += ((r.total_cost || 0) + (r.total_profit || 0));
    map[k].branch_count.add(r.branch);
  });

  let products = Object.values(map).map(p => ({
    ...p,
    branch_count: p.branch_count.size,
    profit_margin_pct: p.true_revenue > 0
      ? (p.total_profit / p.true_revenue * 100)
      : (p.total_profit < 0 ? -100 : 0),
    // Keep backward-compatible name used in some pages.
    total_profit_pct: p.true_revenue > 0
      ? (p.total_profit / p.true_revenue * 100)
      : (p.total_profit < 0 ? -100 : 0),
  }));

  if (sort === 'profit') products.sort((a,b) => b.total_profit - a.total_profit);
  if (sort === 'qty')    products.sort((a,b) => b.qty - a.qty);
  if (sort === 'margin') products.sort((a,b) => b.profit_margin_pct - a.profit_margin_pct);
  if (sort === 'loss')   products.sort((a,b) => a.total_profit - b.total_profit);

  res.json(products.slice(0, Number(limit)));
});

// GET /api/products/loss-leaders?limit=15
router.get('/loss-leaders', (req, res) => {
  const { limit = 15, branch } = req.query;

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

  const products = Object.values(map)
    .filter(p => p.total_profit < 0)
    .sort((a,b) => a.total_profit - b.total_profit)
    .slice(0, Number(limit));

  res.json(products);
});

// GET /api/products/categories
router.get('/categories', (req, res) => {
  const cats = getDataset('profit_by_category.csv');
  const { branch } = req.query;

  let data = cats.filter(r => r.row_type === 'category');
  if (branch && branch !== 'all') data = data.filter(r => r.branch === branch);

  const map = {};
  const branchSets = {};
  data.forEach(r => {
    const k = r.category;
    if (!k) return;
    if (!map[k]) map[k] = { category: k, qty: 0, total_price: 0, total_cost: 0, total_profit: 0, true_revenue: 0 };
    if (!branchSets[k]) branchSets[k] = new Set();
    map[k].qty          += (r.qty || 0);
    map[k].total_price  += (r.total_price || 0);
    map[k].total_cost   += (r.total_cost || 0);
    map[k].total_profit += (r.total_profit || 0);
    map[k].true_revenue += ((r.total_cost || 0) + (r.total_profit || 0));
    branchSets[k].add(r.branch);
  });

  const result = Object.values(map).map(c => ({
    ...c,
    branch_count: branchSets[c.category] ? branchSets[c.category].size : 0,
    avg_margin_pct: c.true_revenue > 0 ? (c.total_profit / c.true_revenue * 100) : 0,
    profit_margin_pct: c.true_revenue > 0 ? (c.total_profit / c.true_revenue * 100) : 0,
  })).sort((a,b) => b.total_profit - a.total_profit);

  res.json(result);
});

// GET /api/products/groups?limit=15
router.get('/groups', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('sales_by_group.csv').filter(r => r.row_type === 'item');
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const map = {};
  items.forEach(r => {
    const k = r.group;
    if (!k) return;
    if (!map[k]) map[k] = { group: k, division: r.division, qty: 0, total_amount: 0, product_count: new Set() };
    map[k].qty          += (r.qty || 0);
    map[k].total_amount += (r.total_amount || 0);
    map[k].product_count.add(r.description);
  });

  const result = Object.values(map)
    .map(g => ({
      ...g,
      product_count: g.product_count.size,
      // Frontend expects total_profit-style field for visualization.
      total_profit: g.total_amount,
    }))
    .sort((a,b) => b.total_amount - a.total_amount)
    .slice(0, Number(limit));

  res.json(result);
});

module.exports = router;
