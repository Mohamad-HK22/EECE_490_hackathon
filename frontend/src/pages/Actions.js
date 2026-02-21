import React, { useState } from 'react';
import { PageShell, Panel, Loader, ErrorMsg, ImpactBadge } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, shortBranch } from '../utils/api';
import './Actions.css';

const TABS = [
  { key: 'overview',     label: 'Overview' },
  { key: 'margin',       label: '📊 Margin Gaps' },
  { key: 'price',        label: '💰 Price Anomalies' },
  { key: 'availability', label: '🗺️ Missing Products' },
];

export default function Actions({ branch }) {
  const [tab, setTab] = useState('overview');

  const { data: recs,      loading: l1, error: e1 } = useData(() => api.recommendations({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: residuals, loading: l2, error: e2 } = useData(() => api.mlMarginResiduals({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: prices,    loading: l3, error: e3 } = useData(() => api.mlPriceAnomalies({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: avail,     loading: l4, error: e4 } = useData(() => api.mlAvailabilityGaps(), []);

  const impactTotal     = React.useMemo(() => (recs      || []).reduce((s, r) => s + (r.estimated_impact  || 0), 0), [recs]);
  const totalPricePool  = React.useMemo(() => (prices    || []).reduce((s, r) => s + (r.profit_gain       || 0), 0), [prices]);
  const totalAvailPool  = React.useMemo(() => (avail     || []).reduce((s, r) => s + (r.expected_profit   || 0), 0), [avail]);
  const totalMarginPool = React.useMemo(() => (residuals || []).reduce((s, r) => s + (r.uplift_potential  || 0), 0), [residuals]);

  return (
    <PageShell
      title="Action Generator"
      subtitle="Data-driven recommendations from your sales and margin data"
    >
      {/* Summary strip */}
      <div className="action-summary-strip">
        <div className="action-summary-card">
          <div className="action-summary-label">Menu Engineering</div>
          <div className="action-summary-val green">{fmtM(impactTotal)} LBP</div>
          <div className="action-summary-sub">estimated uplift</div>
        </div>
        <div className="action-summary-card">
          <div className="action-summary-label">Margin Gap Pool</div>
          <div className="action-summary-val">{fmtM(totalMarginPool)} LBP</div>
          <div className="action-summary-sub">{residuals?.length || 0} product-branch pairs</div>
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

      {/* Overview */}
      {tab === 'overview' && (
        <>
          <Panel title="AI Recommendations" subtitle="Ranked by profit impact">
            {l1 ? (
              <div className="action-ai-loading">
                <div className="action-ai-spinner" />
                <div className="action-ai-loading-text">Generating recommendations…</div>
                <div className="action-ai-loading-sub">Analysing your sales data</div>
              </div>
            ) : e1 ? <ErrorMsg message={e1} /> : (
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
            <Panel title="Top Margin Gap" subtitle="Biggest opportunity to close the margin gap">
              {l2 ? <Loader /> : residuals?.[0] ? (
                <SingleCard icon="📊" color="#166534"
                  product={residuals[0].product_desc} branch={residuals[0].branch}
                  label1="Actual Margin"  val1={`${residuals[0].actual_margin?.toFixed(1)}%`}
                  label2="Expected"       val2={`${residuals[0].pred_margin?.toFixed(1)}%`}
                  label3="Uplift Pool"    val3={fmtM(residuals[0].uplift_potential) + ' LBP'} />
              ) : <div className="action-empty">No margin gaps for this filter.</div>}
            </Panel>
            <Panel title="Top Price Anomaly" subtitle="Highest profit gain from repricing">
              {l3 ? <Loader /> : prices?.[0] ? (
                <SingleCard icon="💰" color="#b8974e"
                  product={prices[0].product} branch={prices[0].branch}
                  label1="Current Price"  val1={`${prices[0].actual_price} LBP`}
                  label2="Target Price"   val2={`${prices[0].target_price} LBP`}
                  label3="Profit Gain"    val3={fmtM(prices[0].profit_gain) + ' LBP'} />
              ) : <div className="action-empty">No price anomalies for this filter.</div>}
            </Panel>
            <Panel title="Top Availability Gap" subtitle="Highest expected profit from rollout">
              {l4 ? <Loader /> : avail?.[0] ? (
                <SingleCard icon="🗺️" color="#0ea5e9"
                  product={avail[0].product} branch={`Missing from ${avail[0].n_missing} branches`}
                  label1="Present branches" val1={`${avail[0].n_present}/25`}
                  label2="Avg margin"       val2={`${avail[0].avg_margin?.toFixed(1)}%`}
                  label3="Expected profit"  val3={fmtM(avail[0].expected_profit) + ' LBP'} />
              ) : <div className="action-empty">No availability gaps found.</div>}
            </Panel>
          </div>
        </>
      )}

      {/* Margin Gaps */}
      {tab === 'margin' && (
        <Panel title="Margin Gaps" subtitle="Product-branch pairs where actual margin is below expected — sorted by uplift potential">
          {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Branch</th><th>Division</th><th>Actual %</th><th>Expected %</th><th>Gap</th><th>Uplift Pool</th></tr>
                </thead>
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

      {/* Price Anomalies */}
      {tab === 'price' && (
        <Panel title="Price Anomalies" subtitle="Branches pricing below the network average — raise to capture missed profit">
          {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Branch</th><th>Current Price</th><th>Target Price</th><th>Gap %</th><th>Qty</th><th>Profit Gain</th></tr>
                </thead>
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

      {/* Availability */}
      {tab === 'availability' && (
        <Panel title="Availability Gaps" subtitle="Products not stocked in all branches — ranked by expected profit from full rollout">
          {l4 ? <Loader /> : e4 ? <ErrorMsg message={e4} /> : (
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr><th>#</th><th>Product</th><th>Division</th><th>Present</th><th>Missing</th><th>Avg Margin</th><th>Per Branch</th><th>Expected Uplift</th></tr>
                </thead>
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
    </PageShell>
  );
}

function SingleCard({ icon, product, branch, label1, val1, label2, val2, label3, val3, color }) {
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
