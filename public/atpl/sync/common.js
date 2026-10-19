// Canonical object keys; array order and original report contents remain significant.
export const clone=value=>structuredClone(value);
export const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
export const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)))),b=>b.toString(16).padStart(2,'0')).join('');}
export function unionReports(...lists){return [...new Map(lists.flat().map(r=>[canonical(r),clone(r)])).values()];}
export function legacyMax(account,guest){
 const out=clone(account);out.progress??={};
 for(const [id,p]of Object.entries(guest.progress||{})){
  const old=out.progress[id];if(!old){out.progress[id]=clone(p);continue;}
  const attempts=Math.max(old.attempts,p.attempts),correct=Math.min(attempts,Math.max(old.correct,p.correct));
  out.progress[id]={...(p.attempts>old.attempts?p:old),attempts,correct};
 }
 out.bookmarks=[...new Set([...(out.bookmarks||[]),...(guest.bookmarks||[])])].sort((a,b)=>a-b);
 const wrong=new Set(out.wrong||[]);for(const [id,p]of Object.entries(guest.progress||{}))if(!account.progress?.[id]||p.attempts>account.progress[id].attempts){if((guest.wrong||[]).includes(Number(id)))wrong.add(Number(id));else wrong.delete(Number(id));}
 out.wrong=[...wrong];out.examHistory=unionReports(out.examHistory||[],guest.examHistory||[]);
 out.study??=clone(guest.study||null);out.exam??=clone(guest.exam||null);return out;
}

export const importSessionID=(epoch,id,kind)=>hash({epoch,id,kind}).then(value=>`import-${value}`);
