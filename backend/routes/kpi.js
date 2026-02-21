const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

// GET /api/kpi/summary
// Returns top-level KPI cards
router.get('/summary', (req, res) => {
  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const cats  = getDataset('profit_by_category.csv');
  const ms    = getDataset('monthly_sales_long.csv')
    .filter(r => r.period_type === 'month');

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
  const topCategory = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0]?.[0]
    || Object.keys(catTotals)[0]
    || null;

  // Optimization opportunity = sum of top improvable items (loss leaders absolute value)
  const lossLeaders = items
    .filter(r => (r.total_profit || 0) < 0)
    .reduce((s, r) => s + Math.abs(r.total_profit || 0), 0);

  const years = [...new Set(ms.map(r => Number(r.year)).filter(Number.isFinite))].sort((a, b) => a - b);
  const latestYear = years[years.length - 1] ?? null;
  const previousYear = years.length > 1 ? years[years.length - 2] : null;

  // Best month for latest available year
  const msLatest = latestYear === null ? [] : ms.filter(r => Number(r.year) === latestYear);
  const monthlyMap = {};
  msLatest.forEach(r => {
    monthlyMap[r.period] = (monthlyMap[r.period] || 0) + (r.sales_amount || 0);
  });
  const bestMonth = Object.entries(monthlyMap).sort((a,b) => b[1]-a[1])[0]?.[0] || null;

  // YoY change between latest and previous available years
  const totalPrev = previousYear === null ? 0 : ms
    .filter(r => Number(r.year) === previousYear)
    .reduce((s,r) => s + (r.sales_amount||0), 0);
  const totalLatest = latestYear === null ? 0 : ms
    .filter(r => Number(r.year) === latestYear)
    .reduce((s,r) => s + (r.sales_amount||0), 0);
  const yoyChange = totalPrev > 0 ? ((totalLatest - totalPrev) / totalPrev * 100) : 0;

  res.json({
    totalProfit,
    totalRevenue,
    totalCost,
    avgMarginPct: avgMargin,
    topCategory,
    optimizationOpportunity: lossLeaders,
    bestMonth,
    bestMonthYear: latestYear,
    yoyChangePct: yoyChange,
    yoyBaseYear: previousYear,
    yoyCompareYear: latestYear,
    availableYears: years,
    totalBranches: [...new Set(items.map(r => r.branch).filter(Boolean))].length,
    totalProducts: [...new Set(items.map(r => r.product_desc).filter(Boolean))].length,
  });
});

module.exports = router;
