const express = require('express');
const router  = express.Router();
const { getDataset } = require('../utils/csvLoader');

// ─── helpers ────────────────────────────────────────────────────────────────

function aggregateItems(items) {
  const map = {};
  items.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!map[k]) map[k] = {
      product_desc: k,
      category: r.category,
      division: r.division,
      branch: r.branch,
      qty: 0, total_price: 0, total_cost: 0, total_profit: 0,
    };
    map[k].qty          += (r.qty          || 0);
    map[k].total_price  += (r.total_price  || 0);
    map[k].total_cost   += (r.total_cost   || 0);
    map[k].total_profit += (r.total_profit || 0);
  });
  return Object.values(map).map(p => ({
    ...p,
    total_profit_pct: p.total_price > 0 ? (p.total_profit / p.total_price * 100) : 0,
  }));
}

function menuClass(p, profitMedian, qtyMedian) {
  const hiProfit = p.total_profit > profitMedian;
  const hiQty    = p.qty          > qtyMedian;
  if (hiProfit && hiQty)   return 'star';
  if (hiProfit && !hiQty)  return 'puzzle';
  if (!hiProfit && hiQty)  return 'plowhorse';
  return 'dog';
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ─── GET /api/actions/recommendations ───────────────────────────────────────
// Returns a FLAT array of action objects — used by Actions page + Executive page
router.get('/recommendations', (req, res) => {
  const { branch } = req.query;
  const allItems = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const cats     = getDataset('profit_by_category.csv').filter(r => r.row_type === 'category');

  const items = branch && branch !== 'all'
    ? allItems.filter(r => r.branch === branch) : allItems;

  const products     = aggregateItems(items);
  const totalProfit  = products.reduce((s, p) => s + p.total_profit, 0);
  const profitMedian = median(products.map(p => p.total_profit));
  const qtyMedian    = median(products.map(p => p.qty));

  // Classify with Menu Engineering Matrix
  const classified = products.map(p => ({ ...p, menu_class: menuClass(p, profitMedian, qtyMedian) }));

  // Stars → promote top 3
  const stars = classified
    .filter(p => p.menu_class === 'star' && p.total_profit > 0)
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 3)
    .map(p => ({
      type: 'promote',
      icon: '🚀',
      title: `Promote ${p.product_desc}`,
      category: p.category,
      description: `⭐ Star item — high margin (${p.total_profit_pct.toFixed(1)}%) and high volume. Increase visibility, feature in upsell scripts across all branches.`,
      estimated_impact: Math.round(p.total_profit * 0.12),
      items: [p.product_desc],
    }));

  // Puzzles → market harder (high margin, low qty)
  const puzzles = classified
    .filter(p => p.menu_class === 'puzzle' && p.total_profit > 0 && p.total_profit_pct > 60)
    .sort((a, b) => b.total_profit_pct - a.total_profit_pct)
    .slice(0, 2)
    .map(p => ({
      type: 'expand',
      icon: '📈',
      title: `Scale ${p.product_desc}`,
      category: p.category,
      description: `High-margin item (${p.total_profit_pct.toFixed(1)}%) but low volume — only sold in limited branches. Roll out to more locations or add to daily specials.`,
      estimated_impact: Math.round(p.total_profit * 0.30),
      items: [p.product_desc],
    }));

  // Dogs → eliminate or reprice top 3 loss-makers
  const dogs = classified
    .filter(p => p.menu_class === 'dog' && p.total_profit < 0 && p.qty > 100)
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, 3)
    .map(p => ({
      type: 'eliminate',
      icon: '⚠️',
      title: `Review ${p.product_desc}`,
      category: p.category,
      description: `Loss-making item — ${Math.abs(p.total_profit).toLocaleString('en', { maximumFractionDigits: 0 })} LBP lost on ${Math.round(p.qty).toLocaleString()} units. Reprice or phase out.`,
      estimated_impact: Math.round(Math.abs(p.total_profit) * 0.75),
      items: [p.product_desc],
    }));

  // Category mix optimization
  const catMap = {};
  (branch && branch !== 'all' ? cats.filter(r => r.branch === branch) : cats).forEach(r => {
    const k = r.category;
    if (!k || r.row_type === 'branch_total') return;
    if (!catMap[k]) catMap[k] = { category: k, total_profit: 0 };
    catMap[k].total_profit += (r.total_profit || 0);
  });
  const catList     = Object.values(catMap).sort((a, b) => b.total_profit - a.total_profit);
  const topCat      = catList[0];

  const catRecs = topCat ? [{
    type: 'bundle',
    icon: '📦',
    title: `Bundle ${topCat.category} with Food Items`,
    category: topCat.category,
    description: `${topCat.category} drives ${((topCat.total_profit / (totalProfit || 1)) * 100).toFixed(1)}% of profit. Create beverage+pastry bundle deals to lift average ticket and attach rate.`,
    estimated_impact: Math.round(topCat.total_profit * 0.05),
    items: [],
  }] : [];

  // Plowhorses → reprice
  const plowhorses = classified
    .filter(p => p.menu_class === 'plowhorse' && p.total_profit > 0 && p.total_profit_pct < 50)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 2)
    .map(p => ({
      type: 'reprice',
      icon: '💰',
      title: `Reprice ${p.product_desc}`,
      category: p.category,
      description: `High volume but low margin (${p.total_profit_pct.toFixed(1)}%). Small price increase recovers significant profit given ${Math.round(p.qty).toLocaleString()} units sold.`,
      estimated_impact: Math.round(p.total_price * 0.03),
      items: [p.product_desc],
    }));

  const allRecs = [...stars, ...puzzles, ...catRecs, ...plowhorses, ...dogs]
    .sort((a, b) => b.estimated_impact - a.estimated_impact);

  res.json(allRecs);
});

// ─── GET /api/actions/promote-opportunities ──────────────────────────────────
router.get('/promote-opportunities', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) > 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const products  = aggregateItems(items);
  const profitMed = median(products.map(p => p.total_profit));
  const qtyMed    = median(products.map(p => p.qty));

  const result = products
    .filter(p => p.total_profit_pct > 60)
    .map(p => ({ ...p, menu_class: menuClass(p, profitMed, qtyMed) }))
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, Number(limit));

  res.json(result);
});

// ─── GET /api/actions/profit-traps ──────────────────────────────────────────
router.get('/profit-traps', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) < 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const result = aggregateItems(items)
    .sort((a, b) => a.total_profit - b.total_profit)
    .slice(0, Number(limit));

  res.json(result);
});

// ─── POST /api/actions/simulate ─────────────────────────────────────────────
// Data-grounded perturbation model — lever pools come directly from profit_by_item.csv.
//
// Lever 1 — Hot Bar Upsell (hotBarUpsell):
//   Pool: HOT BAR SECTION positive-profit items = 147.4M LBP
//   Lever % = volume increase via size upgrades / add-ons.
//   Conversion factor 0.18: upsell captures ~18% of the demand increase as incremental profit
//   (accounts for partial uptake across 926K annual transactions).
//
// Lever 2 — Cinnamon Roll Attach Rate (cinnamonRollPush):
//   Pool: CINNAMON ROLLS division = 24.7M LBP, 82.5% margin (highest-margin food)
//   Lever % = attach rate increase with beverages.
//   Conversion factor 0.30: pastry attach is incremental (not substitution) + high margin.
//   Key data: Lotus Roll 303 LBP/unit profit sold in only 19/25 branches — pure expansion play.
//
// Lever 3 — Grab&Go Attach Rate (grabGoAttach):
//   Pool: GRAB&GO BEVERAGES = 22.2M LBP, 77.7% margin
//   Lever % = attach rate increase per hot bar transaction (baseline ~53% per data).
//   Conversion factor 0.22: attach is purely incremental, no cannibalization.
//   Water = 88.3% margin — highest-margin grab&go SKU.
//
// Lever 4 — Topping COGS Reduction (toppingCostReduce):
//   Pool: 24.1M LBP in ingredient cost for combo toppings (zero-revenue entries).
//   Blueberries 8M, Strawberry 5M, Mango 2.9M, Pineapple 2.6M, others 5.6M.
//   Lever % = COGS reduction via portion control / supplier deals / seasonal swaps.
//   Conversion factor 1.0: direct cost saving, no revenue risk (these are cost lines).
// ─────────────────────────────────────────────────────────────────────────────
router.post('/simulate', (req, res) => {
  const {
    hotBarUpsell       = 0,
    cinnamonRollPush   = 0,
    grabGoAttach       = 0,
    toppingCostReduce  = 0,
  } = req.body;

  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const sum   = (arr, field = 'total_profit') => arr.reduce((s, r) => s + (r[field] || 0), 0);

  // ── Segment profit pools (positive-profit items only for revenue levers) ──
  const hotBarItems    = items.filter(r => r.division === 'HOT BAR SECTION'  && (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  const crItems        = items.filter(r => r.division === 'CINNAMON ROLLS'   && (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  const ggItems        = items.filter(r => r.division === 'GRAB&GO BEVERAGES'&& (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  // Topping cost pool = zero-revenue, negative-profit entries (ingredient COGS lines)
  const toppingNames   = ['BLUEBERRIES COMBO','STRAWBERRY COMBO','MANGO COMBO','PINEAPPLE COMBO',
                          'BROWNIES COMBO','LOTUS BISCUIT COMBO','CHOCOLATE CHIPS COMBO',
                          'OREO COMBO','MARSHMALLOW COMBO','GUMMY BEARS COMBO','WAFER ROLL COMBO'];
  const toppingItems   = items.filter(r => toppingNames.includes(r.product_desc) && (r.total_price || 0) === 0);

  const hotBarProfit      = sum(hotBarItems);         // ~147.4M LBP
  const cinnamonProfit    = sum(crItems);              // ~24.7M LBP
  const grabGoProfit      = sum(ggItems);              // ~22.2M LBP
  const toppingCostPool   = Math.abs(sum(toppingItems)); // ~24.1M LBP
  const totalProfit       = sum(items);                // ~598M LBP

  // ── Impact per lever ──────────────────────────────────────────────────────
  // hotBarUpsell:      lever% of 147M × 0.18 conversion
  //   (18% = realistic capture rate: not all transactions upgrade, partial uptake)
  const hotBarImpact    = hotBarProfit     * (hotBarUpsell      / 100) * 0.18;

  // cinnamonRollPush:  lever% of 24.7M × 0.30 conversion
  //   (30% = high conversion: purely incremental attach, no substitution effect)
  const cinnamonImpact  = cinnamonProfit   * (cinnamonRollPush  / 100) * 0.30;

  // grabGoAttach:      lever% of 22.2M × 0.22 conversion
  //   (22% = incremental but constrained by basket size and seating context)
  const grabGoImpact    = grabGoProfit     * (grabGoAttach      / 100) * 0.22;

  // toppingCostReduce: lever% of 24.1M × 1.00 — direct cost saving
  //   (100% conversion: these are pure cost lines, every % reduced = direct profit)
  const toppingImpact   = toppingCostPool  * (toppingCostReduce / 100) * 1.00;

  const totalUplift  = hotBarImpact + cinnamonImpact + grabGoImpact + toppingImpact;
  const upliftPct    = totalProfit > 0 ? (totalUplift / totalProfit * 100) : 0;
  const maxImpact    = Math.max(hotBarImpact, cinnamonImpact, grabGoImpact, toppingImpact, 1);

  // ── Confidence score ──────────────────────────────────────────────────────
  // Base 76%: levers are derived from real POS data, 25 branches, item-level granularity
  // +8 for diversification (using 3+ levers reduces single-point-of-failure risk)
  // -8 for aggressiveness (>80% total lever magnitude = harder to execute simultaneously)
  // toppingCostReduce alone gets a +5 bonus: it's a cost lever (not demand), high certainty
  const activeLevers      = [hotBarUpsell, cinnamonRollPush, grabGoAttach, toppingCostReduce].filter(v => v > 0).length;
  const totalMagnitude    = hotBarUpsell + cinnamonRollPush + grabGoAttach + toppingCostReduce;
  const costLeverBonus    = toppingCostReduce > 0 ? 5 : 0;
  const diversifyBonus    = activeLevers >= 3 ? 8 : activeLevers === 2 ? 4 : 0;
  const aggressivePenalty = totalMagnitude > 80 ? -8 : totalMagnitude > 50 ? -4 : 0;
  const confidence        = Math.min(95, Math.max(50, 76 + costLeverBonus + diversifyBonus + aggressivePenalty));

  res.json({
    estimatedUplift: Math.round(totalUplift),
    upliftPct:       parseFloat(upliftPct.toFixed(2)),
    currentProfit:   Math.round(totalProfit),
    projectedProfit: Math.round(totalProfit + totalUplift),
    confidence,
    maxImpact:       Math.round(maxImpact),

    breakdown: [
      { lever: 'Hot Bar Upsell',         impact: Math.round(hotBarImpact),   pct: hotBarUpsell      },
      { lever: 'Cinnamon Roll Attach',   impact: Math.round(cinnamonImpact), pct: cinnamonRollPush  },
      { lever: 'Grab&Go Attach',         impact: Math.round(grabGoImpact),   pct: grabGoAttach      },
      { lever: 'Topping COGS Reduction', impact: Math.round(toppingImpact),  pct: toppingCostReduce },
    ],

    segments: {
      hotBarProfit:     Math.round(hotBarProfit),
      cinnamonRollProfit: Math.round(cinnamonProfit),
      grabGoProfit:     Math.round(grabGoProfit),
      toppingCostPool:  Math.round(toppingCostPool),
    },
  });
});

module.exports = router;
