const express = require('express');
const router = express.Router();
const { getDataset } = require('../utils/csvLoader');

const MONTH_ORDER = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// GET /api/monthly/trend?year=2025&branch=all
router.get('/trend', (req, res) => {
  const { year, branch } = req.query;
  let data = getDataset('monthly_sales_long.csv')
    .filter(r => r.period !== 'total_by_year' && r.row_type === 'branch');

  if (year)   data = data.filter(r => String(r.year) === String(year));
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
  let data = getDataset('monthly_sales_long.csv')
    .filter(r => r.period !== 'total_by_year' && r.row_type === 'branch');
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
  const { year = 2025 } = req.query;
  const wide = getDataset('monthly_sales_wide.csv')
    .filter(r => String(r.year) === String(year) && r.row_type === 'branch');

  const result = wide.map(r => {
    const months = {};
    MONTH_ORDER.forEach(m => { months[m] = r[m] || 0; });
    return { branch: r.branch, ...months, total_by_year: r.total_by_year || 0 };
  }).sort((a,b) => b.total_by_year - a.total_by_year);

  res.json(result);
});

// GET /api/monthly/branches?year=2025
router.get('/branches', (req, res) => {
  const { year = 2025 } = req.query;
  const wide = getDataset('monthly_sales_wide.csv')
    .filter(r => String(r.year) === String(year) && r.row_type === 'branch')
    .sort((a,b) => (b.total_by_year||0) - (a.total_by_year||0));

  res.json(wide.map(r => ({
    branch: r.branch,
    total: r.total_by_year || 0,
    jan: r.january || 0,
    feb: r.february || 0,
    mar: r.march || 0,
    apr: r.april || 0,
    may: r.may || 0,
    jun: r.june || 0,
    jul: r.july || 0,
    aug: r.august || 0,
    sep: r.september || 0,
    oct: r.october || 0,
    nov: r.november || 0,
    dec: r.december || 0,
  })));
});

module.exports = router;
