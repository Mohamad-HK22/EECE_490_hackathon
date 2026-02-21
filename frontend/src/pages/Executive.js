import React, { useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend, ArcElement
} from 'chart.js';
import { PageShell, KpiGrid, KpiCard, Panel, Loader, ErrorMsg, ImpactBadge } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct, shortBranch } from '../utils/api';
import './Executive.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ArcElement);

const MONTH_LABELS = { january:'Jan', february:'Feb', march:'Mar', april:'Apr', may:'May',
  june:'Jun', july:'Jul', august:'Aug', september:'Sep', october:'Oct', november:'Nov', december:'Dec' };

export default function Executive({ branch }) {
  const [trendYear, setTrendYear] = useState('2025');

  const { data: kpi,     loading: l1, error: e1 } = useData(() => api.kpiSummary(), []);
  const { data: trend,   loading: l2, error: e2 } = useData(() => api.monthlyTrend({ year: trendYear, branch }), [trendYear, branch]);
  const { data: recs,    loading: l3, error: e3 } = useData(() => api.recommendations({ branch }), [branch]);
  const { data: cats,    loading: l4 }             = useData(() => api.categories({ branch }), [branch]);
  const { data: mlMeta }                           = useData(() => api.mlMetadata(), []);

  if (l1) return <Loader />;
  if (e1) return <ErrorMsg message={e1} />;

  const chartData = {
    labels: (trend || []).map(r => MONTH_LABELS[r.period] || r.period),
    datasets: [{
      data: (trend || []).map(r => r.sales_amount),
      borderColor: '#166534',
      borderWidth: 2.5,
      backgroundColor: (ctx) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
        g.addColorStop(0, 'rgba(22,101,52,0.18)');
        g.addColorStop(1, 'rgba(22,101,52,0)');
        return g;
      },
      fill: true, tension: 0.42,
      pointBackgroundColor: '#166534', pointBorderColor: '#fff',
      pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7,
    }]
  };
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#14532d', titleColor: 'rgba(255,255,255,0.7)', bodyColor: '#fff',
        padding: 12, cornerRadius: 10,
        callbacks: { label: ctx => ' ' + fmtM(ctx.parsed.y) + ' LBP' }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false },
        ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => fmtM(v) }
      }
    }
  };

  // Category donut
  const catColors = ['#166534', '#b8974e', '#22c55e', '#3b82f6'];
  const donutData = cats ? {
    labels: cats.map(c => c.category),
    datasets: [{ data: cats.map(c => c.total_profit), backgroundColor: catColors, borderWidth: 0, hoverOffset: 6 }]
  } : null;

  // recommendations is now a flat sorted array
  const allRecs = Array.isArray(recs) ? recs : [];

  return (
    <PageShell title="Executive Summary" subtitle="AI-powered profit intelligence · Real Stories Coffee data" badge="● Live Data">

      {/* ML Model Strip */}
      {mlMeta && (
        <div className="exec-ml-strip">
          <span className="exec-ml-badge">🤖 ML Models Active</span>
          <span>Random Forest R²={mlMeta.model_r2} · {mlMeta.n_samples?.toLocaleString()} training rows</span>
          <span>·</span>
          <span>Total addressable pool: <strong>{fmtM(Object.values(mlMeta.pools || {}).reduce((s,v)=>s+v,0))} LBP</strong></span>
          <span>·</span>
          <span>Margin residuals: {fmtM(mlMeta.pools?.margin_residual)} · Price anomalies: {fmtM(mlMeta.pools?.price_standardization)} · Availability: {fmtM(mlMeta.pools?.availability_gap)}</span>
        </div>
      )}

      {/* KPI Cards */}
      <KpiGrid>
        <KpiCard label="Total Profit"        value={fmtM(kpi.totalProfit) + ' LBP'} icon="💰" trend={kpi.yoyChangePct} trendLabel="YoY" />
        <KpiCard label="Avg Profit Margin"   value={fmtPct(kpi.avgMarginPct)}        icon="📈" trend={kpi.avgMarginPct - 65} trendLabel="vs 65% target" />
        <KpiCard label="Top Category"        value={kpi.topCategory}                 icon="☕" />
        <KpiCard label="Opportunity"         value={fmtM(kpi.optimizationOpportunity) + ' LBP'} icon="🎯" accent />
      </KpiGrid>

      {/* Trend Chart */}
      <Panel
        title="Monthly Sales Trend"
        subtitle="Total sales across all branches"
        actions={
          <div className="pill-group">
            {['2025','2026'].map(y => (
              <button key={y} className={`pill-btn ${trendYear === y ? 'active' : ''}`} onClick={() => setTrendYear(y)}>{y}</button>
            ))}
          </div>
        }
      >
        {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
          <div style={{ height: 220 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </Panel>

      {/* Category + KPIs row */}
      <div className="exec-row">
        <Panel title="Category Profit Mix" subtitle="Profit contribution by category" className="flex-panel">
          {l4 || !donutData ? <Loader /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ height: 160, width: 160, flexShrink: 0 }}>
                <Doughnut data={donutData} options={{ cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmtM(c.parsed) + ' LBP' } } } }} />
              </div>
              <div style={{ flex: 1 }}>
                {(cats || []).map((c, i) => (
                  <div key={c.category} className="cat-row">
                    <span className="cat-dot" style={{ background: catColors[i] }} />
                    <span className="cat-name">{c.category}</span>
                    <span className="cat-val">{fmtM(c.total_profit)}</span>
                    <span className="cat-pct">{fmtPct(c.total_profit / (cats.reduce((s,x)=>s+(x.total_profit||0),0)||1) * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Branch Stats" subtitle="Total branches & products" className="flex-panel">
          <div className="stat-grid">
            <div className="stat-item">
              <div className="stat-val">{kpi.totalBranches}</div>
              <div className="stat-lbl">Active Branches</div>
            </div>
            <div className="stat-item">
              <div className="stat-val">{kpi.totalProducts}</div>
              <div className="stat-lbl">Products Tracked</div>
            </div>
            <div className="stat-item">
              <div className="stat-val">{fmtM(kpi.totalRevenue)}</div>
              <div className="stat-lbl">Total Revenue (LBP)</div>
            </div>
            <div className="stat-item">
              <div className="stat-val">{kpi.bestMonth?.charAt(0).toUpperCase() + (kpi.bestMonth?.slice(1) || '')}</div>
              <div className="stat-lbl">Best Month 2025</div>
            </div>
          </div>
        </Panel>
      </div>

      {/* AI Recommendations */}
      {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : (
        <div>
          <div className="section-title">AI Recommendations <span className="ai-chip">AI</span></div>
          <div className="rec-grid">
            {allRecs.slice(0, 3).map((r, i) => (
              <div key={i} className={`rec-card rec-card--${r.type}`}>
                <div className="rec-icon">{r.icon}</div>
                <div className="rec-title">{r.title}</div>
                <div className="rec-desc">{r.description}</div>
                <ImpactBadge value={Math.round(r.impact)} />
                {r.product && r.type !== 'optimize' && (
                  <div className="rec-meta">
                    {r.category && <span className="trait-badge green">{r.category}</span>}
                    {r.division && <span className="trait-badge blue">{r.division?.slice(0,20)}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
