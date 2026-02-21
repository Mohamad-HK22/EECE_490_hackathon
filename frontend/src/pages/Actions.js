import React, { useState } from 'react';
import { PageShell, Panel, Loader, ErrorMsg, ImpactBadge } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct, shortBranch } from '../utils/api';
import './Actions.css';

const TABS = [
  { key: 'overview',     label: 'Overview' },
  { key: 'margin',       label: '🤖 Margin Gaps' },
  { key: 'price',        label: '💰 Price Anomalies' },
  { key: 'availability', label: '🗺️ Missing Products' },
  { key: 'clusters',     label: '📊 Branch Clusters' },
];

export default function Actions({ branch }) {
  const [tab, setTab] = useState('overview');

  const { data: recs,      loading: l1, error: e1 } = useData(() => api.recommendations({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: residuals, loading: l2, error: e2 } = useData(() => api.mlMarginResiduals({ branch: branch !== 'all' ? branch : undefined, limit: 30 }), [branch]);
  const { data: prices,    loading: l3, error: e3 } = useData(() => api.mlPriceAnomalies({ branch: branch !== 'all' ? branch : undefined, limit: 30 }), [branch]);
  const { data: avail,     loading: l4, error: e4 } = useData(() => api.mlAvailabilityGaps({ limit: 30 }), []);
  const { data: clusters,  loading: l5, error: e5 } = useData(() => api.mlBranchClusters(), []);
  const { data: mlMeta }                             = useData(() => api.mlMetadata(), []);

  const impactTotal      = React.useMemo(() => (recs      || []).reduce((s, r) => s + (r.estimated_impact   || 0), 0), [recs]);
  const totalPricePool   = React.useMemo(() => (prices    || []).reduce((s, r) => s + (r.profit_gain        || 0), 0), [prices]);
  const totalAvailPool   = React.useMemo(() => (avail     || []).reduce((s, r) => s + (r.expected_profit    || 0), 0), [avail]);
  const totalResidualPool = mlMeta?.pools?.margin_residual || 0;

  return (
    <PageShell
      title="Action Generator"
      subtitle="ML-powered recommendations — every action is traceable to a trained model"
      badge={`Model R²=${mlMeta?.model_r2 ?? '…'}`}
    >
      {/* Summary strip */}
      <div className="action-summary-strip">
        <div className="action-summary-card">
          <div className="action-summary-label">Menu Engineering</div>
          <div className="action-summary-val green">{fmtM(impactTotal)} LBP</div>
          <div className="action-summary-sub">estimated uplift</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Margin Residuals (RF)</div>
          <div className="action-summary-val">{fmtM(totalResidualPool)} LBP</div>
          <div className="action-summary-sub">gap pool · R²={mlMeta?.model_r2}</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Price Anomalies</div>
          <div className="action-summary-val orange">{fmtM(totalPricePool)} LBP</div>
          <div className="action-summary-sub">{prices?.length || 0} pairs flagged</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Availability Gap</div>
          <div className="action-summary-val blue">{fmtM(totalAvailPool)} LBP</div>
          <div className="action-summary-sub">{avail?.length || 0} products missing</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="action-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`action-tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <Panel title="AI Recommendations" subtitle="Menu Engineering Matrix — Stars, Puzzles, Plowhorses, Dogs">
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
                        {r.items.length > 4 && <span className="action-tag action-tag--more">+{r.items.length - 4}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="actions-row">
            <Panel title="Top Margin Residual" subtitle="Biggest RF model gap — address first">
              {l2 ? <Loader /> : residuals?.[0] ? (
                <MLSingleCard icon="🤖" color="#166534"
                  product={residuals[0].product_desc} branch={residuals[0].branch}
                  label1="Actual Margin"   val1={`${residuals[0].actual_margin?.toFixed(1)}%`}
                  label2="Model Predicts"  val2={`${residuals[0].pred_margin?.toFixed(1)}%`}
                  label3="Uplift Pool"     val3={fmtM(residuals[0].uplift_potential) + ' LBP'} />
              ) : <div className="action-empty">No residuals for this filter.</div>}
            </Panel>
            <Panel title="Top Price Anomaly" subtitle="Highest profit gain from repricing">
              {l3 ? <Loader /> : prices?.[0] ? (
                <MLSingleCard icon="💰" color="#b8974e"
                  product={prices[0].product} branch={prices[0].branch}
                  label1="Current Price"  val1={`${prices[0].actual_price} LBP`}
                  label2="Target (p75)"   val2={`${prices[0].target_price} LBP`}
                  label3="Profit Gain"    val3={fmtM(prices[0].profit_gain) + ' LBP'} />
              ) : <div className="action-empty">No price anomalies for this filter.</div>}
            </Panel>
            <Panel title="Top Availability Gap" subtitle="Highest expected profit from rollout">
              {l4 ? <Loader /> : avail?.[0] ? (
                <MLSingleCard icon="🗺️" color="#0ea5e9"
                  product={avail[0].product} branch={`Missing from ${avail[0].n_missing} branches`}
                  label1="Present branches" val1={`${avail[0].n_present}/25`}
                  label2="Avg margin"       val2={`${avail[0].avg_margin?.toFixed(1)}%`}
                  label3="Expected profit"  val3={fmtM(avail[0].expected_profit) + ' LBP'} />
              ) : <div className="action-empty">No availability gaps found.</div>}
            </Panel>
          </div>
        </>
      )}

      {/* ── Margin Gaps ───────────────────────────────────────────────────── */}
      {tab === 'margin' && (
        <Panel title="Margin Residuals" subtitle={`RF R²=${mlMeta?.model_r2} — pairs where actual margin < predicted margin`}>
          {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead><tr><th>#</th><th>Product</th><th>Branch</th><th>Division</th><th>Actual %</th><th>Predicted %</th><th>Gap</th><th>Uplift Pool</th></tr></thead>
                <tbody>
                  {(residuals || []).map((r, i) => (
                    <tr key={i}>
                      <td className="ml-rank">{i + 1}</td>
                      <td className="ml-product">{r.product_desc}</td>
                      <td className="ml-branch">{shortBranch(r.branch)}</td>
                      <td><span className="trait-badge green">{r.division?.slice(0, 16)}</span></td>
                      <td className="ml-num">{r.actual_margin?.toFixed(1)}%</td>
                      <td className="ml-num pred">{r.pred_margin?.toFixed(1)}%</td>
                      <td className="ml-num gap">+{r.gap_pct?.toFixed(1)}pp</td>
                      <td className="ml-num highlight">{fmtM(r.uplift_potential)} LBP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ── Price Anomalies ───────────────────────────────────────────────── */}
      {tab === 'price' && (
        <Panel title="Price Anomalies" subtitle="Branches pricing below network p25 — raise to p75">
          {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead><tr><th>#</th><th>Product</th><th>Branch</th><th>Current Price</th><th>Target (p75)</th><th>Gap %</th><th>Qty</th><th>Profit Gain</th></tr></thead>
                <tbody>
                  {(prices || []).map((r, i) => (
                    <tr key={i}>
                      <td className="ml-rank">{i + 1}</td>
                      <td className="ml-product">{r.product}</td>
                      <td className="ml-branch">{shortBranch(r.branch)}</td>
                      <td className="ml-num">{r.actual_price} LBP</td>
                      <td className="ml-num pred">{r.target_price} LBP</td>
                      <td className="ml-num gap">+{r.gap_pct?.toFixed(1)}%</td>
                      <td className="ml-num">{r.qty?.toLocaleString()}</td>
                      <td className="ml-num highlight">{fmtM(r.profit_gain)} LBP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ── Availability ──────────────────────────────────────────────────── */}
      {tab === 'availability' && (
        <Panel title="Availability Gaps" subtitle="Products not in all 25 branches — branch-revenue weighted regression">
          {l4 ? <Loader /> : e4 ? <ErrorMsg message={e4} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead><tr><th>#</th><th>Product</th><th>Division</th><th>Present</th><th>Missing</th><th>Avg Margin</th><th>Per Branch</th><th>Expected Uplift</th></tr></thead>
                <tbody>
                  {(avail || []).map((r, i) => (
                    <tr key={i}>
                      <td className="ml-rank">{i + 1}</td>
                      <td className="ml-product">{r.product}</td>
                      <td><span className="trait-badge blue">{r.division?.slice(0, 16)}</span></td>
                      <td className="ml-num">{r.n_present}/25</td>
                      <td className="ml-num gap">{r.n_missing}</td>
                      <td className="ml-num">{r.avg_margin?.toFixed(1)}%</td>
                      <td className="ml-num">{fmtM(r.avg_profit_per_branch)}</td>
                      <td className="ml-num highlight">{fmtM(r.expected_profit)} LBP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ── Clusters ──────────────────────────────────────────────────────── */}
      {tab === 'clusters' && (
        <>
          {l5 ? <Loader /> : e5 ? <ErrorMsg message={e5} /> : clusters && (
            <>
              <Panel title="Branch Cluster Summary" subtitle="KMeans (k=4) on division profit mix">
                <div className="cluster-summary-grid">
                  {(clusters.summary || []).map((c, i) => {
                    const isBest = c.cluster === clusters.best_cluster;
                    return (
                      <div key={i} className={`cluster-card ${isBest ? 'cluster-card--best' : ''}`}>
                        <div className="cluster-card-header">
                          <span className="cluster-label">Cluster {c.cluster}</span>
                          {isBest && <span className="cluster-best-badge">BEST</span>}
                        </div>
                        <div className="cluster-margin">{c.avg_margin?.toFixed(2)}%</div>
                        <div className="cluster-meta">
                          <span>{c.n_branches} branches</span>
                          <span>Avg rev: {fmtM(c.avg_revenue)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {clusters.best_cluster_drivers && (
                  <div className="cluster-drivers">
                    <div className="cluster-drivers-title">Divisions over-represented in best cluster:</div>
                    <div className="cluster-drivers-list">
                      {clusters.best_cluster_drivers.map((d, i) => (
                        <span key={i} className="trait-badge green">{d}</span>
                      ))}
                    </div>
                    <div className="cluster-drivers-note">
                      Branches in lower clusters should increase these divisions to close the margin gap.
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Branch Cluster Assignments" subtitle="Margin gap per branch to the best cluster">
                <div className="ml-table-wrap">
                  <table className="ml-table">
                    <thead><tr><th>Branch</th><th>Cluster</th><th>Actual Margin</th><th>Gap (pp)</th><th>Gap (LBP)</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {(clusters.branches || []).sort((a, b) => b.gap_lbp - a.gap_lbp).map((r, i) => (
                        <tr key={i} className={r.cluster === clusters.best_cluster ? 'row-best' : ''}>
                          <td className="ml-product">{shortBranch(r.branch)}</td>
                          <td className="ml-num">
                            <span className={`cluster-badge cluster-badge--${r.cluster}`}>
                              C{r.cluster}{r.cluster === clusters.best_cluster ? ' ★' : ''}
                            </span>
                          </td>
                          <td className="ml-num">{r.actual_margin?.toFixed(2)}%</td>
                          <td className="ml-num gap">{r.margin_gap > 0 ? `+${r.margin_gap?.toFixed(2)}pp` : '—'}</td>
                          <td className="ml-num highlight">{r.gap_lbp > 0 ? fmtM(r.gap_lbp) + ' LBP' : '—'}</td>
                          <td className="ml-num">{fmtM(r.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}

function MLSingleCard({ icon, product, branch, label1, val1, label2, val2, label3, val3, color }) {
  return (
    <div className="ml-single-card">
      <div className="ml-single-header">
        <span className="ml-single-icon">{icon}</span>
        <div>
          <div className="ml-single-product">{product}</div>
          <div className="ml-single-branch">{shortBranch(branch)}</div>
        </div>
      </div>
      <div className="ml-single-stats">
        <div className="ml-single-stat"><span className="ml-single-lbl">{label1}</span><span className="ml-single-val">{val1}</span></div>
        <div className="ml-single-stat"><span className="ml-single-lbl">{label2}</span><span className="ml-single-val" style={{ color }}>{val2}</span></div>
        <div className="ml-single-stat"><span className="ml-single-lbl">{label3}</span><span className="ml-single-val" style={{ color, fontWeight: 800 }}>{val3}</span></div>
      </div>
    </div>
  );
}

function actionIcon(type) {
  const m = { promote: '🚀', bundle: '📦', reprice: '💰', eliminate: '⚠️', expand: '📈' };
  return m[type] || '💡';
}
