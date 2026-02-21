import React, { useState, useCallback } from 'react';
import { PageShell, Panel, Loader } from '../components/PageShell';
import { api, fmtM, fmtPct } from '../utils/api';
import './Simulator.css';

const LEVERS = [
  {
    key: 'coldBrewBoost',
    label: 'Cold Brew & Specialty Boost',
    desc: 'Increase cold bar item sales via promotions or upselling',
    unit: '%',
    min: 0, max: 50, step: 5, default: 10,
    color: '#0ea5e9',
    icon: '🧊',
  },
  {
    key: 'beverageShare',
    label: 'Beverage Mix Shift',
    desc: 'Move customers from low-margin to high-margin beverages',
    unit: '%',
    min: 0, max: 30, step: 5, default: 5,
    color: '#7c3aed',
    icon: '☕',
  },
  {
    key: 'pastryBundles',
    label: 'Pastry Bundle Attach Rate',
    desc: 'Bundle pastries with beverages to lift ticket size',
    unit: '%',
    min: 0, max: 40, step: 5, default: 0,
    color: '#b8974e',
    icon: '🥐',
  },
  {
    key: 'reduceLowMargin',
    label: 'Reduce Loss-Leader Volume',
    desc: 'Reprice or limit items with negative profit contribution',
    unit: '%',
    min: 0, max: 80, step: 10, default: 0,
    color: '#dc2626',
    icon: '⚠️',
  },
];

export default function Simulator() {
  const [values, setValues]     = useState(() => Object.fromEntries(LEVERS.map(l => [l.key, l.default])));
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [ran, setRan]           = useState(false);

  const handleChange = useCallback((key, val) => {
    setValues(v => ({ ...v, [key]: Number(val) }));
    setRan(false);
  }, []);

  const handleSimulate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.simulate(values);
      setResult(res);
      setRan(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [values]);

  const handleReset = () => {
    setValues(Object.fromEntries(LEVERS.map(l => [l.key, l.default])));
    setResult(null);
    setRan(false);
  };

  return (
    <PageShell
      title="Profit Simulator"
      subtitle="Adjust levers to model the impact of operational changes on profit"
      badge="Live model"
    >
      <div className="sim-layout">
        {/* Levers panel */}
        <Panel title="Adjust Levers" subtitle="Move sliders to model different scenarios">
          <div className="sim-levers">
            {LEVERS.map(l => (
              <div key={l.key} className="sim-lever">
                <div className="sim-lever-header">
                  <span className="sim-lever-icon">{l.icon}</span>
                  <div className="sim-lever-info">
                    <div className="sim-lever-label">{l.label}</div>
                    <div className="sim-lever-desc">{l.desc}</div>
                  </div>
                  <div className="sim-lever-val" style={{ color: l.color }}>
                    {values[l.key]}{l.unit}
                  </div>
                </div>
                <input
                  type="range"
                  className="sim-slider"
                  min={l.min}
                  max={l.max}
                  step={l.step}
                  value={values[l.key]}
                  onChange={e => handleChange(l.key, e.target.value)}
                  style={{ '--slider-color': l.color }}
                />
                <div className="sim-lever-range">
                  <span>{l.min}{l.unit}</span>
                  <span>{l.max}{l.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="sim-actions">
            <button className="sim-btn-run" onClick={handleSimulate} disabled={loading}>
              {loading ? 'Calculating…' : 'Run Simulation'}
            </button>
            <button className="sim-btn-reset" onClick={handleReset}>Reset</button>
          </div>
        </Panel>

        {/* Results panel */}
        <div className="sim-results-col">
          <Panel title="Simulation Results" subtitle={ran ? 'Based on current lever settings' : 'Run the simulation to see projections'}>
            {loading ? (
              <Loader />
            ) : ran && result ? (
              <SimResults result={result} values={values} />
            ) : (
              <div className="sim-placeholder">
                <div className="sim-placeholder-icon">📊</div>
                <div className="sim-placeholder-text">Adjust the levers on the left and click <strong>Run Simulation</strong> to model profit impact.</div>
              </div>
            )}
          </Panel>

          {ran && result && (
            <Panel title="Lever Breakdown" subtitle="Impact contribution per initiative">
              <div className="sim-breakdown">
                {result.breakdown && result.breakdown.map((item, i) => (
                  <div key={i} className="sim-breakdown-row">
                    <div className="sim-breakdown-label">
                      <span className="sim-breakdown-dot" style={{ background: LEVERS[i]?.color || 'var(--primary)' }} />
                      {item.lever}
                    </div>
                    <div className="sim-breakdown-bar-wrap">
                      <div
                        className="sim-breakdown-bar"
                        style={{
                          width: `${result.maxImpact > 0 ? Math.min(100, (item.impact / result.maxImpact) * 100) : 0}%`,
                          background: LEVERS[i]?.color || 'var(--primary)',
                        }}
                      />
                    </div>
                    <div className="sim-breakdown-val">{fmtM(item.impact)} LBP</div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function SimResults({ result }) {
  return (
    <div className="sim-result-content">
      <div className="sim-result-main">
        <div className="sim-result-label">Estimated Monthly Profit Uplift</div>
        <div className="sim-result-big">{fmtM(result.estimatedUplift)} LBP</div>
        <div className="sim-result-sub">+{fmtPct(result.upliftPct)} vs current baseline</div>
      </div>

      <div className="sim-result-grid">
        <div className="sim-result-stat">
          <div className="sim-result-stat-label">Current Baseline</div>
          <div className="sim-result-stat-val">{fmtM(result.currentProfit)} LBP</div>
        </div>
        <div className="sim-result-stat">
          <div className="sim-result-stat-label">Projected Profit</div>
          <div className="sim-result-stat-val green">{fmtM(result.projectedProfit)} LBP</div>
        </div>
        <div className="sim-result-stat">
          <div className="sim-result-stat-label">Annualized Uplift</div>
          <div className="sim-result-stat-val">{fmtM(result.estimatedUplift * 12)} LBP</div>
        </div>
        <div className="sim-result-stat">
          <div className="sim-result-stat-label">Confidence Score</div>
          <div className="sim-result-stat-val">{result.confidence}%</div>
        </div>
      </div>

      <div className="sim-result-confidence">
        <div className="sim-confidence-bar-wrap">
          <div
            className="sim-confidence-bar"
            style={{ width: `${result.confidence}%`, background: confidenceColor(result.confidence) }}
          />
        </div>
        <div className="sim-confidence-label" style={{ color: confidenceColor(result.confidence) }}>
          {confidenceLabel(result.confidence)}
        </div>
      </div>
    </div>
  );
}

function confidenceColor(c) {
  if (c >= 80) return 'var(--success)';
  if (c >= 60) return '#f59e0b';
  return 'var(--danger)';
}

function confidenceLabel(c) {
  if (c >= 80) return 'High confidence — achievable with focused execution';
  if (c >= 60) return 'Moderate confidence — depends on execution quality';
  return 'Lower confidence — ambitious target, monitor closely';
}
