import React from 'react';
import { PageShell, Panel, Loader, ErrorMsg } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api, fmtM, fmtPct, shortBranch } from '../utils/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './Reports.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Reports({ branch }) {
  const isAllBranches = branch === 'all';
  const scopeLabel = isAllBranches ? 'All branches' : shortBranch(branch);
  const [selectedYear, setSelectedYear] = React.useState('');

  const { data: heatmap, loading: l1, error: e1 } = useData(
    () => api.monthlyHeatmap({ branch: isAllBranches ? undefined : branch, year: selectedYear || undefined }),
    [branch, selectedYear]
  );
  const { data: brMonths, loading: l2, error: e2 } = useData(
    () => api.monthlyBranches({ branch: isAllBranches ? undefined : branch, limit: 6, year: selectedYear || undefined }),
    [branch, selectedYear]
  );
  const { data: yoy } = useData(() => api.monthlyYoY({ branch: isAllBranches ? undefined : branch }), [branch]);
  const { data: cats, loading: l3, error: e3 } = useData(
    () => api.categories({ branch: isAllBranches ? undefined : branch }),
    [branch]
  );
  const { data: top, loading: l4, error: e4 } = useData(
    () => api.topProducts({ limit: 20, branch: isAllBranches ? undefined : branch }),
    [branch]
  );

  const availableYears = React.useMemo(() => {
    const years = [
      ...(yoy || []).map(r => Number(r.year)),
      ...(heatmap || []).map(r => Number(r.year)),
      ...(brMonths || []).map(r => Number(r.year)),
    ].filter(Number.isFinite);
    return [...new Set(years)].sort((a, b) => a - b);
  }, [yoy, heatmap, brMonths]);
  React.useEffect(() => {
    if (!availableYears.length) return;
    if (selectedYear && availableYears.includes(Number(selectedYear))) return;
    setSelectedYear(String(availableYears[availableYears.length - 1]));
  }, [availableYears, selectedYear]);
  const selectedYearNum = selectedYear ? Number(selectedYear) : null;
  const yearRangeLabel = availableYears.length
    ? (availableYears.length === 1 ? `${availableYears[0]}` : `${availableYears[0]}-${availableYears[availableYears.length - 1]}`)
    : 'No year data';

  const heatRows = React.useMemo(() => {
    if (!heatmap) return [];
    const byBranch = {};
    heatmap.forEach(r => {
      if (!byBranch[r.branch]) byBranch[r.branch] = {};
      byBranch[r.branch][`${r.year}-${r.month_number}`] = r.sales_amount;
    });
    return Object.entries(byBranch)
      .map(([br, months]) => ({ branch: br, months }))
      .slice(0, 10);
  }, [heatmap]);

  const brMonthChart = React.useMemo(() => {
    if (!brMonths) return null;
    const COLORS = ['#166534', '#1b7a4b', '#22c55e', '#4ade80', '#b8974e', '#0ea5e9'];
    const branches = [...new Set(brMonths.map(r => r.branch))].slice(0, 6);

    return {
      labels: MONTH_LABELS,
      datasets: branches.map((br, i) => {
        const brData = brMonths.filter(r => r.branch === br && Number(r.year) === selectedYearNum);
        const values = Array(12).fill(0);
        brData.forEach(r => {
          values[(r.month_number || 1) - 1] = r.sales_amount / 1e6;
        });

        return {
          label: shortBranch(br),
          data: values,
          backgroundColor: COLORS[i % COLORS.length],
          stack: 'stack',
          borderRadius: 2,
        };
      }),
    };
  }, [brMonths, selectedYearNum]);

  return (
    <PageShell
      title="Reports"
      subtitle="Full data tables and multi-dimensional analysis"
      badge={`${scopeLabel} - ${yearRangeLabel}`}
    >
      {availableYears.length > 0 && (
        <div className="reports-year-switch">
          <span className="reports-year-label">Year</span>
          {availableYears.map(year => {
            const y = String(year);
            return (
              <button
                key={y}
                className={`reports-year-btn ${selectedYear === y ? 'active' : ''}`}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

      <Panel
        title="Monthly Sales by Branch"
        subtitle={selectedYearNum == null
          ? 'No monthly data available'
          : (isAllBranches
            ? `Top branches stacked - ${selectedYearNum} (LBP M)`
            : `Monthly trend for ${scopeLabel} - ${selectedYearNum} (LBP M)`)}
      >
        {l2 ? <Loader /> : e2 ? <ErrorMsg message={e2} /> : (
          <div className="reports-chart-wrap">
            {brMonthChart && (
              <Bar
                data={brMonthChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: { color: 'var(--text-primary)', font: { size: 11, family: 'Inter' }, boxWidth: 10 },
                    },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}M LBP` } },
                  },
                  scales: {
                    x: {
                      stacked: true,
                      ticks: { color: 'var(--text-muted)', font: { size: 11, family: 'Inter' } },
                      grid: { display: false },
                    },
                    y: {
                      stacked: true,
                      ticks: { color: 'var(--text-muted)', font: { size: 11, family: 'Inter' }, callback: v => `${v}M` },
                      grid: { color: 'var(--border)' },
                    },
                  },
                }}
              />
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Category Performance Summary"
        subtitle={isAllBranches ? 'BEVERAGES vs FOOD across all branches' : `BEVERAGES vs FOOD for ${scopeLabel}`}
      >
        {l3 ? <Loader /> : e3 ? <ErrorMsg message={e3} /> : (
          <div className="reports-cat-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Profit</th>
                  <th>Avg Margin</th>
                  <th>Branches</th>
                  <th>Profit Share</th>
                </tr>
              </thead>
              <tbody>
                {(cats || []).map((c, i) => {
                  const total = (cats || []).reduce((s, x) => s + x.total_profit, 0);
                  const share = total > 0 ? (c.total_profit / total * 100) : 0;
                  return (
                    <tr key={c.category}>
                      <td>
                        <div className="reports-cat-cell">
                          <div className="reports-cat-dot" style={{ background: i === 0 ? '#166534' : '#b8974e' }} />
                          <span className="reports-cat-name">{c.category}</span>
                        </div>
                      </td>
                      <td className="reports-td-profit">{fmtM(c.total_profit)} LBP</td>
                      <td className="reports-td-margin">{fmtPct(c.avg_margin_pct)}</td>
                      <td>{c.branch_count || '-'}</td>
                      <td>
                        <div className="reports-share-cell">
                          <div className="reports-share-bar" style={{ width: `${share}%`, background: i === 0 ? '#166534' : '#b8974e' }} />
                          <span>{share.toFixed(1)}%</span>
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

      <Panel
        title="Branch x Month Heatmap"
        subtitle={selectedYearNum == null
          ? 'No monthly data available'
          : (isAllBranches
            ? `Sales intensity by branch and month (${selectedYearNum})`
            : `Sales intensity for ${scopeLabel} by month (${selectedYearNum})`)}
      >
        {l1 ? <Loader /> : e1 ? <ErrorMsg message={e1} /> : (
          <div className="reports-heatmap-wrap">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  {MONTH_LABELS.map(m => <th key={m}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatRows.map(row => {
                  const vals = MONTH_LABELS.map((_, mi) => (selectedYearNum == null ? 0 : row.months[`${selectedYearNum}-${mi + 1}`] || 0));
                  const maxVal = Math.max(...vals, 1);
                  return (
                    <tr key={row.branch}>
                      <td className="heatmap-branch">{shortBranch(row.branch)}</td>
                      {vals.map((v, mi) => (
                        <td
                          key={mi}
                          className="heatmap-cell"
                          title={`${shortBranch(row.branch)} - ${MONTH_LABELS[mi]}: ${fmtM(v)} LBP`}
                          style={{ background: v > 0 ? heatColor(v / maxVal) : 'transparent' }}
                        >
                          {v > 0 ? (v / 1e6).toFixed(0) : ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Top 20 Products" subtitle="Ranked by total profit contribution">
        {l4 ? <Loader /> : e4 ? <ErrorMsg message={e4} /> : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Total Profit</th>
                  <th>Profit Margin</th>
                  <th>Qty Sold</th>
                  <th>Branches</th>
                </tr>
              </thead>
              <tbody>
                {(top || []).map((p, i) => (
                  <tr key={i}>
                    <td className="reports-td-rank">{i + 1}</td>
                    <td className="reports-td-name">{p.product_desc}</td>
                    <td className="reports-td-muted">{p.category}</td>
                    <td className="reports-td-profit">{fmtM(p.total_profit)}</td>
                    <td className="reports-td-margin">{fmtPct(p.total_profit_pct)}</td>
                    <td className="reports-td-muted">{Math.round(p.qty).toLocaleString()}</td>
                    <td>{p.branch_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

function heatColor(ratio) {
  const r = Math.round(248 - ratio * (248 - 22));
  const g = Math.round(247 - ratio * (247 - 101));
  const b = Math.round(244 - ratio * (244 - 52));
  return `rgb(${r},${g},${b})`;
}
