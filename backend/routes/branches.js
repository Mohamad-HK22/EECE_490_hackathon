const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/branches
router.get('/', (req, res) => {
  const cats = getDataset('profit_by_category.csv');
  const ms   = getDataset('monthly_sales_long.csv')
    .filter(r => r.period_type === 'month');

  const branchMap = {};
  const catMix = {};

  cats.filter(r => r.row_type === 'branch_total').forEach(r => {
    const trueRevenue = (r.total_cost || 0) + (r.total_profit || 0);
    branchMap[r.branch] = {
      branch: r.branch,
      total_profit: (branchMap[r.branch]?.total_profit || 0) + (r.total_profit || 0),
      total_revenue: (branchMap[r.branch]?.total_revenue || 0) + trueRevenue,
      total_qty: (branchMap[r.branch]?.total_qty || 0) + (r.qty || 0),
    };
  });

  cats.filter(r => r.row_type === 'category').forEach(r => {
    if (!catMix[r.branch]) catMix[r.branch] = { beverages: 0, food: 0, other: 0 };
    const p = r.total_profit || 0;
    if (r.category === 'BEVERAGES') catMix[r.branch].beverages += p;
    else if (r.category === 'FOOD') catMix[r.branch].food += p;
    else catMix[r.branch].other += p;
  });

  // Add sales for latest available year
  const years = [...new Set(ms.map(r => Number(r.year)).filter(Number.isFinite))].sort((a, b) => a - b);
  const latestYear = years[years.length - 1] ?? null;
  const salesByBranch = {};
  ms
    .filter(r => latestYear !== null && Number(r.year) === latestYear)
    .forEach(r => {
      salesByBranch[r.branch] = (salesByBranch[r.branch] || 0) + (r.sales_amount || 0);
    });

  // Keep backward compatibility with existing frontend field name.
  const sales2025ByBranch = {};
  ms
    .filter(r => Number(r.year) === 2025)
    .forEach(r => {
      sales2025ByBranch[r.branch] = (sales2025ByBranch[r.branch] || 0) + (r.sales_amount || 0);
  });

  const branches = Object.values(branchMap).map(b => ({
    ...b,
    sales_year: latestYear,
    sales_latest: salesByBranch[b.branch] || 0,
    sales_latest_year: latestYear,
    sales_2025: sales2025ByBranch[b.branch] || 0,
    bev_profit_pct: (() => {
      const mix = catMix[b.branch];
      if (!mix) return 0;
      const total = mix.beverages + mix.food + mix.other;
      return total > 0 ? (mix.beverages / total) * 100 : 0;
    })(),
    food_profit_pct: (() => {
      const mix = catMix[b.branch];
      if (!mix) return 0;
      const total = mix.beverages + mix.food + mix.other;
      return total > 0 ? (mix.food / total) * 100 : 0;
    })(),
    profit_margin_pct: b.total_revenue > 0
      ? (b.total_profit / b.total_revenue * 100)
      : 0,
  })).sort((a, b) => b.total_profit - a.total_profit);

  res.json(branches);
});

// GET /api/branches/:branch/categories
router.get('/:branch/categories', (req, res) => {
  const branch = decodeURIComponent(req.params.branch);
  const cats = getDataset('profit_by_category.csv')
    .filter(r => r.row_type === 'category' && r.branch === branch);
  res.json(cats);
});

// GET /api/branches/:branch/items
router.get('/:branch/items', (req, res) => {
  const branch = decodeURIComponent(req.params.branch);
  const { limit = 50, sort = 'profit' } = req.query;

  let items = getDataset('profit_by_item.csv')
    .filter(r => r.row_type === 'item' && r.branch === branch);

  if (sort === 'profit') items.sort((a,b) => (b.total_profit||0) - (a.total_profit||0));
  if (sort === 'qty')    items.sort((a,b) => (b.qty||0) - (a.qty||0));
  if (sort === 'margin') items.sort((a,b) => (b.total_profit_pct||0) - (a.total_profit_pct||0));

  res.json(items.slice(0, Number(limit)));
});

module.exports = router;
