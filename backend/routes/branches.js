const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/branches
router.get('/', (req, res) => {
  const cats = getDataset('profit_by_category.csv');
  const ms   = getDataset('monthly_sales_long.csv');

  const branchMap = {};
  cats.filter(r => r.row_type === 'branch_total').forEach(r => {
    branchMap[r.branch] = {
      branch: r.branch,
      total_profit: (branchMap[r.branch]?.total_profit || 0) + (r.total_profit || 0),
      total_revenue: (branchMap[r.branch]?.total_revenue || 0) + (r.total_price || 0),
      total_qty: (branchMap[r.branch]?.total_qty || 0) + (r.qty || 0),
    };
  });

  // Add 2025 sales from monthly
  const ms2025 = ms.filter(r => r.year === 2025 && r.period !== 'total_by_year');
  const salesByBranch = {};
  ms2025.forEach(r => {
    salesByBranch[r.branch] = (salesByBranch[r.branch] || 0) + (r.sales_amount || 0);
  });

  const branches = Object.values(branchMap).map(b => ({
    ...b,
    sales_2025: salesByBranch[b.branch] || 0,
    profit_margin_pct: b.total_revenue > 0
      ? (b.total_profit / (b.total_profit + b.total_revenue) * 100)
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
