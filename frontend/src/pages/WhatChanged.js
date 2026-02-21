import React from 'react';
import { PageShell, Panel, Loader, ErrorMsg } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct, shortBranch } from '../utils/api';
import './WhatChanged.css';

export default function WhatChanged({ branch }) {
  const { data: top,     loading: l1, error: e1 } = useData(() => api.topProducts({ limit: 10, sort: 'profit', branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: losses,  loading: l2, error: e2 } = useData(() => api.lossLeaders({ limit: 10, branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: yoy,     loading: l3, error: e3 } = useData(() => api.monthlyYoY({ branch }), [branch]);
  const { data: branchs, loading: l4 }             = useData(() => api.branches(), []);

  // Compute YoY changes per month
  const yoyChanges = React.useMemo(() => {
    if (!yoy) return [];
    const by = {};
    yoy.forEach(r => {
      const k = r.period;
      if (!by[k]) by[k] = {};
      by[k][r.year] = (by[k][r.year] || 0) + r.sales_amount;
    });
    return Object.entries(by)
      .map(([period, years]) => {
        const s25 = years[2025] || 0;
        const s26 = years[2026] || 0;
        const pct = s25 > 0 ? ((s26 - s25) / s25 * 100) : null;
        return { period, s25, s26, pct };
      })
      .filter(r => r.s25 > 0 && r.s26 > 0)
      .sort((a,b) => (b.pct||0) - (a.pct||0));
  }, [yoy]);

  // Branch movers
  const branchMovers = React.useMemo(() => {
    if (!branchs) return [];
    return [...branchs].sort((a,b) => b.total_profit - a.total_profit).slice(0, 8);
  }, [branchs]);

  return (
    <PageShell title="What Changed" subtitle="Significant movements in profit, sales, and product performance" badge={`${yoyChanges.length + (top?.length||0)} signals`}>

      {/* YoY Month Comparison */}
      <Panel title="Year-over-Year: Monthly Sales" subtitle="2025 vs 2026 (where 2026 data available)">
        {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : yoyChanges.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>No overlapping months between 2025 and 2026 for selected branch.</div>
        ) : (
          <div className="change-list">
            {yoyChanges.map(r => (
              <div key={r.period} className="change-item">
                <div className={`change-dot ${(r.pct||0) >= 0 ? 'up' : 'down'}`} />
                <div className="change-content">
                  <div className="change-title">{r.period.charAt(0).toUpperCase() + r.period.slice(1)} — YoY Sales</div>
                  <div className="change-desc">2025: {fmtM(r.s25)} LBP &nbsp;→&nbsp; 2026: {fmtM(r.s26)} LBP</div>
                </div>
                <div className={`change-delta ${(r.pct||0) >= 0 ? 'up' : 'down'}`}>
                  {r.pct !== null ? ((r.pct >= 0 ? '+' : '') + r.pct.toFixed(1) + '%') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Top + Loss Leaders side by side */}
      <div className="changed-row">
        <Panel title="Top Profit Performers" subtitle="Highest profit-generating products">
          {l1 ? <Loader /> : e1 ? <ErrorMsg message={e1} /> : (
            <div className="change-list">
              {(top||[]).map((p,i) => (
                <div key={p.product_desc} className="change-item">
                  <div className="change-rank">#{i+1}</div>
                  <div className="change-content">
                    <div className="change-title">{p.product_desc}</div>
                    <div className="change-desc">{p.category} · {p.branch_count} branch{p.branch_count !== 1 ? 'es' : ''} · Qty: {Math.round(p.qty).toLocaleString()}</div>
                  </div>
                  <div className="change-delta up">{fmtM(p.total_profit)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Profit Leaks" subtitle="Items with negative profit contribution">
          {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
            <div className="change-list">
              {(losses||[]).map((p,i) => (
                <div key={p.product_desc} className="change-item">
                  <div className="change-dot down" />
                  <div className="change-content">
                    <div className="change-title">{p.product_desc}</div>
                    <div className="change-desc">{p.category} · Qty: {Math.round(p.qty).toLocaleString()} · COGS exceeds revenue</div>
                  </div>
                  <div className="change-delta down">{fmtM(p.total_profit)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Branch Rankings */}
      <Panel title="Branch Profitability Ranking" subtitle="Sorted by total profit contribution">
        {l4 ? <Loader /> : (
          <div className="branch-rank-list">
            {branchMovers.map((b, i) => (
              <div key={b.branch} className="branch-rank-item">
                <div className="branch-rank-num">{i+1}</div>
                <div className="branch-rank-info">
                  <div className="branch-rank-name">{b.branch}</div>
                  <div className="branch-rank-bar-wrap">
                    <div className="branch-rank-bar" style={{ width: `${Math.min(100, (b.total_profit / branchMovers[0]?.total_profit) * 100)}%` }} />
                  </div>
                </div>
                <div className="branch-rank-val">{fmtM(b.total_profit)} LBP</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
