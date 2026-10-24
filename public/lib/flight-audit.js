/** Application audit history. Device timestamps/digests are not certified signatures. */
export const protectedFlightFields=['date','flightNo','actual','confirmed','dep','dest','aircraft','reg','role','picMinutes','nightMinutes','takeoffBy','landingBy','landingMode','captainId','foId','crewIds','source','logbook'];
const snapshotKeys=[...protectedFlightFields,'note','confidence','evidenceHash'];
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export function stableValue(v){if(Array.isArray(v))return '['+v.map(stableValue).join(',')+']';if(plain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stableValue(v[k])).join(',')+'}';return JSON.stringify(v??null);}
const equal=(a,b)=>stableValue(a)===stableValue(b);
function normalized(f,key){if(key==='actual')return f?.actual||{};if(key==='crewIds')return f?.crewIds||[];if(key==='confirmed')return f?.confirmed===true;if(['picMinutes','nightMinutes'].includes(key))return f?.[key]??0;if(key==='logbook')return f?.logbook??null;return f?.[key]??'';}
export function requiresFinalPermission(previous,next,{beforeEvidence,afterEvidence}={}){
 return previous?.confirmed===true&&(protectedFlightFields.some(k=>!equal(normalized(previous,k),normalized(next,k)))||(beforeEvidence!==undefined&&afterEvidence!==undefined&&beforeEvidence!==afterEvidence));
}
function snapshot(f,evidenceHash){const s={};for(const k of snapshotKeys)if(k!=='evidenceHash')s[k]=structuredClone(normalized(f,k));s.evidenceHash=evidenceHash??f?.evidence?.sha256??'';return s;}
export function validateAuditTrail(trail){
 if(trail===undefined)return;
 if(!plain(trail)||trail.version!==1||Object.keys(trail).some(k=>!['version','entries'].includes(k))||!Array.isArray(trail.entries)||trail.entries.length>100)throw Error('Lịch sử chỉnh sửa V14 không hợp lệ hoặc vượt 100 lượt.');
 const seen=new Set();
 for(const e of trail.entries){
  if(!plain(e)||Object.keys(e).some(k=>!['id','at','action','reason','before','after'].includes(k))||typeof e.id!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(e.id)||seen.has(e.id)||typeof e.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(e.at)||!Number.isFinite(Date.parse(e.at))||!['confirmed','revised-final','reopened','edited'].includes(e.action)||typeof e.reason!=='string'||e.reason.length>500)throw Error('Một mục lịch sử chỉnh sửa không hợp lệ.');
  seen.add(e.id);
  for(const snap of [e.before,e.after]){
   if(!plain(snap)||Object.keys(snap).some(k=>!snapshotKeys.includes(k)))throw Error('Trường lịch sử không được hỗ trợ; không lưu ảnh gốc trong lịch sử.');
   if(JSON.stringify(snap).includes('data:image/'))throw Error('Không lưu byte ảnh trong lịch sử chỉnh sửa.');
  }
 }
 if(new TextEncoder().encode(JSON.stringify(trail)).length>80000)throw Error('Lịch sử vượt 80 KB. Xuất backup trước; không cắt lịch sử để lưu.');
}
export function validateAuditTransition(previous,next){
 validateAuditTrail(next?.auditTrail);
 const before=previous?.auditTrail?.entries||[],after=next?.auditTrail?.entries||[];
 if(after.length<before.length||before.some((entry,i)=>!equal(entry,after[i])))throw Error('Không được xóa hoặc sửa lịch sử đã lưu.');
}
/** Persistence boundary: edits after a recorded FINAL need a new history entry. */
export function validateAuditedChange(previous,next,{beforeEvidence,afterEvidence}={}){
 validateAuditTransition(previous,next);
 const before=previous?.auditTrail?.entries||[],after=next?.auditTrail?.entries||[];
 if(before.length&&after.length===before.length&&!equal(snapshot(previous,beforeEvidence),snapshot(next,afterEvidence)))throw Error('Thay đổi chuyến đã kiểm tra cần thêm lịch sử chỉnh sửa trước khi lưu.');
}
export function recordFlightRevision(previous,next,{at=new Date().toISOString(),entryId=globalThis.crypto.randomUUID(),reason='',replaceConfirmed=false,beforeEvidence,afterEvidence}={}){
 const protectedChange=requiresFinalPermission(previous,next,{beforeEvidence,afterEvidence});
 if(protectedChange&&(!replaceConfirmed||!String(reason).trim()))throw Error('Sửa FINAL cần cho phép thay đổi và ghi lý do.');
 validateAuditTransition(previous,next);
 const result=structuredClone(next),before=snapshot(previous,beforeEvidence),after=snapshot(next,afterEvidence);
 const keys=snapshotKeys.filter(k=>!equal(before[k],after[k]));
 if(!keys.length||!previous?.confirmed&&!next.confirmed&&!previous?.auditTrail)return result;
 const entries=structuredClone(previous?.auditTrail?.entries||[]);
 const action=!previous?.confirmed&&next.confirmed?'confirmed':previous?.confirmed&&!next.confirmed?'reopened':protectedChange?'revised-final':'edited';
 const select=s=>Object.fromEntries((entries.length?keys:snapshotKeys).map(k=>[k,s[k]]));
 entries.push({id:entryId,at,action,reason:String(reason).trim(),before:previous?select(before):{},after:select(after)});
 result.auditTrail={version:1,entries};validateAuditTrail(result.auditTrail);return result;
}
export async function evidenceFingerprint(f){
 if(!f?.attachment)return f?.evidence?.sha256||'';
 const match=/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(f.attachment);
 if(!match)throw Error('Ảnh minh chứng không hợp lệ.');
 const raw=atob(match[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
