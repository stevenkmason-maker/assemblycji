// /functions/api/stats.js
import { getResults } from "../_utils";

const GAME_KEYS = ["qf1","qf2","qf3","qf4","sf1","sf2","final"];

export const onRequestGet = async ({ env }) => {
  if (!env.BRACKET_KV) {
    return j({ error: "KV binding BRACKET_KV is missing" }, 500);
  }

  // Collect all entries
  const all = [];
  let cursor = undefined;
  while (true) {
    const page = await env.BRACKET_KV.list({ prefix: "entry:", cursor });
    for (const { name } of page.keys) {
      const e = await env.BRACKET_KV.get(name, { type: "json" });
      if (e) all.push(e);
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  const total = all.length;

  // Early: results (to compute correct rates)
  const results = await getResults(env);

  // Empty-state
  if (total === 0) {
    const correct_rates = Object.fromEntries(GAME_KEYS.map(k => [k, null]));
    return j({
      total: 0,
      percentages: {},
      correct_rates,
      average_bracket: null,
      closest: null,
      furthest: null,
      tiebreak: { avg: null, median: null, min: null, max: null },
      submissions: { earliest: null, latest: null, perHour: [] },
      results,
      notes: "No entries yet."
    });
  }

  // Pick percentages for each game
  const counts = {};
  for (const k of GAME_KEYS) counts[k] = {};
  for (const e of all) {
    for (const k of GAME_KEYS) {
      const t = e.picks?.[k];
      if (!t) continue;
      counts[k][t] = (counts[k][t] || 0) + 1;
    }
  }
  const percentages = {};
  for (const k of GAME_KEYS) {
    const map = counts[k];
    const list = Object.entries(map).map(([team, c]) => ({
      team, count: c, pct: +(100 * c / total).toFixed(2)
    })).sort((a,b)=> b.count - a.count || a.team.localeCompare(b.team));
    percentages[k] = list;
  }

  // Correct pick rate per game (if we have a result for that game)
  const correct_rates = {};
  for (const k of GAME_KEYS) {
    const winner = results?.[k];
    if (!winner) { correct_rates[k] = null; continue; }
    const correct = counts[k]?.[winner] || 0;
    correct_rates[k] = {
      winner,
      count: correct,
      pct: +(100 * correct / total).toFixed(2)
    };
  }

  // Build a consistent “average” bracket (modes with constraints)
  const modeOf = (arr) => {
    if (!arr.length) return null;
    const m = new Map();
    for (const x of arr) m.set(x, (m.get(x)||0)+1);
    let best = null, bestC = -1;
    for (const [k,v] of m.entries()) if (v>bestC) { best=k; bestC=v; }
    return best;
  };

  const qf1_mode = modeOf(all.map(e => e.picks?.qf1).filter(Boolean));
  const qf2_mode = modeOf(all.map(e => e.picks?.qf2).filter(Boolean));
  const qf3_mode = modeOf(all.map(e => e.picks?.qf3).filter(Boolean));
  const qf4_mode = modeOf(all.map(e => e.picks?.qf4).filter(Boolean));

  const sf1_candidates = [qf1_mode, qf2_mode].filter(Boolean);
  const sf2_candidates = [qf3_mode, qf4_mode].filter(Boolean);

  const sf1_mode_raw = modeOf(all.map(e => e.picks?.sf1).filter(Boolean));
  const sf2_mode_raw = modeOf(all.map(e => e.picks?.sf2).filter(Boolean));

  const chooseConstrained = (raw, allowed, k) => {
    if (raw && allowed.includes(raw)) return raw;
    const map = counts[k];
    let best = null, bestC = -1;
    for (const t of allowed) {
      const c = map?.[t] || 0;
      if (c > bestC) { best = t; bestC = c; }
    }
    return best || allowed[0] || null;
  };

  const sf1_mode = chooseConstrained(sf1_mode_raw, sf1_candidates, "sf1");
  const sf2_mode = chooseConstrained(sf2_mode_raw, sf2_candidates, "sf2");

  const final_candidates = [sf1_mode, sf2_mode].filter(Boolean);
  const final_mode_raw = modeOf(all.map(e => e.picks?.final).filter(Boolean));
  const final_mode = chooseConstrained(final_mode_raw, final_candidates, "final");

  const average_bracket = {
    qf1: qf1_mode, qf2: qf2_mode, qf3: qf3_mode, qf4: qf4_mode,
    sf1: sf1_mode, sf2: sf2_mode, final: final_mode
  };

  // Distance to average (Hamming distance across 7 picks)
  const dist = (a, b) => {
    let d = 0;
    for (const k of GAME_KEYS) if ((a?.[k] || null) !== (b?.[k] || null)) d++;
    return d;
  };
  const withDist = all.map(e => ({
    nickname: e.nickname,
    ts: e.ts,
    distance: dist(e.picks, average_bracket)
  })).sort((a,b)=> a.distance - b.distance || a.ts - b.ts);

  const closest = withDist[0];
  const furthest = withDist[withDist.length - 1];

  // Tiebreak stats and submission timing
  const tbs = all.map(e => e.tiebreak).filter(n => Number.isFinite(n)).sort((a,b)=>a-b);
  const mean = tbs.length ? tbs.reduce((s,x)=>s+x,0)/tbs.length : null;
  const median = tbs.length ? (tbs[Math.floor((tbs.length-1)/2)] + tbs[Math.ceil((tbs.length-1)/2)]) / 2 : null;

  const perHourMap = new Map();
  let minTs = Infinity, maxTs = -Infinity;
  for (const e of all) {
    minTs = Math.min(minTs, e.ts);
    maxTs = Math.max(maxTs, e.ts);
    const d = new Date(e.ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`;
    perHourMap.set(key, (perHourMap.get(key)||0)+1);
  }
  const perHour = [...perHourMap.entries()].sort((a,b)=> a[0].localeCompare(b[0]))
                    .map(([hour,count]) => ({ hour_utc: hour, count }));

  return j({
    total,
    percentages,
    correct_rates,
    average_bracket,
    closest,
    furthest,
    tiebreak: {
      avg: tbs.length ? +mean.toFixed(2) : null,
      median,
      min: tbs.length ? tbs[0] : null,
      max: tbs.length ? tbs[tbs.length-1] : null
    },
    submissions: {
      earliest: isFinite(minTs) ? new Date(minTs).toISOString() : null,
      latest: isFinite(maxTs) ? new Date(maxTs).toISOString() : null,
      perHour
    },
    results: results || null
  });
};

const j = (obj, status=200)=> new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json" }
});
