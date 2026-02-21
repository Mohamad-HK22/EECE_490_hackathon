import React from 'react';
import { PageShell, Panel, Loader, ErrorMsg } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct } from '../utils/api';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js';
import './GroupDNA.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const PALETTE = [
  '#166534', '#1b7a4b', '#22c55e', '#4ade80', '#86efac',
  '#b8974e', '#d4a843', '#0ea5e9', '#7c3aed', '#dc2626',
];

export default function GroupDNA({ branch }) {
  const { data: groups,   loading: l1, error: e1 } = useData(() => api.groups({ branch: branch !== 'all' ? branch : undefined, limit: 20 }), [branch]);
  const { data: cats,     loading: l2, error: e2 } = useData(() => api.categories({ branch: branch !== 'all' ? branch : undefined }), [branch]);
  const { data: branches, loading: l3 }             = useData(() => api.branches(), []);

  // Doughnut: profit by group (top 8)
  const groupDoughnut = React.useMemo(() => {
    if (!groups) return null;
    const top8 = groups.slice(0, 8);
    return {
      labels: top8.map(g => g.group),
      datasets: [{
        data: top8.map(g => g.total_profit),
        backgroundColor: PALETTE,
        borderWidth: 2,
        borderColor: 'var(--bg-card)',
      }],
    };
  }, [groups]);

  // Bar: category comparison
  const catBar = React.useMemo(() => {
    if (!cats) return null;
    return {
      labels: cats.map(c => c.category),
      datasets: [
        {
          label: 'Total Profit (LBP M)',
          data: cats.map(c => c.total_profit / 1e6),
          backgroundColor: ['#166534', '#b8974e'],
          borderRadius: 6,
        },
      ],
    };
  }, [cats]);

  // Top 5 branches as DNA cards
  const topBranches = React.useMemo(() => {
    if (!branches) return [];
    return [...branches].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
  }, [branches]);

  return (
    <PageShell
      title="Group DNA"
      subtitle="Deep-dive into product groups, categories, and branch profiles"
      badge={`${groups?.length || 0} groups`}
    >
      <div className="dna-top-row">
        {/* Profit mix doughnut */}
        <Panel title="Profit by Product Group" subtitle="Top 8 groups by total profit contribution">
          {l1 ? <Loader /> : e1 ? <ErrorMsg message={e1} /> : (
            <div className="dna-chart-wrap">
              {groupDoughnut && (
                <Doughnut
                  data={groupDoughnut}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '62%',
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: {
                          color: 'var(--text-primary)',
                          font: { size: 11, family: 'Inter' },
                          boxWidth: 10,
                          padding: 10,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: ctx => ` ${fmtM(ctx.parsed)} LBP`,
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          )}
        </Panel>

        {/* Category bar */}
        <Panel title="Category Split" subtitle="BEVERAGES vs FOOD profit comparison">
          {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
            <div className="dna-chart-wrap dna-chart-wrap--bar">
              {catBar && (
                <Bar
                  data={catBar}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}M LBP` },
                      },
                    },
                    scales: {
                      x: {
                        ticks: { color: 'var(--text-muted)', font: { size: 12, family: 'Inter' } },
                        grid: { display: false },
                      },
                      y: {
                        ticks: {
                          color: 'var(--text-muted)',
                          font: { size: 11, family: 'Inter' },
                          callback: v => `${v}M`,
                        },
                        grid: { color: 'var(--border)' },
                      },
                    },
                  }}
                />
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Category detail cards */}
      <Panel title="Category Performance" subtitle="Key metrics per category">
        {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
          <div className="dna-cat-cards">
            {(cats || []).map((c, i) => (
              <div key={c.category} className="dna-cat-card">
                <div className="dna-cat-header">
                  <div className="dna-cat-icon" style={{ background: i === 0 ? 'rgba(22,101,52,0.1)' : 'rgba(184,151,78,0.1)' }}>
                    {i === 0 ? '🥤' : '🍴'}
                  </div>
                  <div className="dna-cat-name">{c.category}</div>
                </div>
                <div className="dna-cat-ring">
                  <CircleRing pct={c.avg_margin_pct} color={i === 0 ? '#166534' : '#b8974e'} />
                </div>
                <div className="dna-cat-stats">
                  <div className="dna-cat-stat">
                    <div className="dna-cat-stat-label">Total Profit</div>
                    <div className="dna-cat-stat-val">{fmtM(c.total_profit)} LBP</div>
                  </div>
                  <div className="dna-cat-stat">
                    <div className="dna-cat-stat-label">Avg Margin</div>
                    <div className="dna-cat-stat-val">{fmtPct(c.avg_margin_pct)}</div>
                  </div>
                  <div className="dna-cat-stat">
                    <div className="dna-cat-stat-label">Branches</div>
                    <div className="dna-cat-stat-val">{c.branch_count || '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Branch DNA profiles */}
      <Panel title="Top Branch Profiles" subtitle="Individual branch performance fingerprints">
        {l3 ? <Loader /> : (
          <div className="dna-branch-profiles">
            {topBranches.map((b, i) => (
              <BranchDNACard key={b.branch} branch={b} rank={i + 1} maxProfit={topBranches[0]?.total_profit || 1} />
            ))}
          </div>
        )}
      </Panel>

      {/* Full group table */}
      <Panel title="All Product Groups" subtitle="Sorted by total profit">
        {l1 ? <Loader /> : e1 ? <ErrorMsg message={e1} /> : (
          <div className="dna-table-wrap">
            <table className="dna-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Group</th>
                  <th>Division</th>
                  <th>Total Profit</th>
                  <th>Qty Sold</th>
                  <th>Profit Share</th>
                </tr>
              </thead>
              <tbody>
                {(groups || []).map((g, i) => {
                  const totalProfit = groups.reduce((s, x) => s + x.total_profit, 0);
                  const share = totalProfit > 0 ? (g.total_profit / totalProfit * 100) : 0;
                  return (
                    <tr key={i}>
                      <td className="dna-td-rank">{i + 1}</td>
                      <td className="dna-td-name">{g.group}</td>
                      <td className="dna-td-muted">{g.division}</td>
                      <td className="dna-td-profit">{fmtM(g.total_profit)}</td>
                      <td className="dna-td-muted">{Math.round(g.qty).toLocaleString()}</td>
                      <td>
                        <div className="dna-share-bar-wrap">
                          <div className="dna-share-bar" style={{ width: `${Math.min(100, share * 3)}%` }} />
                          <span className="dna-share-label">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

function CircleRing({ pct, color }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill={color}>
        {pct?.toFixed(0)}%
      </text>
    </svg>
  );
}

function BranchDNACard({ branch: b, rank, maxProfit }) {
  const profitPct = (b.total_profit / maxProfit) * 100;
  const bevPct    = b.bev_profit_pct  ?? 77;
  const foodPct   = b.food_profit_pct ?? 23;
  return (
    <div className="dna-branch-card">
      <div className="dna-branch-rank">#{rank}</div>
      <div className="dna-branch-name">{b.branch}</div>
      <div className="dna-branch-profit">{fmtM(b.total_profit)} LBP</div>
      <div className="dna-branch-bar-wrap">
        <div className="dna-branch-bar" style={{ width: `${profitPct}%` }} />
      </div>
      <div className="dna-branch-mix">
        <span className="dna-branch-mix-bev">BEV {bevPct.toFixed(0)}%</span>
        <span className="dna-branch-mix-food">FOOD {foodPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
