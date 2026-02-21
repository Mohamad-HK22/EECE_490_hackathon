const BASE = process.env.REACT_APP_API_URL || '';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  // KPI
  kpiSummary: ()                        => apiFetch('/api/kpi/summary'),

  // Branches
  branches: ()                          => apiFetch('/api/branches'),
  branchCategories: (b)                 => apiFetch(`/api/branches/${encodeURIComponent(b)}/categories`),
  branchItems: (b, params = {})         => apiFetch(`/api/branches/${encodeURIComponent(b)}/items?${new URLSearchParams(params)}`),

  // Products
  topProducts: (params = {})            => apiFetch(`/api/products/top?${new URLSearchParams(params)}`),
  lossLeaders: (params = {})            => apiFetch(`/api/products/loss-leaders?${new URLSearchParams(params)}`),
  categories: (params = {})             => apiFetch(`/api/products/categories?${new URLSearchParams(params)}`),
  groups: (params = {})                 => apiFetch(`/api/products/groups?${new URLSearchParams(params)}`),

  // Monthly
  monthlyTrend: (params = {})           => apiFetch(`/api/monthly/trend?${new URLSearchParams(params)}`),
  monthlyYoY: (params = {})             => apiFetch(`/api/monthly/yoy?${new URLSearchParams(params)}`),
  monthlyHeatmap: (params = {})         => apiFetch(`/api/monthly/heatmap?${new URLSearchParams(params)}`),
  monthlyBranches: (params = {})        => apiFetch(`/api/monthly/branches?${new URLSearchParams(params)}`),

  // Actions (Menu Engineering)
  recommendations: (params = {})       => apiFetch(`/api/actions/recommendations?${new URLSearchParams(params)}`),
  promoteOpportunities: (params = {})  => apiFetch(`/api/actions/promote-opportunities?${new URLSearchParams(params)}`),
  profitTraps: (params = {})           => apiFetch(`/api/actions/profit-traps?${new URLSearchParams(params)}`),
  simulate: (body)                     => apiFetch('/api/actions/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),

  // ML endpoints
  mlMetadata: ()                       => apiFetch('/api/ml/metadata'),
  mlMarginResiduals: (params = {})     => apiFetch(`/api/ml/margin-residuals?${new URLSearchParams(params)}`),
  mlBranchClusters: ()                 => apiFetch('/api/ml/branch-clusters'),
  mlPriceAnomalies: (params = {})      => apiFetch(`/api/ml/price-anomalies?${new URLSearchParams(params)}`),
  mlAvailabilityGaps: (params = {})    => apiFetch(`/api/ml/availability-gaps?${new URLSearchParams(params)}`),
  mlSimulate: (body)                   => apiFetch('/api/ml/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),

  // Scenario simulator
  productCatalog: ()                   => apiFetch('/api/ml/product-catalog'),
  mlBranches: ()                       => apiFetch('/api/ml/branches'),
  simulateScenario: (body)             => apiFetch('/api/ml/simulate-scenario', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),
};

export function fmt(n, decimals = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en', { maximumFractionDigits: decimals });
}

export function fmtM(n) {
  if (!n) return '0';
  const m = n / 1_000_000;
  return m >= 1 ? m.toFixed(1) + 'M' : (n / 1_000).toFixed(0) + 'K';
}

export function fmtPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toFixed(decimals) + '%';
}

export function shortBranch(b) {
  return (b || '')
    .replace('Stories - ', '')
    .replace('Stories ', '')
    .replace('Stories.', 'HQ')
    .trim();
}
