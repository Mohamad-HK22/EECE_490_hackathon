const express = require('express');
const router  = express.Router();
const { getDataset } = require('../utils/csvLoader');

// OpenAI setup — optional, falls back gracefully if key not set
let openaiClient = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI client ready — AI recommendations enabled');
  } else {
    console.log('ℹ️  OPENAI_API_KEY not set — using data-driven descriptions');
  }
} catch (e) {
  console.warn('⚠️  openai package missing:', e.message);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function aggregateItems(items) {
  const map = {};
  items.forEach(r => {
    const k = r.product_desc;
    if (!k) return;
    if (!map[k]) map[k] = {
      product_desc: k, category: r.category, division: r.division,
      branches: new Set(), qty: 0, total_price: 0, total_cost: 0, total_profit: 0,
    };
    map[k].qty          += (r.qty          || 0);
    map[k].total_price  += (r.total_price  || 0);
    map[k].total_cost   += (r.total_cost   || 0);
    map[k].total_profit += (r.total_profit || 0);
    if (r.branch) map[k].branches.add(r.branch);
  });
  return Object.values(map).map(p => ({
    ...p, n_branches: p.branches.size, branches: undefined,
    total_profit_pct: p.total_price > 0 ? (p.total_profit / p.total_price * 100) : 0,
  }));
}

function aggregateByBranch(items) {
  const map = {};
  items.forEach(r => {
    const k = r.branch; if (!k) return;
    if (!map[k]) map[k] = { branch: k, total_profit: 0, total_price: 0 };
    map[k].total_profit += (r.total_profit || 0);
    map[k].total_price  += (r.total_price  || 0);
  });
  return Object.values(map).map(b => ({
    ...b, margin_pct: b.total_price > 0 ? (b.total_profit / b.total_price * 100) : 0,
  }));
}

function menuClass(p, profitMedian, qtyMedian) {
  const hiProfit = p.total_profit > profitMedian;
  const hiQty    = p.qty          > qtyMedian;
  if (hiProfit && hiQty)  return 'star';
  if (hiProfit && !hiQty) return 'puzzle';
  if (!hiProfit && hiQty) return 'plowhorse';
  return 'dog';
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmtLBP(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M LBP';
  if (abs >= 1_000)     return (n / 1_000).toFixed(0) + 'K LBP';
  return Math.round(n).toLocaleString() + ' LBP';
}

function shortBranch(b) {
  return (b || '').replace('Stories - ', '').replace('Stories ', '').replace('Stories.', 'HQ').trim();
}

// Build structured recommendation data from CSV
function buildRecommendationData(items) {
  const products     = aggregateItems(items);
  const totalProfit  = products.reduce((s, p) => s + p.total_profit, 0);
  const profitMedian = median(products.map(p => p.total_profit));
  const qtyMedian    = median(products.map(p => p.qty));
  const classified   = products.map(p => ({ ...p, menu_class: menuClass(p, profitMedian, qtyMedian) }));

  // Stars
  const stars = classified
    .filter(p => p.menu_class === 'star' && p.total_profit > 0)
    .sort((a, b) => b.total_profit - a.total_profit).slice(0, 3)
    .map(p => {
      const profitShare = totalProfit > 0 ? (p.total_profit / totalProfit * 100) : 0;
      const unitProfit  = p.qty > 0 ? p.total_profit / p.qty : 0;
      return {
        type: 'promote', icon: '🚀',
        title: `Promote ${p.product_desc}`,
        category: p.category, division: p.division,
        estimated_impact: Math.round(p.total_profit * 0.12),
        items: [p.product_desc],
        data: {
          product: p.product_desc, division: p.division, category: p.category,
          qty: Math.round(p.qty), margin_pct: p.total_profit_pct.toFixed(1),
          total_profit: fmtLBP(p.total_profit), profit_share_pct: profitShare.toFixed(1),
          unit_profit: fmtLBP(unitProfit), n_branches: p.n_branches,
          fallback: `${p.product_desc} is your top earner in ${p.division}: ${Math.round(p.qty).toLocaleString()} units sold, ${p.total_profit_pct.toFixed(1)}% margin, ${fmtLBP(p.total_profit)} profit (${profitShare.toFixed(1)}% of total). Each unit generates ${fmtLBP(unitProfit)}. Feature it in daily specials and upsell at checkout.`,
        },
      };
    });

  // Puzzles
  const puzzles = classified
    .filter(p => p.menu_class === 'puzzle' && p.total_profit > 0 && p.total_profit_pct > 60)
    .sort((a, b) => b.total_profit_pct - a.total_profit_pct).slice(0, 2)
    .map(p => {
      const potentialBranches = 25 - p.n_branches;
      const perBranchProfit   = p.n_branches > 0 ? p.total_profit / p.n_branches : 0;
      const rolloutEstimate   = perBranchProfit * potentialBranches * 0.7;
      return {
        type: 'expand', icon: '📈',
        title: `Roll out ${p.product_desc} to more branches`,
        category: p.category, division: p.division,
        estimated_impact: Math.round(rolloutEstimate),
        items: [p.product_desc],
        data: {
          product: p.product_desc, division: p.division, category: p.category,
          margin_pct: p.total_profit_pct.toFixed(1), n_branches: p.n_branches,
          per_branch_profit: fmtLBP(perBranchProfit), potential_branches: potentialBranches,
          rollout_estimate: fmtLBP(rolloutEstimate),
          fallback: `${p.product_desc} earns ${p.total_profit_pct.toFixed(1)}% margin but is only active in ${p.n_branches}/25 branches. It generates ${fmtLBP(perBranchProfit)} per active branch. Adding it to ${potentialBranches} more branches could add ${fmtLBP(rolloutEstimate)} in profit.`,
        },
      };
    });

  // Dogs
  const dogs = classified
    .filter(p => p.menu_class === 'dog' && p.total_profit < 0 && p.qty > 100)
    .sort((a, b) => a.total_profit - b.total_profit).slice(0, 3)
    .map(p => {
      const lossPerUnit = p.qty > 0 ? Math.abs(p.total_profit) / p.qty : 0;
      const costPct     = p.total_price > 0 ? (p.total_cost / p.total_price * 100) : 0;
      return {
        type: 'eliminate', icon: '⚠️',
        title: `Address loss on ${p.product_desc}`,
        category: p.category, division: p.division,
        estimated_impact: Math.round(Math.abs(p.total_profit) * 0.75),
        items: [p.product_desc],
        data: {
          product: p.product_desc, division: p.division, category: p.category,
          qty: Math.round(p.qty), total_loss: fmtLBP(Math.abs(p.total_profit)),
          loss_per_unit: fmtLBP(lossPerUnit), cost_pct: costPct.toFixed(0),
          fallback: `${p.product_desc} is losing money: ${Math.round(p.qty).toLocaleString()} units sold but ${fmtLBP(Math.abs(p.total_profit))} lost in total — ${fmtLBP(lossPerUnit)} per unit. Cost is ${costPct.toFixed(0)}% of revenue. Raise the price or phase it out.`,
        },
      };
    });

  // Plowhorses
  const plowhorses = classified
    .filter(p => p.menu_class === 'plowhorse' && p.total_profit > 0 && p.total_profit_pct < 50)
    .sort((a, b) => b.qty - a.qty).slice(0, 2)
    .map(p => {
      const unitPrice     = p.qty > 0 ? p.total_price / p.qty : 0;
      const price3pctGain = p.total_price * 0.03 * (p.total_profit_pct / 100 + 0.03);
      return {
        type: 'reprice', icon: '💰',
        title: `Raise price of ${p.product_desc}`,
        category: p.category, division: p.division,
        estimated_impact: Math.round(p.total_price * 0.03),
        items: [p.product_desc],
        data: {
          product: p.product_desc, division: p.division, category: p.category,
          qty: Math.round(p.qty), margin_pct: p.total_profit_pct.toFixed(1),
          unit_price: fmtLBP(unitPrice), price_3pct_gain: fmtLBP(price3pctGain),
          fallback: `${p.product_desc} sells ${Math.round(p.qty).toLocaleString()} units at ${fmtLBP(unitPrice)} each but earns only ${p.total_profit_pct.toFixed(1)}% margin. A 3% price increase would recover ${fmtLBP(price3pctGain)} — minimal customer impact, high return.`,
        },
      };
    });

  // Category bundle insight — derived from CSV
  const catMap = {};
  items.forEach(r => {
    const k = r.category; if (!k) return;
    if (!catMap[k]) catMap[k] = { category: k, total_profit: 0, total_price: 0 };
    catMap[k].total_profit += (r.total_profit || 0);
    catMap[k].total_price  += (r.total_price  || 0);
  });
  const catList = Object.values(catMap).filter(c => c.total_profit > 0).sort((a, b) => b.total_profit - a.total_profit);
  const catRecs = [];
  if (catList.length >= 2) {
    const topCat = catList[0];
    const botCat = catList[catList.length - 1];
    const topShare  = totalProfit > 0 ? (topCat.total_profit / totalProfit * 100) : 0;
    const topMargin = topCat.total_price > 0 ? (topCat.total_profit / topCat.total_price * 100) : 0;
    const botMargin = botCat.total_price  > 0 ? (botCat.total_profit / botCat.total_price  * 100) : 0;
    catRecs.push({
      type: 'bundle', icon: '📦',
      title: `Bundle ${topCat.category} with low-margin items`,
      category: topCat.category,
      estimated_impact: Math.round(topCat.total_profit * 0.05),
      items: [],
      data: {
        top_category: topCat.category, top_profit: fmtLBP(topCat.total_profit),
        top_margin_pct: topMargin.toFixed(1), top_share_pct: topShare.toFixed(1),
        low_category: botCat.category, low_margin_pct: botMargin.toFixed(1),
        fallback: `${topCat.category} accounts for ${topShare.toFixed(1)}% of total profit (${fmtLBP(topCat.total_profit)}, ${topMargin.toFixed(1)}% margin). Pairing it in combo deals with ${botCat.category} (${botMargin.toFixed(1)}% margin) lifts average ticket while keeping bundle margins healthy.`,
      },
    });
  }

  // Branch gap insight — derived from CSV
  const branchData = aggregateByBranch(items).filter(b => b.total_profit > 0).sort((a, b) => b.margin_pct - a.margin_pct);
  const branchRecs = [];
  if (branchData.length >= 3) {
    const best  = branchData[0];
    const worst = branchData[branchData.length - 1];
    const gap   = best.margin_pct - worst.margin_pct;
    if (gap > 5) {
      const gapValueLBP = worst.total_price * (gap / 100);
      branchRecs.push({
        type: 'expand', icon: '🏪',
        title: `Close margin gap: ${shortBranch(worst.branch)} vs ${shortBranch(best.branch)}`,
        category: 'Branch Performance',
        estimated_impact: Math.round(gapValueLBP * 0.4),
        items: [worst.branch],
        data: {
          best_branch: shortBranch(best.branch), best_margin: best.margin_pct.toFixed(1),
          worst_branch: shortBranch(worst.branch), worst_margin: worst.margin_pct.toFixed(1),
          gap_pp: gap.toFixed(1), worst_revenue: fmtLBP(worst.total_price), gap_value: fmtLBP(gapValueLBP),
          fallback: `${shortBranch(best.branch)} runs at ${best.margin_pct.toFixed(1)}% margin vs ${shortBranch(worst.branch)} at ${worst.margin_pct.toFixed(1)}% — a ${gap.toFixed(1)}pp gap. Closing half that gap on ${shortBranch(worst.branch)}'s revenue would recover ${fmtLBP(gapValueLBP * 0.5)}. Review product mix, pricing, and waste.`,
        },
      });
    }
  }

  return [...stars, ...puzzles, ...catRecs, ...plowhorses, ...dogs, ...branchRecs]
    .sort((a, b) => b.estimated_impact - a.estimated_impact);
}

// AI description generator — calls GPT-4o-mini, falls back to data-derived text
async function generateAIDescriptions(recs) {
  if (!openaiClient) return recs.map(r => ({ ...r, description: r.data.fallback }));

  const recSummaries = recs.map((r, i) => {
    return `#${i + 1} [${r.type.toUpperCase()}] "${r.title}"\nData: ${JSON.stringify(r.data, Object.keys(r.data).filter(k => k !== 'fallback'))}`;
  }).join('\n\n');

  const systemPrompt = `You are a profit analyst for Stories Coffee, a Lebanese coffee chain. Write concise, confident business recommendations for non-technical managers.
Rules:
- Start directly with the insight — no "This product…" or "Based on data…"
- Use the exact numbers from the data provided — never invent figures
- 2-3 sentences max
- Sound like advice from a smart CFO, not a data scientist
- No jargon (no "menu engineering", "regression", "ML", "model")
- Reference actual LBP amounts, percentages, and branch counts
Respond ONLY with a JSON object: { "items": ["desc1", "desc2", ...] } with exactly ${recs.length} strings in order.`;

  const userPrompt = `Write one recommendation description for each of the following ${recs.length} items:\n\n${recSummaries}`;

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    });

    const raw     = completion.choices[0]?.message?.content || '{}';
    const parsed  = JSON.parse(raw);
    const descs   = parsed.items || parsed.recommendations || parsed.descriptions || Object.values(parsed)[0];

    if (!Array.isArray(descs) || descs.length !== recs.length) throw new Error('Bad GPT response shape');
    return recs.map((r, i) => ({ ...r, description: descs[i] || r.data.fallback }));
  } catch (err) {
    console.warn('OpenAI call failed, using fallback:', err.message);
    return recs.map(r => ({ ...r, description: r.data.fallback }));
  }
}

// GET /api/actions/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const { branch } = req.query;
    const allItems   = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
    const items      = branch && branch !== 'all' ? allItems.filter(r => r.branch === branch) : allItems;

    const recsWithData = buildRecommendationData(items);
    const recsWithAI   = await generateAIDescriptions(recsWithData);
    const result       = recsWithAI.map(({ data, ...rest }) => rest);
    res.json(result);
  } catch (err) {
    console.error('recommendations error:', err);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// GET /api/actions/promote-opportunities
router.get('/promote-opportunities', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) > 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  const products  = aggregateItems(items);
  const profitMed = median(products.map(p => p.total_profit));
  const qtyMed    = median(products.map(p => p.qty));

  res.json(
    products
      .filter(p => p.total_profit_pct > 60)
      .map(p => ({ ...p, menu_class: menuClass(p, profitMed, qtyMed) }))
      .sort((a, b) => b.total_profit - a.total_profit)
      .slice(0, Number(limit))
  );
});

// GET /api/actions/profit-traps
router.get('/profit-traps', (req, res) => {
  const { limit = 20, branch } = req.query;
  let items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item' && (r.total_profit || 0) < 0);
  if (branch && branch !== 'all') items = items.filter(r => r.branch === branch);

  res.json(
    aggregateItems(items)
      .sort((a, b) => a.total_profit - b.total_profit)
      .slice(0, Number(limit))
  );
});

// POST /api/actions/simulate (legacy lever simulator)
router.post('/simulate', (req, res) => {
  const { hotBarUpsell = 0, cinnamonRollPush = 0, grabGoAttach = 0, toppingCostReduce = 0 } = req.body;
  const items = getDataset('profit_by_item.csv').filter(r => r.row_type === 'item');
  const sum   = (arr, field = 'total_profit') => arr.reduce((s, r) => s + (r[field] || 0), 0);

  const hotBarItems  = items.filter(r => r.division === 'HOT BAR SECTION'   && (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  const crItems      = items.filter(r => r.division === 'CINNAMON ROLLS'    && (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  const ggItems      = items.filter(r => r.division === 'GRAB&GO BEVERAGES' && (r.total_profit || 0) > 0 && (r.total_price || 0) > 0);
  const toppingNames = ['BLUEBERRIES COMBO','STRAWBERRY COMBO','MANGO COMBO','PINEAPPLE COMBO',
    'BROWNIES COMBO','LOTUS BISCUIT COMBO','CHOCOLATE CHIPS COMBO','OREO COMBO',
    'MARSHMALLOW COMBO','GUMMY BEARS COMBO','WAFER ROLL COMBO'];
  const toppingItems = items.filter(r => toppingNames.includes(r.product_desc) && (r.total_price || 0) === 0);

  const hotBarProfit    = sum(hotBarItems);
  const cinnamonProfit  = sum(crItems);
  const grabGoProfit    = sum(ggItems);
  const toppingCostPool = Math.abs(sum(toppingItems));
  const totalProfit     = sum(items);

  const hotBarImpact   = hotBarProfit    * (hotBarUpsell      / 100) * 0.18;
  const cinnamonImpact = cinnamonProfit  * (cinnamonRollPush  / 100) * 0.30;
  const grabGoImpact   = grabGoProfit    * (grabGoAttach      / 100) * 0.22;
  const toppingImpact  = toppingCostPool * (toppingCostReduce / 100) * 1.00;

  const totalUplift       = hotBarImpact + cinnamonImpact + grabGoImpact + toppingImpact;
  const upliftPct         = totalProfit > 0 ? (totalUplift / totalProfit * 100) : 0;
  const maxImpact         = Math.max(hotBarImpact, cinnamonImpact, grabGoImpact, toppingImpact, 1);
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
    confidence, maxImpact: Math.round(maxImpact),
    breakdown: [
      { lever: 'Hot Bar Upsell',         impact: Math.round(hotBarImpact),   pct: hotBarUpsell      },
      { lever: 'Cinnamon Roll Attach',   impact: Math.round(cinnamonImpact), pct: cinnamonRollPush  },
      { lever: 'Grab&Go Attach',         impact: Math.round(grabGoImpact),   pct: grabGoAttach      },
      { lever: 'Topping COGS Reduction', impact: Math.round(toppingImpact),  pct: toppingCostReduce },
    ],
    segments: {
      hotBarProfit:       Math.round(hotBarProfit),
      cinnamonRollProfit: Math.round(cinnamonProfit),
      grabGoProfit:       Math.round(grabGoProfit),
      toppingCostPool:    Math.round(toppingCostPool),
    },
  });
});

module.exports = router;
