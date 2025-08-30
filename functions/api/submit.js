import { validBracket, getResults, scorePicks } from "../_utils";

export const onRequestPost = async ({ request, env }) => {
  const lock = new Date(env.LOCK_TIME);
  if (new Date() >= lock) {
    return json({ ok:false, error:"Entries are locked." }, 403);
  }

  const body = await request.json().catch(()=>null);
  if (!body || typeof body.nickname !== "string" || !validBracket(body.picks)
      || typeof body.tiebreak !== "number" || body.tiebreak < 0) {
    return json({ ok:false, error:"Invalid payload." }, 400);
  }

  const nickname = body.nickname.trim().slice(0, 32);
  const entry = { nickname, picks: body.picks, tiebreak: Math.floor(body.tiebreak), ts: Date.now() };

  const id = crypto.randomUUID();
  await env.BRACKET_KV.put(`entry:${id}`, JSON.stringify(entry));

  const results = await getResults(env);
  const points = scorePicks(entry.picks, results);

  return json({ ok:true, id, points });
};

function json(obj, status=200){
  return new Response(JSON.stringify(obj), { status, headers:{ "Content-Type":"application/json" }});
}