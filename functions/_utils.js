export const TEAMS = [
  "New Wave","Americas Misfits",
  "Atos","Europe Misfits",
  "B-Team","Daisy Fresh",
  "Australasia Misfits","10th Planet"
];

export function validBracket(p) {
  const req = ["qf1","qf2","qf3","qf4","sf1","sf2","final"];
  for (const k of req) if (!p[k] || typeof p[k] !== "string") return false;
  if (![p.qf1,p.qf2].includes(p.sf1)) return false;
  if (![p.qf3,p.qf4].includes(p.sf2)) return false;
  if (![p.sf1,p.sf2].includes(p.final)) return false;
  if (![p.qf1,p.qf2,p.qf3,p.qf4].every(t => TEAMS.includes(t))) return false;
  return true;
}

export function scorePicks(picks, results){
  let pts = 0;
  if (results.qf1 && picks.qf1===results.qf1) pts+=5;
  if (results.qf2 && picks.qf2===results.qf2) pts+=5;
  if (results.qf3 && picks.qf3===results.qf3) pts+=5;
  if (results.qf4 && picks.qf4===results.qf4) pts+=5;
  if (results.sf1 && picks.sf1===results.sf1) pts+=10;
  if (results.sf2 && picks.sf2===results.sf2) pts+=10;
  if (results.final && picks.final===results.final) pts+=20;
  return pts;
}

export async function getResults(env){
  const raw = await env.BRACKET_KV.get("results", { type:"json" });
  return raw || { qf1:null,qf2:null,qf3:null,qf4:null,sf1:null,sf2:null,final:null };
}
