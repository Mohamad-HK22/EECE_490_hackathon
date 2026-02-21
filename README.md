# Stories Profit Genome 🧬

**AI-powered profit intelligence dashboard for Stories Coffee**
Built for the POS Analytics Hackathon · Full-stack · React + Node.js · Real data

---

## Features

| Page | Description |
|------|-------------|
| **Executive Summary** | KPI cards, monthly trend chart, AI recommendations |
| **What Changed** | Year-over-year comparison, top performers, profit leaks |
| **Action Generator** | AI-ranked actions with estimated profit impact |
| **Profit Simulator** | Drag sliders to model operational changes in real time |
| **Group DNA** | Product group doughnut, category split, branch profiles |
| **Reports** | Stacked monthly chart, heatmap, full product table |

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
npm install
npm run install:all
```

### 2. Run in development mode

```bash
npm run dev
```

This starts:
- Backend API on **http://localhost:4000**
- Frontend dev server on **http://localhost:3000** (with hot reload)

### 3. Build for production

```bash
npm run build
npm start
```

The backend will serve the built React app at **http://localhost:4000**.

---

## Project Structure

```
stories-profit-genome/
├── backend/
│   ├── data/              ← CSV data files (loaded at startup)
│   ├── routes/            ← Express API route handlers
│   │   ├── kpi.js         ← GET /api/kpi/summary
│   │   ├── branches.js    ← GET /api/branches
│   │   ├── products.js    ← GET /api/products/top|loss-leaders|categories|groups
│   │   ├── monthly.js     ← GET /api/monthly/trend|yoy|heatmap|branches
│   │   └── actions.js     ← GET /api/actions/* + POST /api/actions/simulate
│   ├── utils/csvLoader.js ← CSV parser + in-memory cache
│   └── server.js          ← Express app entry point
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/    ← Layout, PageShell (reusable UI)
│       ├── hooks/         ← useData (data fetching hook)
│       ├── pages/         ← 6 page components
│       ├── utils/api.js   ← All API calls + formatters
│       ├── App.js         ← Root router
│       └── index.js       ← Entry point
├── package.json           ← Root monorepo scripts
└── docker-compose.yml     ← Optional Docker deployment
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kpi/summary` | Global KPI metrics |
| GET | `/api/branches` | All branches with totals |
| GET | `/api/branches/:branch/categories` | Category breakdown per branch |
| GET | `/api/branches/:branch/items` | Top items per branch |
| GET | `/api/products/top` | Top products by profit |
| GET | `/api/products/loss-leaders` | Negative-profit items |
| GET | `/api/products/categories` | Category aggregates |
| GET | `/api/products/groups` | Product group aggregates |
| GET | `/api/monthly/trend` | Monthly sales trend |
| GET | `/api/monthly/yoy` | Year-over-year data |
| GET | `/api/monthly/heatmap` | Branch × month heatmap |
| GET | `/api/monthly/branches` | Per-branch monthly sales |
| GET | `/api/actions/recommendations` | AI recommendations |
| GET | `/api/actions/promote-opportunities` | Items to promote |
| GET | `/api/actions/profit-traps` | Loss-making items |
| POST | `/api/actions/simulate` | Profit impact simulation |

### Simulate endpoint

```json
POST /api/actions/simulate
{
  "coldBrewBoost":   10,
  "beverageShare":    5,
  "pastryBundles":    0,
  "reduceLowMargin":  0
}
```

Returns: `{ currentProfit, estimatedUplift, projectedProfit, upliftPct, confidence, breakdown }`

---

## Data

The `backend/data/` folder contains 5 cleaned CSV exports from the Stories Coffee POS system:

| File | Description |
|------|-------------|
| `profit_by_item.csv` | 13 143 product-level profit rows |
| `monthly_sales_long.csv` | Monthly sales (long format, 2025–2026) |
| `monthly_sales_wide.csv` | Monthly sales (wide format, month columns) |
| `sales_by_group.csv` | Sales aggregated by product group |
| `profit_by_category.csv` | Category totals per branch |

---

## Docker Deployment

```bash
docker-compose up --build
```

App available at **http://localhost:4000**

---

## Tech Stack

- **Frontend:** React 18, Chart.js (react-chartjs-2), CSS custom properties
- **Backend:** Node.js, Express, csv-parse
- **Data:** Real Stories Coffee POS exports (25 branches, LBP currency)
