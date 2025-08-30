export const onRequestPost = async ({ request, env }) => {
  const key = request.headers.get("x-admin-key");
  if (!key || key !== env.ADMIN_KEY) return j({ ok:false, error:"Unauthorized" }, 401);
  const body = await request.json().catch(()=>null);
  if (!body || typeof body.results !== "object") return j({ ok:false, error:"Bad payload" }, 400);
  const r = body.results;
  const clean = {};
  for (const k of ["qf1","qf2","qf3","qf4","sf1","sf2","final"]) {
    clean[k] = (r[k]===null || typeof r[k]==="string") ? r[k] : null;
  }
  await env.BRACKET_KV.put("results", JSON.stringify(clean));
  return j({ ok:true, results: clean });
};
const j = (obj, status=200)=> new Response(JSON.stringify(obj), { status, headers:{ "Content-Type":"application/json" }});