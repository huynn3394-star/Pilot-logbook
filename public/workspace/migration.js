import {clone,canonical,sha256,bytes,validateRecord,validateEvidence,validUID,MAX_OPERATION_BYTES} from './schema.js';
import {flightKey} from '../lib/domain.js';
import {prepareEvidence} from './evidence.js';
import {references} from './pull.js';
const key=r=>r.kind+'\0'+r.id,rank={person:0,duty:1,profile:2,preferences:3,flight:4};
const selected=(ids,r)=>!ids||ids.includes(key(r));
export function blobFromDataURL(value){if(typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('Ảnh backup không hợp lệ.');const split=value.indexOf(','),mime=value.slice(5,value.indexOf(';')),raw=atob(value.slice(split+1));return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:mime});}
export async function previewRecords({records,current,raw,images=[],selectedIds,blockedRows=[]}){
 if(!validUID(current?.uid))throw Error('Tài khoản đích không hợp lệ.');const seen=new Set(),valid=[];blockedRows=clone(blockedRows);
 for(const r of records){if(!selected(selectedIds,r))continue;try{validateRecord(r);if(seen.has(key(r)))throw Error('ID trùng trong bản nhập.');seen.add(key(r));valid.push(clone(r));}catch(error){blockedRows.push({kind:r.kind,id:r.id,message:error.message});}}
 if(valid.filter(r=>r.kind==='flight').length>10000)throw Error('Backup vượt 10.000 chuyến.');
 const collisions=[],changes=[],sourceKeys=new Set();const byKey=new Map(current.records.map(r=>[key(r),r])),flights=new Map(current.records.filter(r=>r.kind==='flight'&&!r.archived).map(r=>[flightKey(r.data),r]));
 for(const incoming of valid){let next=clone(incoming),base=byKey.get(key(next))||null;
  if(next.kind==='flight'&&!next.archived){const incomingKey=flightKey(next.data);if(sourceKeys.has(incomingKey)){blockedRows.push({kind:next.kind,id:next.id,message:'Nguồn có chuyến trùng ngày/số hiệu.'});continue;}sourceKeys.add(incomingKey);const match=flights.get(flightKey(next.data));if(base&&flightKey(base.data)!==flightKey(next.data)){blockedRows.push({kind:next.kind,id:next.id,message:'ID trùng nhưng ngày/số chuyến khác.'});continue;}
   if(match){base=match;next.id=base.id;next.data.id=base.id;collisions.push({kind:'flight',id:incoming.id,targetId:base.id,protected:base.data.confirmed===true});if(base.data.confirmed)next=clone(base);}
   else flights.set(flightKey(next.data),next);
  }else if(base&&canonical({...base,revision:0})!==canonical({...next,revision:0}))collisions.push({kind:next.kind,id:next.id,protected:false});
  // Existing differing crew/duty/profile data gets a visible conflict; imports
  // cannot pretend the incoming version was the user's current form base.
  const compare=base&&canonical({...base,revision:0})===canonical({...next,revision:0});changes.push({kind:next.kind,id:next.id,base:next.kind==='flight'||compare?clone(base):null,next});
 }
 const graph=new Map(current.records.map(r=>[key(r),r]));for(const c of changes)graph.set(key(c),c.next);
 for(const c of changes)for(const ref of references(c.next))if(!graph.has(key(ref)))blockedRows.push({kind:c.kind,id:c.id,message:'Thiếu tham chiếu '+ref.kind+': '+ref.id});
 changes.sort((a,b)=>rank[a.kind]-rank[b.kind]||(a.id<b.id?-1:a.id>b.id?1:0));
 // Revision and edit timestamps do not identify the selected source content.
 const normalized=valid.map(r=>{const value=clone(r);value.revision=0;delete value.data.updatedAt;return value;}).sort((a,b)=>(key(a)<key(b)?-1:key(a)>key(b)?1:0));
 const importHash=await sha256(canonical(normalized)),parts=[];
 // Three worst-case base+next records fit even when each is 128 KiB; this
 // deterministic partition does not depend on per-device outbox parent IDs.
 for(let i=0;i<changes.length;i+=3){const chunk=changes.slice(i,i+3);if(bytes(chunk)>MAX_OPERATION_BYTES-8192)throw Error('Phần nhập vượt giới hạn operation.');parts.push({index:parts.length,changes:chunk});}
 for(const part of parts)part.importPart={hash:importHash,index:part.index,total:parts.length};
 const wanted=new Set(changes.filter(c=>c.next.evidence).map(c=>c.next.evidence.sha256));images=images.filter(image=>wanted.has(image.ref.sha256));
 return{targetUID:current.uid,raw:clone(raw),changes,parts,images,importHash,blockedRows,collisions,counts:Object.fromEntries(Object.keys(rank).map(kind=>[kind,valid.filter(r=>r.kind===kind).length])),bytes:images.reduce((n,i)=>n+i.ref.bytes,0),profilePreferences:{profile:valid.find(r=>r.kind==='profile')?.data,preferences:valid.find(r=>r.kind==='preferences')?.data},complete:!blockedRows.length};
}
export async function previewMigration({source,sourceText,current,selectedIds,includeDemo=false}){
 if((sourceText!==undefined&&new TextEncoder().encode(sourceText).length>50*1024*1024)||bytes(source)>50*1024*1024)throw Error('Backup v1 tối đa 50 MiB.');
 if(!source||source.version!==1||!Array.isArray(source.flights)||!Array.isArray(source.people)||!Array.isArray(source.duties))throw Error('Backup không đúng định dạng AviLog v1.');if(source.flights.length>10000)throw Error('Backup vượt 10.000 chuyến.');
 const raw={source:clone(source)};if(sourceText!==undefined)raw.sourceText=sourceText;const records=[],images=[],blockedRows=[];
 if(source.demo&&!includeDemo)return previewRecords({records,current,raw,blockedRows:[{kind:'demo',message:'Dữ liệu mẫu chưa được chọn nhập.'}]});
 async function add(kind,data,archive){
  const record={schemaVersion:1,kind,id:data.id,revision:0,archived:Boolean(archive),data:clone(data)};if(!selected(selectedIds,record))return;
  if(archive)record.archive={id:archive.id,at:archive.at};
  try{if(kind==='flight'){if(record.data.attachment){const image=await prepareEvidence(blobFromDataURL(record.data.attachment));record.evidence=image.ref;images.push(image);}else if(record.data.evidence){validateEvidence(record.data.evidence);record.evidence={...clone(record.data.evidence),cloudReady:false};}delete record.data.attachment;delete record.data.evidence;}records.push(record);}catch(error){blockedRows.push({kind,id:record.id,message:error.message});}
 }
 for(const [kind,items]of[['person',source.people],['duty',source.duties],['flight',source.flights]])for(const item of items)await add(kind,item);
 for(const archived of source.trash||[]){if(!['flight','duty','person'].includes(archived.kind)){blockedRows.push({kind:'trash',id:archived.id,message:'Loại thùng rác không hợp lệ.'});continue;}await add(archived.kind,archived.data,archived);if(archived.kind==='duty')for(const r of records)if(r.kind==='flight'&&!r.data.dutyId&&archived.flightIds?.includes(r.id))r.data.dutyId=archived.data.id;}
 const settings=source.settings||{},profile={},preferences={};for(const k of['name','base'])if(settings[k]!==undefined)profile[k]=settings[k];for(const k of['tomorrow','beforeDuty','missingActual','leadMinutes','eveningHour'])if(settings[k]!==undefined)preferences[k]=settings[k];
 for(const [kind,data]of[['profile',profile],['preferences',preferences]])if(Object.keys(data).length)records.push({schemaVersion:1,kind,id:kind,revision:0,archived:false,data});
 const unknown=Object.keys(settings).filter(k=>!['name','base','tomorrow','beforeDuty','missingActual','leadMinutes','eveningHour','notifications'].includes(k));if(unknown.length)blockedRows.push({kind:'preferences',message:'Cài đặt chưa hỗ trợ: '+unknown.join(', ')});
 const preview=await previewRecords({records,current,raw,images,selectedIds,blockedRows});preview.missingImages=preview.changes.filter(c=>c.next.evidence&&!preview.images.some(i=>i.ref.sha256===c.next.evidence.sha256)).map(c=>c.next.evidence.sha256);preview.complete&&=!preview.missingImages.length;return preview;
}
export async function stageMigration({repository,preview,confirm,token}){
 if(repository.uid!==preview.targetUID||token?.uid!==preview.targetUID)throw Error('Tài khoản đích đã đổi.');
 if(preview.blockedRows.length)throw Error('Còn dữ liệu bị chặn; chọn lại bản ghi trước khi nhập.');
 if(!await confirm(preview))return false;
 await repository.saveRecovery({format:'avilog-workspace-recovery',version:1,...clone(preview.raw),preview:{importHash:preview.importHash,targetUID:preview.targetUID,collisions:preview.collisions}},token);
 for(const part of preview.parts){if(repository.uid!==token.uid)throw Error('Tài khoản đích đã đổi.');const wanted=new Set(part.changes.filter(c=>c.next.evidence).map(c=>c.next.evidence.sha256)),images=preview.images.filter(i=>wanted.has(i.ref.sha256)&&i.blob);await repository.save({changes:part.changes,blobs:images,transfers:images.map(i=>({id:'upload-'+i.ref.sha256,hash:i.ref.sha256,direction:'upload',state:'pending'})),importPart:part.importPart,token});}
 return true;
}
