export const onRequestPost = async ({ request, env }) => {
  const key = request.headers.get("x-admin-key");
  if (!key || key !== env.ADMIN_KEY) return j({ ok:false, error:"Unauthorized" }, 401);
  return j({ ok:true });
};
const j = (obj, status=200)=> new Response(JSON.stringify(obj), { status, headers:{ "Content-Type":"application/json" }});