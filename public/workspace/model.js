import {clone,canonical,validateRecord,validUID} from './schema.js';
export const same=(a,b)=>canonical(a)===canonical(b);
const dataValue=(r,keys)=>keys.map(k=>Object.hasOwn(r.data,k)?[k,true,r.data[k]]:[k,false]);
const actual=['actual','confirmed','dep','dest','aircraft','reg','role','picMinutes','nightMinutes','takeoffBy','landingBy','landingMode','captainId','foId','crewIds','source'];
export function groupsFor(kind){if(kind==='flight')return {identity:['date','flightNo'],scheduled:['scheduled'],actual,note:['note'],confidence:['confidence'],duty:['dutyId'],weather:['weather']};if(kind==='person')return {person:['id','name','rank','note']};if(kind==='duty')return {identity:['date','type'],times:['report','release'],note:['note']};if(kind==='profile')return {name:['name'],base:['base']};return Object.fromEntries(['tomorrow','beforeDuty','missingActual','leadMinutes','eveningHour','weatherAirports'].map(k=>[k,[k]]));}
const comparable=r=>{const c=clone(r);delete c.revision;delete c.data.updatedAt;return c;};
function conflict(base,local,remote,groups,reason='Hai phiên bản cùng sửa thông tin.'){return {record:null,conflict:{kind:local.kind,recordId:local.id,groups,base:clone(base),local:clone(local),remote:clone(remote),reason}};}
export function mergeRecord({base,local,remote}){
 validateRecord(local);if(base)validateRecord(base);if(remote)validateRecord(remote);
 if(!base){if(!remote)return {record:clone(local),conflict:null};return same(comparable(local),comparable(remote))?{record:clone(remote),conflict:null}:conflict(base,local,remote,['record'],'Hai bản ghi mới cùng ID khác nội dung.');}
 if(!remote)return conflict(base,local,remote,['record'],'Bản nền không còn trên cloud.');
 if([base,remote].some(r=>r.kind!==local.kind||r.id!==local.id))throw new Error('Không gộp bản ghi khác định danh.');
 const lc=!same(comparable(local),comparable(base)),rc=!same(comparable(remote),comparable(base)),la=local.archived!==base.archived,ra=remote.archived!==base.archived;
 if((la&&rc&&!same(comparable(local),comparable(remote)))||(ra&&lc&&!same(comparable(local),comparable(remote))))return conflict(base,local,remote,['archive'],'Lưu trữ/khôi phục xung đột với chỉnh sửa.');
 const result=clone(remote),conflicts=[];
 for(const [name,keys]of Object.entries(groupsFor(local.kind))){
  const b=dataValue(base,keys),l=dataValue(local,keys),r=dataValue(remote,keys);if(same(l,b))continue;
  if(!same(r,b)&&!same(l,r)){conflicts.push(name);continue;}
  if(name==='actual'&&base.data.confirmed!==true&&remote.data.confirmed===true&&!same(l,r)){conflicts.push(name);continue;}
  for(const k of keys)if(Object.hasOwn(local.data,k))result.data[k]=clone(local.data[k]);else delete result.data[k];
 }
 const b=base.evidence??null,l=local.evidence??null,r=remote.evidence??null;
 if(!same(l,b)){if(!same(r,b)&&!same(l,r)){if(l&&r&&same({...l,cloudReady:false},{...r,cloudReady:false}))result.evidence={...l,cloudReady:l.cloudReady||r.cloudReady};else conflicts.push('evidence');}else if(l)result.evidence=clone(l);else delete result.evidence;}
 if(la){result.archived=local.archived;if(local.archive)result.archive=clone(local.archive);else delete result.archive;}
 if(conflicts.length)return conflict(base,local,remote,conflicts);if(lc&&local.data.updatedAt!==undefined)result.data.updatedAt=local.data.updatedAt;
 try{validateRecord(result);}catch{return conflict(base,local,remote,['validation'],'Các thay đổi kết hợp không còn hợp lệ; cần xem lại.');}return {record:result,conflict:null};
}
export function emptySnapshot(uid){if(!validUID(uid))throw new Error('UID không hợp lệ.');return {schemaVersion:1,uid,cloudRevision:0,localVersion:0,records:[]};}
export function applyChanges(snapshot,changes){
 const next=clone(snapshot),index=new Map(next.records.map((r,i)=>[r.kind+'\0'+r.id,i]));
 for(const c of changes){validateRecord(c.next);if(c.kind!==c.next.kind||c.id!==c.next.id)throw new Error('Thay đổi khác định danh.');const key=c.kind+'\0'+c.id,i=index.get(key);if(i===undefined){index.set(key,next.records.length);next.records.push(clone(c.next));}else next.records[i]=clone(c.next);}return next;
}
