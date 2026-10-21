import {openWorkspace} from './repository.js';
import {readState,writeState} from '../lib/storage.js';
import {sampleState} from '../lib/sample.js';
import {archiveRecord,restoreRecord,flightKey} from '../lib/domain.js';
import {toWorkspaceView} from './projection.js';
import {clone,canonical,validateRecord} from './schema.js';
import {groupsFor} from './model.js';
import {prepareEvidence} from './evidence.js';
import {blobFromDataURL} from './migration.js';
import {icaoFor} from '../lib/parsers.js';
const key=r=>r.kind+'\0'+r.id,clean=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b)=>canonical(a??null)===canonical(b??null);
function equivalent(a,b,k){if(equal(a,b))return true;if(['captainId','foId','takeoffBy','landingBy','landingMode','dutyId'].includes(k)&&!a&&!b)return true;if(k==='crewIds'&&(!a||!a.length)&&(!b||!b.length))return true;if(['picMinutes','nightMinutes'].includes(k)&&(a||0)===(b||0))return true;return false;}
function entries(view){const result=[];for(const[kind,list]of[['flight',view.flights],['duty',view.duties],['person',view.people]])for(const data of list||[])result.push({kind,id:data.id,data,archived:false});for(const row of view.trash||[])result.push({kind:row.kind,id:row.data.id,data:row.data,archived:true,archive:{id:row.id,at:row.at}});return result;}
export async function openWorkspaceSession({coordinator,onView=()=>{},onStatus=()=>{},onTransition=()=>{},onLocalChange=()=>{},openRepository=openWorkspace,guestStorage={readState,writeState}}){
 const token=coordinator.capture(),uid=token.uid,identity=clone(coordinator.getCachedSelection()||{});let released=false,repository=null,snapshot=null,guest=null,device={},cached=null,refreshVersion=0;const urls=new Map();
 const current=t=>!released&&coordinator.isCurrent(t)&&t.uid===uid;
 const guard=(t=token)=>{if(!current(t))throw Error('Tài khoản đã đổi; không lưu dữ liệu của phiên cũ.');};
 function revoke(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();}
 const unsubscribe=coordinator.subscribe(()=>{if(!current(token)){revoke();onTransition({uid,token});}});
 async function refresh(){const version=++refreshVersion;guard();if(uid){const [next,prefs]=await Promise.all([repository.read(),repository.devicePreferences()]);guard();if(version!==refreshVersion)return; snapshot=next;device=prefs;cached=toWorkspaceView(snapshot,device);}else cached=clone(guest);onView(clone(cached));}
 try{if(uid){repository=await openRepository({uid,token,isCurrent:current,onChange:event=>{if(event?.localQueue&&current(token))onLocalChange();refresh().catch(error=>{if(current(token))onStatus({kind:'error',message:error.message});});}});await refresh();onStatus({kind:snapshot.localVersion||snapshot.cloudRevision||snapshot.records.length?'local':'not-loaded'});}else{guest=await guestStorage.readState();guard();if(!guest){guest=sampleState();await guestStorage.writeState(guest);guard();}await refresh();onStatus({kind:'guest'});}}catch(error){unsubscribe();repository?.release();throw error;}
 async function saveView({base,next,token:t=token,evidenceFile,confirmActualReplacement=false}){
  guard(t);if(!uid){if(!base?.guest)throw Error('Bản nền khách không hợp lệ.');const value=clean(next);await guestStorage.writeState(value);guard(t);guest=value;await refresh();return clone(cached);}
  if(base?.uid!==uid)throw Error('Bản nền khác tài khoản.');if(!repository.writable)throw Error('Workspace chỉ đọc; đóng tab đang ghi rồi mở lại.');
  const before=toWorkspaceView(base,device),baseView=new Map(entries(before).map(r=>[key(r),r])),raw=new Map(base.records.map(r=>[key(r),r])),desired=entries(clean(next)),seen=new Set(),changes=[],blobs=[];
  for(const item of desired){const recordKey=key(item);if(seen.has(recordKey))throw Error('Bản ghi trùng ID trong giao diện.');seen.add(recordKey);const original=raw.get(recordKey),previous=baseView.get(recordKey),data=clone(original?.data||{}),incoming=clone(item.data);delete incoming.attachment;delete incoming.evidence;
   const changed=[];for(const field of new Set([...Object.keys(previous?.data||{}),...Object.keys(incoming)])){if(['attachment','evidence'].includes(field))continue;if(equivalent(previous?.data[field],incoming[field],field))continue;changed.push(field);if(Object.hasOwn(incoming,field))data[field]=clone(incoming[field]);else delete data[field];}
   const record=original?clone(original):{schemaVersion:1,kind:item.kind,id:item.id,revision:0,archived:false,data:{}};record.data=original?data:incoming;record.archived=item.archived;if(item.archive)record.archive=clone(item.archive);else delete record.archive;
   if(original?.kind==='flight'&&original.data.confirmed&&changed.some(field=>groupsFor('flight').actual.includes(field))&&!confirmActualReplacement)throw Error('Actual đã xác nhận cần cho phép thay đổi rõ ràng.');
   if(record.kind==='flight'){
    if(record.data.weather){const weather=record.data.weather,stations=new Set([icaoFor(record.data.dep),icaoFor(record.data.dest)]);if(weather.day!==record.data.date)delete record.data.weather;else{weather.reports=weather.reports.filter(r=>stations.has(r.station));if(!weather.reports.length)delete record.data.weather;}}
    let candidate=evidenceFile?.file&&evidenceFile.id===record.id?evidenceFile.file:evidenceFile instanceof Blob&&desired.filter(r=>r.kind==='flight').length===1?evidenceFile:null;
    if(!candidate&&item.data.attachment&&item.data.attachment!==previous?.data.attachment)candidate=blobFromDataURL(item.data.attachment);
    if(candidate){const prepared=await prepareEvidence(candidate);guard(t);record.evidence=prepared.ref;blobs.push(prepared);}else if(item.data.evidence)record.evidence=clone(item.data.evidence);else if(previous?.data.evidence&&!item.data.evidence)delete record.evidence;
   }
   validateRecord(record);if(!original||!equal(record,original))changes.push({kind:record.kind,id:record.id,base:original||null,next:record});
  }
  for(const original of base.records.filter(r=>!['profile','preferences'].includes(r.kind)))if(!seen.has(key(original))&&!original.archived){const record={...clone(original),archived:true,archive:{id:crypto.randomUUID(),at:new Date().toISOString()}};changes.push({kind:record.kind,id:record.id,base:original,next:record});}
  for(const[kind,fields]of[['profile',['name','base']],['preferences',['tomorrow','beforeDuty','missingActual','leadMinutes','eveningHour','weatherAirports','weatherGroups']]]){const changed=fields.filter(k=>!equal(before.settings[k],next.settings[k]));if(!changed.length)continue;const original=raw.get(kind+'\0'+kind)||null,record=original?clone(original):{schemaVersion:1,kind,id:kind,revision:0,archived:false,data:{}};for(const field of fields)if(!original||changed.includes(field)){if(next.settings[field]!==undefined)record.data[field]=next.settings[field];else delete record.data[field];}validateRecord(record);changes.push({kind,id:kind,base:original,next:record});}
  const patch=Boolean(next.settings.notifications)!==Boolean(before.settings.notifications)?{notifications:Boolean(next.settings.notifications)}:undefined;
  if(changes.length||patch){const transfers=blobs.map(i=>({id:'upload-'+i.ref.sha256,hash:i.ref.sha256,direction:'upload',state:'pending'}));guard(t);await repository.save({changes,blobs,transfers,devicePatch:patch,token:t});guard(t);}await refresh();return clone(cached);
 }
 async function archive(kind,id,t=token){guard(t);if(!uid){guest=archiveRecord(guest,kind,id);await guestStorage.writeState(guest);await refresh();return clone(cached);}const state=await repository.read();guard(t);const record=state.records.find(r=>r.kind===kind&&r.id===id);if(!record||record.archived)throw Error('Không tìm thấy bản ghi active.');await repository.save({changes:[{kind,id,base:record,next:{...clone(record),archived:true,archive:{id:crypto.randomUUID(),at:new Date().toISOString()}}}],token:t});await refresh();return clone(cached);}
 async function restore(archiveId,t=token){guard(t);if(!uid){guest=restoreRecord(guest,archiveId);await guestStorage.writeState(guest);await refresh();return clone(cached);}const state=await repository.read();guard(t);const record=state.records.find(r=>r.archived&&r.archive.id===archiveId);if(!record)throw Error('Không tìm thấy bản ghi lưu trữ.');if(record.kind==='flight'&&state.records.some(r=>r.kind==='flight'&&!r.archived&&flightKey(r.data)===flightKey(record.data)))throw Error('Ngày/số chuyến đã có; cần xử lý xung đột trước khi khôi phục.');const next={...clone(record),archived:false};delete next.archive;await repository.save({changes:[{kind:record.kind,id:record.id,base:record,next}],token:t});await refresh();return clone(cached);}
 return{uid,token,displayIdentity:()=>identity.email||identity.displayName||uid||'Khách',get repository(){return repository;},get writable(){return !released&&(!uid||repository.writable)&&current(token);},view:()=>clone(cached),snapshot:()=>clone(snapshot),captureForm:()=>{guard();return{token:clone(token),base:uid?clone(snapshot):{guest:true,state:clone(guest)}};},isCurrent:()=>current(token),refresh,saveView,archive,restore,
  async saveDevicePreferences(patch,t=token){guard(t);if(uid)await repository.save({devicePatch:patch,token:t});else{guest.settings={...guest.settings,...patch};await guestStorage.writeState(guest);}await refresh();},
  async prepareSwitch({draft,exportDraft=async()=>false,confirmDiscard=async()=>false}){if(!draft)return true;try{guard();if(!repository)throw Error('Khách cần xuất bản nháp.');await repository.saveRecovery({draft:clone(draft),type:'draft',sourceUID:uid},token);return true;}catch{if(await exportDraft(draft))return true;return Boolean(await confirmDiscard(draft));}},
  imageURL:hash=>urls.get(hash)||null,async loadEvidence(hash,t=token){guard(t);if(urls.has(hash))return urls.get(hash);if(!repository)return null;const blob=await repository.getBlob(hash,t);guard(t);if(!blob)return null;const url=URL.createObjectURL(blob);urls.set(hash,url);return url;},
  release(){if(released)return;released=true;refreshVersion++;unsubscribe();revoke();repository?.release();}
 };
}
