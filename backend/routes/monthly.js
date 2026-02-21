const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

const MONTH_ORDER = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function getMonthlyBranchRows() {
  return getDataset('monthly_sales_long.csv')
    .filter(r => r.period_type === 'month' && r.row_type === 'branch');
}

function getAvailableYears(rows) {
  return [...new Set(rows.map(r => Number(r.year)).filter(Number.isFinite))].sort((a, b) => a - b);
}

function resolveYear(requested, rows) {
  const years = getAvailableYears(rows);
  if (!years.length) return null;
  if (requested !== undefined && requested !== null && requested !== '') {
    const parsed = Number(requested);
    if (Number.isFinite(parsed)) return parsed;
  }
  return years[years.length - 1];
}

// GET /api/monthly/trend?year=2025&branch=all
router.get('/trend', (req, res) => {
  const { year, branch } = req.query;
  const allRows = getMonthlyBranchRows();
  const selectedYear = resolveYear(year, allRows);
  let data = allRows;

  if (selectedYear !== null) data = data.filter(r => Number(r.year) === selectedYear);
  if (branch && branch !== 'all') data = data.filter(r => r.branch === branch);

  const monthMap = {};
  data.forEach(r => {
    const m = r.period;
    if (!monthMap[m]) monthMap[m] = { period: m, sales_amount: 0, month_number: r.month_number };
    monthMap[m].sales_amount += (r.sales_amount || 0);
  });

  const result = MONTH_ORDER
    .filter(m => monthMap[m])
    .map(m => monthMap[m]);

  res.json(result);
});

// GET /api/monthly/yoy
router.get('/yoy', (req, res) => {
  const { branch } = req.query;
  let data = getMonthlyBranchRows();
  if (branch && branch !== 'all') data = data.filter(r => r.branch === branch);

  const result = {};
  data.forEach(r => {
    const key = `${r.year}_${r.period}`;
    if (!result[key]) result[key] = { year: r.year, period: r.period, month_number: r.month_number, sales_amount: 0 };
    result[key].sales_amount += (r.sales_amount || 0);
  });

  const sorted = Object.values(result).sort((a,b) => {
    if (a.year !== b.year) return a.year - b.year;
    return MONTH_ORDER.indexOf(a.period) - MONTH_ORDER.indexOf(b.period);
  });

  res.json(sorted);
});

// GET /api/monthly/heatmap?year=2025
router.get('/heatmap', (req, res) => {
  const { year, branch } = req.query;
  const allRows = getMonthlyBranchRows();
  const selectedYear = resolveYear(year, allRows);
  let data = allRows;
  if (selectedYear !== null) data = data.filter(r => Number(r.year) === selectedYear);
  if (branch && branch !== 'all') data = data.filter(r => r.branch === branch);

  const result = data
    .map(r => ({
      branch: r.branch,
      year: r.year,
      period: r.period,
      month_number: r.month_number,
      sales_amount: r.sales_amount || 0,
    }))
    .sort((a,b) => {
      if (a.branch !== b.branch) return String(a.branch).localeCompare(String(b.branch));
      return (a.month_number || 0) - (b.month_number || 0);
    });

  res.json(result);
});

// GET /api/monthly/branches?year=2025&limit=6
router.get('/branches', (req, res) => {
  const { year, branch, limit } = req.query;
  const monthlyRows = getMonthlyBranchRows();
  const selectedYear = resolveYear(year, monthlyRows);
  if (selectedYear === null) return res.json([]);
  const n = Number(limit);
  const hasLimit = Number.isFinite(n) && n > 0;

  let topBranches;
  if (branch && branch !== 'all') {
    topBranches = [branch];
  } else {
    const wide = getDataset('monthly_sales_wide.csv')
      .filter(r => Number(r.year) === selectedYear && r.row_type === 'branch')
      .sort((a,b) => (b.total_by_year||0) - (a.total_by_year||0))
      .slice(0, hasLimit ? n : undefined);
    topBranches = wide.map(r => r.branch);
  }

  const result = monthlyRows
    .filter(r => Number(r.year) === selectedYear && topBranches.includes(r.branch))
    .map(r => ({
      branch: r.branch,
      year: r.year,
      period: r.period,
      month_number: r.month_number,
      sales_amount: r.sales_amount || 0,
    }))
    .sort((a,b) => {
      if (a.branch !== b.branch) return String(a.branch).localeCompare(String(b.branch));
      return (a.month_number || 0) - (b.month_number || 0);
    });

  res.json(result);
});

module.exports = router;
