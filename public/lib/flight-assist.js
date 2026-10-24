/** Read-only matching in the active user's workspace. No network calls or storage writes. */
import {icaoFor} from './parsers.js';

export function normalizeFlightCode(value){
 const code=String(value??'').trim().toUpperCase().replace(/\s/g,'');
 const match=/^([A-Z]{2,3})(\d{1,5})([A-Z]?)$/.exec(code);
 if(!match)return '';
 // Explicit airline alias only; other IATA/ICAO prefixes are never guessed.
 return (match[1]==='HVN'?'VN':match[1])+String(Number(match[2]))+match[3];
}
function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
const airport=value=>icaoFor(String(value||'').trim().toUpperCase());
export function lookupFlights(flights,{flightNo,date,excludeId}={}){
 const code=normalizeFlightCode(flightNo);
 if(!code||!validDay(date))return {kind:'none',matches:[],routes:[]};
 const candidates=(flights||[]).filter(f=>f.id!==excludeId&&normalizeFlightCode(f.flightNo)===code);
 const matches=candidates.filter(f=>f.date===date).map(f=>structuredClone(f));
 if(matches.length)return {kind:matches.length===1?'same-day':'ambiguous',matches,routes:[]};
 const routes=[],seen=new Set();
 for(const f of candidates.filter(f=>f.confirmed&&validDay(f.date)&&f.date<date&&/^[A-Z]{3,4}$/.test(f.dep)&&/^[A-Z]{3,4}$/.test(f.dest)).sort((a,b)=>b.date.localeCompare(a.date))){
  const key=airport(f.dep)+'>'+airport(f.dest);if(seen.has(key))continue;seen.add(key);
  routes.push({dep:f.dep,dest:f.dest,date:f.date});if(routes.length===12)break;
 }
 return {kind:routes.length?'history':'none',matches:[],routes};
}
const scanKeys=['dep','dest','actual.out','actual.off','actual.on','actual.in'];
const valueFor=(flight,key)=>key.startsWith('actual.')?flight?.actual?.[key.slice(7)]:flight?.[key];
export function scanComparison(previous,scan){
 return scanKeys.map(key=>{
  const before=valueFor(previous,key)||null,after=valueFor(scan,key)||null;
  const equal=before&&after&&(key.startsWith('actual.')?Date.parse(before)===Date.parse(after):airport(before)===airport(after));
  return {key,before,after,state:!after?'missing':!before?'new':equal?'same':'different'};
 });
}
export function prepareScanDraft(previous,scan){
 if(previous&&(!normalizeFlightCode(scan.flightNo)||normalizeFlightCode(previous.flightNo)!==normalizeFlightCode(scan.flightNo)||previous.date!==scan.date))throw Error('Ảnh và bản ghi không khớp chuyến/ngày UTC. Kiểm tra lại trước khi ghép.');
 const draft={...structuredClone(previous||{}),...structuredClone(scan),id:previous?.id||scan.id,confirmed:false};
 draft.flightNo=previous?.flightNo||scan.flightNo; // Keep the existing key/alias; do not re-key cloud records.
 draft.dep=scan.dep||previous?.dep||'';draft.dest=scan.dest||previous?.dest||'';
 draft.actual={...previous?.actual};for(const k of ['out','off','on','in'])if(scan.actual?.[k])draft.actual[k]=scan.actual[k];
 draft.scheduled=structuredClone(previous?.scheduled||{});
 for(const k of ['role','captainId','foId','crewIds','picMinutes','nightMinutes','logbook','auditTrail'])if(previous?.[k]!==undefined)draft[k]=structuredClone(previous[k]);
 draft.aircraft=previous?.aircraft||scan.aircraft||'';draft.reg=previous?.reg||scan.reg||'';
 draft.note=previous?.note||scan.note||'';
 return draft;
}
