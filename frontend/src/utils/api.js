const BASE = "https://eece-490-hackathon-jd2g.onrender.com";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

function toQuery(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // KPI
  kpiSummary: ()                        => apiFetch('/api/kpi/summary'),

  // Branches
  branches: ()                          => apiFetch('/api/branches'),
  branchCategories: (b)                 => apiFetch(`/api/branches/${encodeURIComponent(b)}/categories`),
  branchItems: (b, params = {})         => apiFetch(`/api/branches/${encodeURIComponent(b)}/items${toQuery(params)}`),

  // Products
  topProducts: (params = {})            => apiFetch(`/api/products/top${toQuery(params)}`),
  lossLeaders: (params = {})            => apiFetch(`/api/products/loss-leaders${toQuery(params)}`),
  categories: (params = {})             => apiFetch(`/api/products/categories${toQuery(params)}`),
  groups: (params = {})                 => apiFetch(`/api/products/groups${toQuery(params)}`),

  // Monthly
  monthlyTrend: (params = {})           => apiFetch(`/api/monthly/trend${toQuery(params)}`),
  monthlyYoY: (params = {})             => apiFetch(`/api/monthly/yoy${toQuery(params)}`),
  monthlyHeatmap: (params = {})         => apiFetch(`/api/monthly/heatmap${toQuery(params)}`),
  monthlyBranches: (params = {})        => apiFetch(`/api/monthly/branches${toQuery(params)}`),

  // Actions (Menu Engineering)
  recommendations: (params = {})       => apiFetch(`/api/actions/recommendations${toQuery(params)}`),
  promoteOpportunities: (params = {})  => apiFetch(`/api/actions/promote-opportunities${toQuery(params)}`),
  profitTraps: (params = {})           => apiFetch(`/api/actions/profit-traps${toQuery(params)}`),
  simulate: (body)                     => apiFetch('/api/actions/simulate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }),

  // ML endpoints
  mlMetadata: ()                       => apiFetch('/api/ml/metadata'),
  mlMarginResiduals: (params = {})     => apiFetch(`/api/ml/margin-residuals${toQuery(params)}`),
  mlBranchClusters: ()                 => apiFetch('/api/ml/branch-clusters'),
  mlPriceAnomalies: (params = {})      => apiFetch(`/api/ml/price-anomalies${toQuery(params)}`),
  mlAvailabilityGaps: (params = {})    => apiFetch(`/api/ml/availability-gaps${toQuery(params)}`),
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
