export const onRequestGet = async ({ env }) => {
  const lock_iso = env.LOCK_TIME;
  return new Response(JSON.stringify({ lock_iso }), { headers: { "Content-Type":"application/json" }});
};