require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const kpiRoutes      = require('./routes/kpi');
const branchRoutes   = require('./routes/branches');
const productRoutes  = require('./routes/products');
const monthlyRoutes  = require('./routes/monthly');
const actionRoutes   = require('./routes/actions');
const mlRoutes       = require('./routes/ml');

const app  = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// API Routes
app.use('/api/kpi',      kpiRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/products', productRoutes);
app.use('/api/monthly',  monthlyRoutes);
app.use('/api/actions',  actionRoutes);
app.use('/api/ml',       mlRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 Stories Profit Genome API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   KPIs:   http://localhost:${PORT}/api/kpi/summary\n`);
});

module.exports = app;
