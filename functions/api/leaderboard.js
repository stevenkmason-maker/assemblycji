import { getResults, scorePicks } from "../_utils";

export const onRequestGet = async ({ env }) => {
  const results = await getResults(env);
  const all = [];
  let cursor;
  do {
    const page = await env.BRACKET_KV.list({ prefix:"entry:", cursor });
    cursor = page.cursor;
    for (const k of page.keys) {
      const e = await env.BRACKET_KV.get(k.name, { type:"json" });
      if (!e) continue;
      all.push(e);
    }
  } while (cursor);

  const total = all.length;
  const entries = all.map(e => ({
    nickname: e.nickname,
    points: scorePicks(e.picks, results),
    tiebreak_diff: Math.abs((e.tiebreak ?? 0) - total),
    ts: e.ts
  }))
  .sort((a,b)=>{
    if (b.points !== a.points) return b.points - a.points;
    if (a.tiebreak_diff !== b.tiebreak_diff) return a.tiebreak_diff - b.tiebreak_diff;
    return a.ts - b.ts;
  });

  return new Response(JSON.stringify({ entries, total }), { headers:{ "Content-Type":"application/json" }});
};