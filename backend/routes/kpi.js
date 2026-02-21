const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/kpi/summary
// Returns top-level KPI cards
router.get('/summary', (req, res) => {
  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const cats  = getDataset('profit_by_category.csv');
  const ms    = getDataset('monthly_sales_long.csv');

  const totalProfit  = items.reduce((s, r) => s + (r.total_profit || 0), 0);
  const totalCost    = items.reduce((s, r) => s + (r.total_cost   || 0), 0);
  // Use true revenue proxy from the brief: revenue = cost + profit
  const totalRevenue = totalCost + totalProfit;
  const avgMargin    = totalRevenue > 0
    ? ((totalProfit / totalRevenue) * 100)
    : 0;

  // Best category by profit
  const catTotals = {};
  cats.filter(r => r.row_type === 'category').forEach(r => {
    catTotals[r.category] = (catTotals[r.category] || 0) + (r.total_profit || 0);
  });
  const topCategory = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0]?.[0] || 'BEVERAGES';

  // Optimization opportunity = sum of top improvable items (loss leaders absolute value)
  const lossLeaders = items
    .filter(r => (r.total_profit || 0) < 0)
    .reduce((s, r) => s + Math.abs(r.total_profit || 0), 0);

  // Best month 2025
  const ms2025 = ms.filter(r => r.year === 2025 && r.period_type === 'month');
  const monthlyMap = {};
  ms2025.forEach(r => {
    monthlyMap[r.period] = (monthlyMap[r.period] || 0) + (r.sales_amount || 0);
  });
  const bestMonth = Object.entries(monthlyMap).sort((a,b) => b[1]-a[1])[0]?.[0] || 'august';

  // YoY change
  const total2025 = ms.filter(r => r.year === 2025 && r.period_type === 'month')
    .reduce((s,r) => s + (r.sales_amount||0), 0);
  const total2026 = ms.filter(r => r.year === 2026 && r.period_type === 'month')
    .reduce((s,r) => s + (r.sales_amount||0), 0);
  const yoyChange = total2025 > 0 ? ((total2026 - total2025) / total2025 * 100) : 0;

  res.json({
    totalProfit,
    totalRevenue,
    totalCost,
    avgMarginPct: avgMargin,
    topCategory,
    optimizationOpportunity: lossLeaders,
    bestMonth,
    yoyChangePct: yoyChange,
    totalBranches: [...new Set(items.map(r => r.branch).filter(Boolean))].length,
    totalProducts: [...new Set(items.map(r => r.product_desc).filter(Boolean))].length,
  });
});

module.exports = router;
