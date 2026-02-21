import React from 'react';
import { PageShell, Panel, Loader, ErrorMsg, ImpactBadge } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct, shortBranch } from '../utils/api';
import './Actions.css';

export default function Actions({ branch }) {
  const { data: recs,     loading: l1, error: e1 } = useData(() => api.recommendations({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: promote,  loading: l2, error: e2 } = useData(() => api.promoteOpportunities({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: traps,    loading: l3, error: e3 } = useData(() => api.profitTraps({ branch: branch !== 'all' ? branch : undefined }), [branch]);

  const impactTotal = React.useMemo(() => {
    if (!recs) return 0;
    return recs.reduce((s, r) => s + (r.estimated_impact || 0), 0);
  }, [recs]);

  return (
    <PageShell
      title="Action Generator"
      subtitle="AI-powered recommendations based on real profit and sales data"
      badge={`${(recs?.length || 0) + (promote?.length || 0) + (traps?.length || 0)} actions`}
    >
      {/* Summary strip */}
      <div className="action-summary-strip">
        <div className="action-summary-card">
          <div className="action-summary-label">Est. Monthly Uplift</div>
          <div className="action-summary-val green">{fmtM(impactTotal)} LBP</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Items to Promote</div>
          <div className="action-summary-val">{promote?.length || 0}</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Profit Traps Found</div>
          <div className="action-summary-val red">{traps?.length || 0}</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Top Recommendations</div>
          <div className="action-summary-val">{recs?.length || 0}</div>
        </div>
      </div>

      {/* AI Recommendations */}
      <Panel title="AI Recommendations" subtitle="Ranked by estimated profit impact">
        {l1 ? <Loader /> : e1 ? <ErrorMsg message={e1} /> : (
          <div className="action-cards">
            {(recs || []).map((r, i) => (
              <div key={i} className={`action-card action-card--${r.type || 'default'}`}>
                <div className="action-card-header">
                  <div className="action-card-icon">{actionIcon(r.type)}</div>
                  <div className="action-card-meta">
                    <div className="action-card-title">{r.title}</div>
                    <div className="action-card-sub">{r.category}</div>
                  </div>
                  <ImpactBadge value={r.estimated_impact} />
                </div>
                <p className="action-card-desc">{r.description}</p>
                {r.items && r.items.length > 0 && (
                  <div className="action-card-tags">
                    {r.items.slice(0, 4).map((item, j) => (
                      <span key={j} className="action-tag">{item}</span>
                    ))}
                    {r.items.length > 4 && <span className="action-tag action-tag--more">+{r.items.length - 4} more</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="actions-row">
        {/* Promote Opportunities */}
        <Panel title="Promote These Items" subtitle="High margin, under-performing volume">
          {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
            <div className="action-list">
              {(promote || []).map((p, i) => (
                <div key={i} className="action-list-item">
                  <div className="action-list-rank">#{i + 1}</div>
                  <div className="action-list-info">
                    <div className="action-list-name">{p.product_desc}</div>
                    <div className="action-list-meta">
                      {p.category} · {shortBranch(p.branch || 'All')} · Margin: {fmtPct(p.total_profit_pct)}
                    </div>
                  </div>
                  <div className="action-list-badge promote">PROMOTE</div>
                </div>
              ))}
              {(!promote || promote.length === 0) && (
                <div className="action-empty">No promotion opportunities found for current filter.</div>
              )}
            </div>
          )}
        </Panel>

        {/* Profit Traps */}
        <Panel title="Profit Traps" subtitle="Items draining profit — review or reprice">
          {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : (
            <div className="action-list">
              {(traps || []).map((p, i) => (
                <div key={i} className="action-list-item">
                  <div className="action-list-rank danger">#{i + 1}</div>
                  <div className="action-list-info">
                    <div className="action-list-name">{p.product_desc}</div>
                    <div className="action-list-meta">
                      {p.category} · Qty: {Math.round(p.qty).toLocaleString()} · Loss: {fmtM(Math.abs(p.total_profit))} LBP
                    </div>
                  </div>
                  <div className="action-list-badge trap">REVIEW</div>
                </div>
              ))}
              {(!traps || traps.length === 0) && (
                <div className="action-empty">No profit traps found — margins look healthy!</div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}

function actionIcon(type) {
  switch (type) {
    case 'promote':   return '🚀';
    case 'bundle':    return '📦';
    case 'reprice':   return '💰';
    case 'eliminate': return '⚠️';
    case 'expand':    return '📈';
    default:          return '💡';
  }
}
