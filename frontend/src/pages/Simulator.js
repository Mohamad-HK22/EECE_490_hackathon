import React, { useState, useCallback } from 'react';
import { PageShell, Panel, Loader } from '../components/PageShell';
import { useData } from '../hooks/useData';
import { api } from '../utils/api';
import './Simulator.css';

const LBP_SCALE = 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtLBP(n) {
  if (n == null || isNaN(n)) return '—';
  const scaled = n * LBP_SCALE;
  const abs = Math.abs(scaled);
  if (abs >= 1_000_000) return (scaled / 1_000_000).toFixed(1) + 'M LBP';
  if (abs >= 1_000)     return (scaled / 1_000).toFixed(0) + 'K LBP';
  return scaled.toLocaleString() + ' LBP';
}
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString();
}
function toDisplayLbp(n) {
  if (n == null || isNaN(n)) return null;
  return Number(n) * LBP_SCALE;
}
function parseLbpInput(v) {
  const digits = String(v ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  return Number(digits);
}
function formatLbpInput(n) {
  if (n == null || isNaN(n)) return '';
  return Number(n).toLocaleString('en-US');
}
function normalizeStep500(n) {
  if (n == null || isNaN(n)) return null;
  return Math.max(0, Math.round(n / 500) * 500);
}
function deltaSign(dir) {
  return dir === 'gain' ? '+' : '';
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { key: 'price_change', label: 'Price Change',  icon: '💲', desc: 'What if I change the price of a product?' },
  { key: 'bundle',       label: 'Bundle Deal',   icon: '🎁', desc: 'What if I sell multiple items together at one price?' },
  { key: 'sale',         label: 'Run a Sale',    icon: '🏷️', desc: 'What if I discount a product — will volume make up for it?' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function Simulator() {
  const [activeTab, setActiveTab] = useState('price_change');
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const { data: catalog }  = useData(() => api.productCatalog(), []);
  const { data: branches } = useData(() => api.mlBranches(), []);

  const products = catalog || [];
  const branchList = branches || [];

  const handleSimulate = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.simulateScenario(payload);
      setResult(res);
    } catch (err) {
      setError('Could not run simulation. Check inputs and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <PageShell
      title="Profit Simulator"
      subtitle="Pick a scenario, choose a product, set your numbers — see the profit impact instantly"
    >
      {/* ── Scenario tabs ──────────────────────────────────────────────────── */}
      <div className="sim-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`sim-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); handleReset(); }}
          >
            <span className="sim-tab-icon">{t.icon}</span>
            <span className="sim-tab-label">{t.label}</span>
            <span className="sim-tab-desc">{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="sim-layout">
        {/* ── Input panel ──────────────────────────────────────────────────── */}
        <Panel title={TABS.find(t => t.key === activeTab)?.label} subtitle="Fill in the details below">
          {activeTab === 'price_change' && (
            <PriceChangeForm
              products={products}
              branches={branchList}
              onSimulate={handleSimulate}
              onReset={handleReset}
              loading={loading}
            />
          )}
          {activeTab === 'bundle' && (
            <BundleForm
              products={products}
              branches={branchList}
              onSimulate={handleSimulate}
              onReset={handleReset}
              loading={loading}
            />
          )}
          {activeTab === 'sale' && (
            <SaleForm
              products={products}
              branches={branchList}
              onSimulate={handleSimulate}
              onReset={handleReset}
              loading={loading}
            />
          )}
        </Panel>

        {/* ── Results panel ────────────────────────────────────────────────── */}
        <div className="sim-results-col">
          <Panel title="Result" subtitle={result ? 'Profit impact based on your inputs' : 'Results will appear here'}>
            {loading ? (
              <Loader />
            ) : error ? (
              <div className="sim-error">{error}</div>
            ) : result ? (
              <ScenarioResult result={result} />
            ) : (
              <div className="sim-empty">
                <div className="sim-empty-icon">📊</div>
                <div className="sim-empty-text">Fill in the form and click <strong>Calculate</strong> to see the profit impact.</div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

// ── FORM: Price Change ────────────────────────────────────────────────────────
function PriceChangeForm({ products, branches, onSimulate, onReset, loading }) {
  const [product,  setProduct]  = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [priceError, setPriceError] = useState('');
  const [branch,   setBranch]   = useState('all');

  const selected = products.find(p => p.product_desc === product);
  const parsedNewPrice = parseLbpInput(newPrice);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parsedNewPrice == null || parsedNewPrice < 0 || parsedNewPrice % 500 !== 0) {
      setPriceError('Price must be in 500 LBP steps (ending in 000 or 500).');
      return;
    }
    setPriceError('');
    onSimulate({ type: 'price_change', product, newPrice: parsedNewPrice / LBP_SCALE, branch });
  };

  const handlePriceChange = (raw) => {
    const parsed = parseLbpInput(raw);
    if (parsed == null) {
      setNewPrice('');
      setPriceError('');
      return;
    }
    setNewPrice(formatLbpInput(parsed));
    setPriceError(parsed % 500 === 0 ? '' : 'Price must be in 500 LBP steps (ending in 000 or 500).');
  };

  const handlePriceBlur = () => {
    const parsed = parseLbpInput(newPrice);
    if (parsed == null) return;
    const normalized = normalizeStep500(parsed);
    setNewPrice(formatLbpInput(normalized));
    setPriceError('');
  };

  return (
    <form className="sim-form" onSubmit={handleSubmit}>
      <FormField label="Which product?" required>
        <ProductSelect products={products} value={product} onChange={setProduct} />
      </FormField>

      {selected && <ProductInfo p={selected} />}

      <FormField label="New selling price (LBP)" required hint="Use thousands formatting (example: 250,000). Value must end in 000 or 500.">
        <input
          className="sim-input"
          type="text"
          inputMode="numeric"
          placeholder={selected ? `Current: ${fmtNum(toDisplayLbp(selected.unit_price))} LBP` : 'e.g. 250,000'}
          value={newPrice}
          onChange={e => handlePriceChange(e.target.value)}
          onBlur={handlePriceBlur}
          required
        />
        {priceError && <div className="sim-inline-error">{priceError}</div>}
      </FormField>

      <FormField label="Apply to" hint="Choose a specific branch or all branches at once">
        <BranchSelect branches={branches} value={branch} onChange={setBranch} />
      </FormField>

      <FormActions loading={loading} onReset={() => { setProduct(''); setNewPrice(''); setPriceError(''); setBranch('all'); onReset(); }} disabled={!product || !newPrice || !!priceError} />
    </form>
  );
}

// ── FORM: Bundle ──────────────────────────────────────────────────────────────
function BundleForm({ products, branches, onSimulate, onReset, loading }) {
  const [items, setItems]           = useState([{ product: '', qty: 1 }]);
  const [bundlePrice, setBundlePrice] = useState('');
  const [bundlePriceError, setBundlePriceError] = useState('');
  const [dailySales, setDailySales]   = useState(10);
  const [branch, setBranch]           = useState('all');

  const addItem = () => setItems(prev => [...prev, { product: '', qty: 1 }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  // Compute the sum of individual RRPs so user sees what they're discounting from
  const rrpTotal = items.reduce((s, it) => {
    const p = products.find(p => p.product_desc === it.product);
    return s + (p ? p.unit_price * Number(it.qty || 1) : 0);
  }, 0);
  const parsedBundlePrice = parseLbpInput(bundlePrice);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parsedBundlePrice == null || parsedBundlePrice < 0 || parsedBundlePrice % 500 !== 0) {
      setBundlePriceError('Bundle price must be in 500 LBP steps (ending in 000 or 500).');
      return;
    }
    setBundlePriceError('');
    onSimulate({
      type: 'bundle',
      items: items.filter(i => i.product),
      bundlePrice: parsedBundlePrice / LBP_SCALE,
      expectedDailySales: Number(dailySales),
      branch,
    });
  };

  const handleBundlePriceChange = (raw) => {
    const parsed = parseLbpInput(raw);
    if (parsed == null) {
      setBundlePrice('');
      setBundlePriceError('');
      return;
    }
    setBundlePrice(formatLbpInput(parsed));
    setBundlePriceError(parsed % 500 === 0 ? '' : 'Bundle price must be in 500 LBP steps (ending in 000 or 500).');
  };

  const handleBundlePriceBlur = () => {
    const parsed = parseLbpInput(bundlePrice);
    if (parsed == null) return;
    setBundlePrice(formatLbpInput(normalizeStep500(parsed)));
    setBundlePriceError('');
  };

  return (
    <form className="sim-form" onSubmit={handleSubmit}>
      <div className="sim-form-section-label">Items in the bundle</div>
      {items.map((item, i) => (
        <div key={i} className="bundle-item-row">
          <div className="bundle-item-product">
            <ProductSelect products={products} value={item.product} onChange={v => updateItem(i, 'product', v)} placeholder="Select product…" />
          </div>
          <div className="bundle-item-qty">
            <label className="bundle-qty-label">Qty</label>
            <input
              className="sim-input sim-input--small"
              type="number"
              min="1"
              value={item.qty}
              onChange={e => updateItem(i, 'qty', e.target.value)}
            />
          </div>
          {items.length > 1 && (
            <button type="button" className="bundle-remove-btn" onClick={() => removeItem(i)}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="bundle-add-btn" onClick={addItem}>+ Add another item</button>

      {rrpTotal > 0 && (
        <div className="sim-rrp-note">
          Individual prices add up to: <strong>{fmtNum(toDisplayLbp(rrpTotal))} LBP</strong> — your bundle price below determines the discount
        </div>
      )}

      <FormField label="Bundle price (LBP)" required hint="The single price a customer pays for the whole bundle">
        <input
          className="sim-input"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 400,000"
          value={bundlePrice}
          onChange={e => handleBundlePriceChange(e.target.value)}
          onBlur={handleBundlePriceBlur}
          required
        />
        {bundlePriceError && <div className="sim-inline-error">{bundlePriceError}</div>}
      </FormField>

      <FormField label="Expected daily sales (bundles sold per day)" hint="Your estimate of how many bundles you'll sell per day">
        <input
          className="sim-input"
          type="number"
          min="1"
          value={dailySales}
          onChange={e => setDailySales(e.target.value)}
        />
      </FormField>

      <FormField label="Apply to" hint="Choose a specific branch or all branches">
        <BranchSelect branches={branches} value={branch} onChange={setBranch} />
      </FormField>

      <FormActions loading={loading} onReset={() => { setItems([{ product: '', qty: 1 }]); setBundlePrice(''); setBundlePriceError(''); setDailySales(10); setBranch('all'); onReset(); }} disabled={!bundlePrice || !items.some(i => i.product) || !!bundlePriceError} />
    </form>
  );
}

// ── FORM: Sale ────────────────────────────────────────────────────────────────
function SaleForm({ products, branches, onSimulate, onReset, loading }) {
  const [product,     setProduct]     = useState('');
  const [discountPct, setDiscountPct] = useState(20);
  const [volumeBoost, setVolumeBoost] = useState(30);
  const [branch,      setBranch]      = useState('all');

  const selected = products.find(p => p.product_desc === product);
  const salePreview = selected ? Math.round(selected.unit_price * (1 - discountPct / 100)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSimulate({ type: 'sale', product, discountPct: Number(discountPct), volumeBoost: Number(volumeBoost), branch });
  };

  return (
    <form className="sim-form" onSubmit={handleSubmit}>
      <FormField label="Which product goes on sale?" required>
        <ProductSelect products={products} value={product} onChange={setProduct} />
      </FormField>

      {selected && <ProductInfo p={selected} />}

      <FormField
        label={`Discount: ${discountPct}% off`}
        hint={salePreview != null ? `Sale price will be ${fmtNum(toDisplayLbp(salePreview))} LBP (was ${fmtNum(toDisplayLbp(selected.unit_price))} LBP)` : 'Drag to set the discount'}
      >
        <div className="sim-slider-row">
          <input
            type="range"
            className="sim-slider"
            min="5" max="70" step="5"
            value={discountPct}
            onChange={e => setDiscountPct(Number(e.target.value))}
            style={{ '--slider-color': '#dc2626' }}
          />
          <span className="sim-slider-val" style={{ color: '#dc2626' }}>{discountPct}%</span>
        </div>
      </FormField>

      <FormField
        label={`Expected volume increase: ${volumeBoost}% more sales`}
        hint="If you run a sale, how much more of this product do you think you'll sell? Drag to set."
      >
        <div className="sim-slider-row">
          <input
            type="range"
            className="sim-slider"
            min="0" max="200" step="10"
            value={volumeBoost}
            onChange={e => setVolumeBoost(Number(e.target.value))}
            style={{ '--slider-color': '#0ea5e9' }}
          />
          <span className="sim-slider-val" style={{ color: '#0ea5e9' }}>{volumeBoost}%</span>
        </div>
      </FormField>

      <FormField label="Apply to" hint="Choose a specific branch or all branches">
        <BranchSelect branches={branches} value={branch} onChange={setBranch} />
      </FormField>

      <FormActions loading={loading} onReset={() => { setProduct(''); setDiscountPct(20); setVolumeBoost(30); setBranch('all'); onReset(); }} disabled={!product} />
    </form>
  );
}

// ── Results dispatcher ────────────────────────────────────────────────────────
function ScenarioResult({ result }) {
  if (result.scenario === 'Price Change')    return <PriceChangeResult r={result} />;
  if (result.scenario === 'Bundle')          return <BundleResult r={result} />;
  if (result.scenario === 'Sale / Discount') return <SaleResult r={result} />;
  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}

// ── Result: Price Change ──────────────────────────────────────────────────────
function PriceChangeResult({ r }) {
  return (
    <div className="sim-result">
      {r.warning && <WarningBanner msg={r.warning} />}

      <DeltaHero
        delta={r.deltaProfit}
        dir={r.deltaDirection}
        label="Profit impact (YTD period)"
        sub={`${r.branch} · ${fmtNum(r.qty)} units sold at this price`}
      />

      <div className="sim-result-grid">
        <StatBox label="Current price"   val={fmtNum(toDisplayLbp(r.currentPrice)) + ' LBP'} />
        <StatBox label="New price"       val={fmtNum(toDisplayLbp(r.newPrice)) + ' LBP'} />
        <StatBox label="Unit cost"       val={fmtNum(toDisplayLbp(r.unitCost)) + ' LBP'}  sub="Cost stays fixed" />
        <StatBox label="Current margin"  val={r.currentMargin + '%'} />
        <StatBox label="New margin"      val={r.newMargin + '%'}     accent={r.newMargin < r.currentMargin ? 'red' : 'green'} />
        <StatBox label="Old profit"      val={fmtLBP(r.oldProfit)} />
        <StatBox label="New profit"      val={fmtLBP(r.newProfit)} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
        <StatBox label="Annualised delta" val={`${deltaSign(r.deltaDirection)}${fmtLBP(r.annualisedDelta)}`} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
      </div>

      <TotalImpactBar current={r.baselineProfit} next={r.newTotalProfit} />
    </div>
  );
}

// ── Result: Bundle ────────────────────────────────────────────────────────────
function BundleResult({ r }) {
  return (
    <div className="sim-result">
      {r.warning && <WarningBanner msg={r.warning} />}

      <DeltaHero
        delta={r.deltaMonthlyProfit}
        dir={r.deltaDirection}
        label="Monthly profit vs selling separately"
        sub={`${r.dailySales} bundles/day · ${r.branch}`}
      />

      <div className="sim-result-grid">
        <StatBox label="Bundle price"         val={fmtNum(toDisplayLbp(r.bundlePrice)) + ' LBP'} />
        <StatBox label="Individual RRP total" val={fmtNum(toDisplayLbp(r.totalIndividualRRP)) + ' LBP'} sub="If sold separately" />
        <StatBox label="Total cost"           val={fmtNum(toDisplayLbp(r.totalBundleCost)) + ' LBP'} />
        <StatBox label="Bundle margin"        val={r.bundleMarginPct + '%'} accent={r.bundleMarginPct > 50 ? 'green' : r.bundleMarginPct > 20 ? 'amber' : 'red'} />
        <StatBox label="Discount off RRP"     val={r.discountOffRRP + '%'} />
        <StatBox label="Monthly (bundle)"     val={fmtLBP(r.monthlyBundleProfit)} accent="green" />
        <StatBox label="Monthly (individual)" val={fmtLBP(r.monthlyIndividualProfit)} />
        <StatBox label="Annualised delta"     val={`${deltaSign(r.deltaDirection)}${fmtLBP(r.annualisedDelta)}`} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
      </div>

      <div className="bundle-items-summary">
        <div className="bundle-items-title">Items in this bundle</div>
        {r.items.map((it, i) => (
          <div key={i} className="bundle-item-summary-row">
            <span className="bundle-item-name">{it.product}</span>
            <span className="bundle-item-meta">×{it.qty} · {fmtNum(toDisplayLbp(it.unitPrice))} LBP each · cost {fmtNum(toDisplayLbp(it.unitCost))} LBP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Result: Sale ──────────────────────────────────────────────────────────────
function SaleResult({ r }) {
  return (
    <div className="sim-result">
      {r.warning && <WarningBanner msg={r.warning} />}

      <DeltaHero
        delta={r.deltaProfit}
        dir={r.deltaDirection}
        label="Profit impact (YTD period)"
        sub={`${r.branch} · ${r.discountPct}% off · ${r.volumeBoostPct}% more sales`}
      />

      <div className="sim-result-grid">
        <StatBox label="Current price"      val={fmtNum(toDisplayLbp(r.currentPrice)) + ' LBP'} />
        <StatBox label="Sale price"         val={fmtNum(toDisplayLbp(r.salePrice)) + ' LBP'} accent="red" />
        <StatBox label="Unit cost"          val={fmtNum(toDisplayLbp(r.unitCost)) + ' LBP'} />
        <StatBox label="Current margin"     val={r.currentMarginPct + '%'} />
        <StatBox label="New margin"         val={r.newMarginPct + '%'} accent={r.newMarginPct < r.currentMarginPct ? 'red' : 'green'} />
        <StatBox label="Base qty"           val={fmtNum(r.baseQty)} sub="YTD units (this period)" />
        <StatBox label="Boosted qty"        val={fmtNum(r.boostedQty)} sub={`+${r.volumeBoostPct}% demand`} accent="green" />
        <StatBox label="Break-even boost needed" val={r.breakEvenVolumeBoostNeeded + '%'} sub="Volume lift to match old profit" />
        <StatBox label="Old profit"         val={fmtLBP(r.oldProfit)} />
        <StatBox label="New profit"         val={fmtLBP(r.newProfit)} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
        <StatBox label="Delta"              val={`${deltaSign(r.deltaDirection)}${fmtLBP(r.deltaProfit)}`} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
        <StatBox label="Annualised delta"   val={`${deltaSign(r.deltaDirection)}${fmtLBP(r.annualisedDelta)}`} accent={r.deltaDirection === 'gain' ? 'green' : 'red'} />
      </div>

      <TotalImpactBar current={r.baselineProfit} next={r.newTotalProfit} />
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────────────────────
function FormField({ label, required, hint, children }) {
  return (
    <div className="sim-field">
      <label className="sim-label">
        {label}
        {required && <span className="sim-required">*</span>}
      </label>
      {children}
      {hint && <div className="sim-hint">{hint}</div>}
    </div>
  );
}

function ProductSelect({ products, value, onChange, placeholder = 'Search or select a product…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const filtered = products
    .filter(p => p.product_desc && p.product_desc !== '' && p.product_desc.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  const selected = products.find(p => p.product_desc === value);

  return (
    <div className={`product-select ${open ? 'open' : ''}`} tabIndex={0} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="product-select-trigger" onClick={() => setOpen(o => !o)}>
        {selected ? (
          <span className="product-select-chosen">{selected.product_desc}</span>
        ) : (
          <span className="product-select-placeholder">{placeholder}</span>
        )}
        <span className="product-select-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="product-select-dropdown">
          <input
            className="product-select-search"
            autoFocus
            placeholder="Type to search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
          <div className="product-select-list">
            {filtered.length === 0 && <div className="product-select-empty">No products found</div>}
            {filtered.map(p => (
              <div
                key={p.product_desc}
                className={`product-select-option ${p.product_desc === value ? 'selected' : ''}`}
                onMouseDown={() => { onChange(p.product_desc); setOpen(false); setQuery(''); }}
              >
                <span className="pso-name">{p.product_desc}</span>
                <span className="pso-meta">{fmtNum(toDisplayLbp(p.unit_price))} LBP · {p.avg_margin}% margin</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchSelect({ branches, value, onChange }) {
  return (
    <select className="sim-input" value={value} onChange={e => onChange(e.target.value)}>
      <option value="all">All branches (network total)</option>
      {branches.map(b => (
        <option key={b} value={b}>{b.replace('Stories ', '').replace('Stories - ', '')}</option>
      ))}
    </select>
  );
}

function ProductInfo({ p }) {
  return (
    <div className="product-info-bar">
      <div className="pib-item"><span className="pib-label">Current price</span><span className="pib-val">{fmtNum(toDisplayLbp(p.unit_price))} LBP</span></div>
      <div className="pib-item"><span className="pib-label">Avg margin</span><span className="pib-val">{p.avg_margin}%</span></div>
      <div className="pib-item"><span className="pib-label">Category</span><span className="pib-val">{p.category}</span></div>
      <div className="pib-item"><span className="pib-label">Division</span><span className="pib-val">{p.division}</span></div>
    </div>
  );
}

function FormActions({ loading, onReset, disabled }) {
  return (
    <div className="sim-form-actions">
      <button className="sim-btn-run" type="submit" disabled={loading || disabled}>
        {loading ? 'Calculating…' : 'Calculate profit impact'}
      </button>
      <button className="sim-btn-reset" type="button" onClick={onReset}>Reset</button>
    </div>
  );
}

function DeltaHero({ delta, dir, label, sub }) {
  return (
    <div className={`delta-hero ${dir}`}>
      <div className="delta-hero-label">{label}</div>
      <div className="delta-hero-val">
        {deltaSign(dir)}{fmtLBP(delta)}
      </div>
      <div className="delta-hero-sub">{sub}</div>
    </div>
  );
}

function StatBox({ label, val, sub, accent }) {
  return (
    <div className="stat-box">
      <div className="stat-box-label">{label}</div>
      <div className={`stat-box-val ${accent ? 'accent-' + accent : ''}`}>{val}</div>
      {sub && <div className="stat-box-sub">{sub}</div>}
    </div>
  );
}

function WarningBanner({ msg }) {
  return (
    <div className="sim-warning">
      <span className="sim-warning-icon">⚠️</span>
      <span>{msg}</span>
    </div>
  );
}

function TotalImpactBar({ current, next }) {
  const delta   = next - current;
  const dir     = delta >= 0 ? 'gain' : 'loss';
  const pct     = current > 0 ? Math.abs(delta / current * 100).toFixed(1) : 0;
  return (
    <div className="total-impact-bar">
      <div className="tib-label">Impact on total network profit</div>
      <div className="tib-row">
        <div className="tib-item">
          <div className="tib-item-label">Current</div>
          <div className="tib-item-val">{fmtLBP(current)}</div>
        </div>
        <div className={`tib-arrow ${dir}`}>{dir === 'gain' ? '▲' : '▼'} {pct}%</div>
        <div className="tib-item">
          <div className="tib-item-label">Projected</div>
          <div className={`tib-item-val ${dir === 'gain' ? 'accent-green' : 'accent-red'}`}>{fmtLBP(next)}</div>
        </div>
      </div>
    </div>
  );
}
