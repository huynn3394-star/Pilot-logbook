import {clone,canonical,sha256,bytes,validUID,validateRecord,validateOperation,validateEvidence,MAX_RECORDS,MAX_OPERATION_BYTES} from './schema.js';
import {emptySnapshot,applyChanges,mergeRecord} from './model.js';

const DB='avilog-workspaces-v1',STORES=['workspaces','outbox','conflicts','blobs','transfers','recoveries','devicePreferences'];
let connection;
function connect(){return connection??=new Promise((resolve,reject)=>{
 const request=indexedDB.open(DB,1);
 request.onupgradeneeded=()=>{for(const name of STORES){const store=request.result.createObjectStore(name,{keyPath:['workspaces','devicePreferences'].includes(name)?'uid':['uid','id']});store.createIndex('byUID','uid');}};
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
 request.onerror=()=>{connection=null;reject(request.error);};request.onblocked=()=>{connection=null;reject(new Error('Đóng tab AviLog cũ rồi mở lại bộ nhớ.'));};
});}
export function validateSnapshot(s,uid){
 if(!s||s.schemaVersion!==1||s.uid!==uid||!Number.isSafeInteger(s.cloudRevision)||s.cloudRevision<0||!Number.isSafeInteger(s.localVersion)||s.localVersion<0||!Array.isArray(s.records))throw new Error('Snapshot workspace không hợp lệ.');
 const seen=new Set();for(const record of s.records){validateRecord(record);const key=record.kind+'\0'+record.id;if(seen.has(key))throw new Error('Snapshot trùng ID.');seen.add(key);}return s;
}
const keyOf=r=>r.kind+'\0'+r.id;
const operationOrder=(rows,priorities=[])=>[...rows].sort((a,b)=>{const ap=priorities.includes(a.id),bp=priorities.includes(b.id);return ap!==bp?(ap?-1:1):a.operation.sequence-b.operation.sequence;});

export async function openWorkspace({uid,token,isCurrent,locks=globalThis.navigator?.locks,onChange=()=>{}}){
 if(!validUID(uid)||typeof isCurrent!=='function'||token?.uid!==uid)throw new Error('Định danh workspace không hợp lệ.');
 let released=false,writable=false,unlock=()=>{},database=await connect();const deviceId=crypto.randomUUID();
 const guard=(t=token,writer=false)=>{if(released||t?.uid!==uid||!isCurrent(t))throw new Error('Tài khoản đã đổi; dừng thao tác cũ.');if(writer&&!writable)throw new Error('Workspace chỉ đọc; đóng tab đang ghi rồi thử lại.');};
 guard();
 if(locks?.request){await new Promise(resolve=>{locks.request('avilog-workspace-v1:'+uid,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock){resolve();return;}writable=true;resolve();return new Promise(done=>{unlock=done;});}).catch(()=>{writable=false;resolve();});});}
 try{guard();}catch(error){unlock();throw error;}
 function transaction(names,mode,t,writer,fn,readNames=names){
  guard(t,writer);return new Promise((resolve,reject)=>{
   let tx,error,result,remaining=readNames.length;const rows=Object.fromEntries(names.map(name=>[name,[]]));
   try{tx=database.transaction(names,mode);}catch(e){reject(e);return;}
   const stop=e=>{error=e;try{tx.abort();}catch{}};
   tx.onerror=()=>{};tx.onabort=()=>reject(error||tx.error||new Error('Không lưu được workspace.'));
   tx.oncomplete=()=>{try{guard(t,writer);resolve(result);}catch(e){reject(e);}};
   const execute=()=>{try{guard(t,writer);result=fn(rows,tx);if(result&&typeof result.then==='function')throw new Error('Không await trong transaction IDB.');guard(t,writer);}catch(e){stop(e);}};
   for(const name of readNames){const index=tx.objectStore(name).index('byUID'),request=name==='blobs'?index.getAllKeys(IDBKeyRange.only(uid)):index.getAll(IDBKeyRange.only(uid));request.onerror=()=>stop(request.error);request.onsuccess=()=>{
    rows[name]=name==='blobs'?request.result.map(key=>({uid:key[0],id:key[1]})):request.result;if(--remaining)return;
    execute();
   };}if(!readNames.length)execute();
  });
 }
 const getState=rows=>{
  const state=rows.workspaces?.[0]||{uid,snapshot:emptySnapshot(uid),baseline:emptySnapshot(uid),nextSequence:1,priorities:[],acknowledged:{}};
  validateSnapshot(state.snapshot,uid);validateSnapshot(state.baseline,uid);return state;
 };
 const notify=event=>{try{onChange(event);}catch{}};
 const readRows=(names,t=token)=>transaction(names,'readonly',t,false,rows=>rows);
 const conflictID=(op,c)=>op.operationId+'~'+op.changes.findIndex(x=>x.kind===c.kind&&x.id===c.recordId);
 function rebase(state,rows,tx){
  let snapshot=clone(state.baseline);const conflicts=new Map((rows.conflicts||[]).map(c=>[c.id,c]));
  for(const row of operationOrder(rows.outbox||[],state.priorities)){
   const op=row.operation;for(const c of op.changes){
    const remote=snapshot.records.find(r=>r.kind===c.kind&&r.id===c.id)||null;
    const existing=[...conflicts.values()].some(f=>f.kind===c.kind&&f.recordId===c.id);if(existing)continue;
    const merged=mergeRecord({base:c.base,local:c.next,remote});
    if(merged.conflict){const id=conflictID(op,merged.conflict),value={...merged.conflict,uid,id,operationId:op.operationId};conflicts.set(id,value);tx.objectStore('conflicts').put(value);}
    else snapshot=applyChanges(snapshot,[{...c,next:merged.record}]);
   }
  }
  snapshot.localVersion=state.snapshot.localVersion+1;state.snapshot=snapshot;return state;
 }
 function stage(state,rows,changes,tx,{importPart,priority=false}={}){
  const seen=new Set();for(const c of changes){if(seen.has(keyOf(c)))throw new Error('Thay đổi trùng bản ghi.');seen.add(keyOf(c));validateRecord(c.next);if(c.base)validateRecord(c.base);}
  const previous=new Map();for(const row of operationOrder(rows.outbox||[],state.priorities))for(const c of row.operation.changes)previous.set(keyOf(c),row.operation.operationId);
  const prepared=[];let group=[];
  const make=items=>{const op={schemaVersion:1,operationId:crypto.randomUUID(),uid,deviceId,sequence:state.nextSequence,parents:priority?[]:[...new Set(items.map(c=>previous.get(keyOf(c))).filter(Boolean))],baseRevision:state.baseline.cloudRevision,changes:clone(items)};if(importPart)op.importPart=clone(importPart);return op;};
  const flush=()=>{if(!group.length)return;const op=make(group);validateOperation(op);state.nextSequence++;prepared.push(op);for(const c of group)previous.set(keyOf(c),op.operationId);group=[];};
  for(const c of changes){const candidate=make([...group,c]);if(group.length&&(group.length===MAX_RECORDS||bytes(candidate)>MAX_OPERATION_BYTES))flush();group.push(c);}flush();
  if(importPart&&prepared.length>1)throw new Error('Phần nhập cần chia nhỏ trước khi lưu.');
  for(const op of prepared){const row={uid,id:op.operationId,operation:op};tx.objectStore('outbox').put(row);rows.outbox.push(row);if(priority)state.priorities.push(op.operationId);}
  return prepared;
 }
 async function prepareBlobs(items,t){
  const prepared=[];for(const item of items){validateEvidence(item.ref);if(!(item.blob instanceof Blob)||item.blob.size!==item.ref.bytes||item.blob.type!==item.ref.mime)throw new Error('Byte ảnh không khớp metadata.');const data=await item.blob.arrayBuffer();if(await sha256(data)!==item.ref.sha256)throw new Error('Byte ảnh không khớp metadata.');guard(t);prepared.push({ref:clone(item.ref),data});}return prepared;
 }
 const api={uid,get writable(){return writable&&!released;},
  async read(){return clone(getState(await readRows(['workspaces'])).snapshot);},
  async pending(){const rows=await readRows(['workspaces','outbox']);return operationOrder(rows.outbox,getState(rows).priorities).map(row=>clone(row.operation));},
  async conflicts(){return clone((await readRows(['conflicts'])).conflicts);},
  async transfers(){return clone((await readRows(['transfers'])).transfers);},
  async devicePreferences(){return clone((await readRows(['devicePreferences'])).devicePreferences[0]?.data||{});},
  async save({changes=[],blobs=[],transfers=[],devicePatch,token:t=token,importPart,restoreProgress}){
   if(restoreProgress&&(restoreProgress.targetUID!==uid||!/^[a-f0-9]{64}$/.test(restoreProgress.identity)||!Array.isArray(restoreProgress.entries)||!Array.isArray(restoreProgress.partIndices)||!Array.isArray(restoreProgress.imageHashes)))throw Error('Tiến độ restore không hợp lệ.');
   guard(t,true);const prepared=await prepareBlobs(blobs,t);guard(t,true);
   const result=await transaction(STORES,'readwrite',t,true,(rows,tx)=>{
    const state=getState(rows);stage(state,rows,changes,tx,{importPart});rebase(state,rows,tx);
    // Persist original bytes rather than native Blob handles (WebKit abort/retry compatibility).
    for(const item of prepared)tx.objectStore('blobs').put({uid,id:item.ref.sha256,ref:item.ref,data:item.data});
    for(const item of transfers){if(!validUID(item.id))throw new Error('Transfer ID không hợp lệ.');tx.objectStore('transfers').put({...clone(item),uid});}
    if(devicePatch)tx.objectStore('devicePreferences').put({uid,data:{...(rows.devicePreferences[0]?.data||{}),...clone(devicePatch)}});
    if(restoreProgress)tx.objectStore('recoveries').put({...clone(restoreProgress),uid,id:'restore-'+restoreProgress.identity,type:'restore-progress'});
    tx.objectStore('workspaces').put(state);return clone(state.snapshot);
   },['workspaces','outbox','conflicts','transfers','devicePreferences']);notify({localQueue:changes.length>0});return result;
  },
  async acceptRemote(remote,t=token){
   validateSnapshot(remote,uid);await transaction(['workspaces','outbox','conflicts'],'readwrite',t,true,(rows,tx)=>{const state=getState(rows);if(remote.cloudRevision<state.baseline.cloudRevision)throw new Error('Không nhận snapshot cloud cũ.');state.baseline=clone(remote);rebase(state,rows,tx);tx.objectStore('workspaces').put(state);});notify();
  },
  async acceptAck(ack,t=token){
   guard(t,true);if(ack?.uid!==uid||!validUID(ack.operationId))throw new Error('Ack khác tài khoản.');
   const pending=await api.pending(),op=pending.find(o=>o.operationId===ack.operationId);
   if(!op){const state=getState(await readRows(['workspaces'],t));if(state.acknowledged[ack.operationId]===ack.operationHash)return;throw new Error('Không có operation cho ack.');}
   const hash=await sha256(canonical(op));guard(t,true);if(hash!==ack.operationHash)throw new Error('Ack khác nội dung operation.');
   if(!Number.isSafeInteger(ack.revision)||ack.revision<1||!Number.isSafeInteger(ack.priorRevision)||ack.revision!==ack.priorRevision+1||!Array.isArray(ack.results)||ack.results.length!==op.changes.length)throw new Error('Ack không hợp lệ.');
   const seen=new Set();for(const result of ack.results){const change=op.changes.find(c=>c.kind===result.kind&&c.id===result.id);if(!change||seen.has(keyOf(result))||!['accepted','already-applied','conflict'].includes(result.status))throw new Error('Kết quả ack không khớp.');seen.add(keyOf(result));if(result.status!=='conflict'){validateRecord(result.record);if(result.record.kind!==result.kind||result.record.id!==result.id)throw new Error('Ack record khác ID.');}else if(!result.conflict||result.conflict.kind!==result.kind||result.conflict.recordId!==result.id)throw new Error('Ack conflict khác ID.');}
   await transaction(['workspaces','outbox','conflicts','recoveries'],'readwrite',t,true,(rows,tx)=>{
    const state=getState(rows),current=rows.outbox.find(x=>x.id===op.operationId);if(!current||canonical(current.operation)!==canonical(op))throw new Error('Operation đã thay đổi.');
    if(ack.revision>state.baseline.cloudRevision){if(state.baseline.cloudRevision!==ack.priorRevision)throw Object.assign(new Error('Cần tải cloud trước nhận ack.'),{code:'workspace/requires-pull'});state.baseline=applyChanges(state.baseline,ack.results.filter(r=>r.status!=='conflict').map(r=>({kind:r.kind,id:r.id,next:r.record})));state.baseline.cloudRevision=ack.revision;}
    // Predictions made while this receipt was unknown are superseded by its
    // authoritative outcomes. Conflicts belonging to later operations remain.
    for(const c of rows.conflicts.filter(c=>c.operationId===op.operationId))tx.objectStore('conflicts').delete([uid,c.id]);
    rows.conflicts=rows.conflicts.filter(c=>c.operationId!==op.operationId);
    for(const r of ack.results)if(r.status==='conflict'){const value={...clone(r.conflict),id:conflictID(op,r.conflict),uid,operationId:op.operationId};tx.objectStore('conflicts').put(value);rows.conflicts.push(value);}
    if(ack.results.some(r=>r.status==='conflict'))tx.objectStore('recoveries').put({uid,id:'operation-'+op.operationId,type:'operation',source:clone(op)});
    tx.objectStore('outbox').delete([uid,op.operationId]);rows.outbox=rows.outbox.filter(row=>row.id!==op.operationId);state.priorities=state.priorities.filter(id=>id!==op.operationId);state.acknowledged[op.operationId]=hash;rebase(state,rows,tx);tx.objectStore('workspaces').put(state);
   },['workspaces','outbox','conflicts']);notify();
  },
  async saveRecovery(value,t=token){const id=crypto.randomUUID();await transaction(['recoveries'],'readwrite',t,false,(_,tx)=>tx.objectStore('recoveries').put({...clone(value),uid,id,type:'recovery'}),[]);return id;},
  async getRestoreProgress(identity,t=token){guard(t);if(!/^[a-f0-9]{64}$/.test(identity))throw Error('Bộ restore không hợp lệ.');return new Promise((resolve,reject)=>{const tx=database.transaction('recoveries','readonly'),r=tx.objectStore('recoveries').get([uid,'restore-'+identity]);let value=null;r.onsuccess=()=>{value=r.result||null;};tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>{try{guard(t);resolve(clone(value));}catch(e){reject(e);}};});},
  async getBlob(hash,t=token){guard(t);return new Promise((resolve,reject)=>{
   const tx=database.transaction('blobs','readonly'),request=tx.objectStore('blobs').get([uid,hash]);let row;
   request.onsuccess=()=>{row=request.result;};tx.onerror=()=>{};tx.onabort=()=>reject(tx.error||new Error('Không đọc được byte ảnh.'));tx.oncomplete=()=>{try{guard(t);resolve(row?new Blob([row.data],{type:row.ref.mime}):null);}catch(e){reject(e);}};
  });},
  async putBlob(ref,blob,t=token){guard(t,true);const [prepared]=await prepareBlobs([{ref,blob}],t);await transaction(['blobs'],'readwrite',t,true,(_,tx)=>tx.objectStore('blobs').put({uid,id:ref.sha256,...prepared}),[]);notify();},
  async setTransfer(item,t=token){if(!validUID(item.id))throw new Error('Transfer ID không hợp lệ.');await transaction(['transfers'],'readwrite',t,true,(_,tx)=>tx.objectStore('transfers').put({...clone(item),uid}),[]);notify();},
  async exportCapture(t=token){return transaction(STORES,'readwrite',t,false,(rows,tx)=>{
   const snapshot=clone(getState(rows).snapshot),refs=new Map(snapshot.records.filter(r=>r.evidence).map(r=>[r.evidence.sha256,r.evidence]));
   for(const op of rows.outbox.map(r=>r.operation))for(const c of op.changes)for(const r of [c.base,c.next])if(r?.evidence)refs.set(r.evidence.sha256,r.evidence);
   // Acknowledged conflicts leave the outbox, but their originals remain
   // recoverable and must be included before calling an export complete.
   const collect=value=>{if(!value||typeof value!=='object')return;if(Object.hasOwn(value,'sha256')&&Object.hasOwn(value,'mime')&&Object.hasOwn(value,'bytes')&&Object.hasOwn(value,'cloudReady')){validateEvidence(value);const prior=refs.get(value.sha256);if(prior&&(prior.mime!==value.mime||prior.bytes!==value.bytes))throw Error('Metadata ảnh phục hồi không khớp.');refs.set(value.sha256,clone(value));}for(const child of Object.values(value))collect(child);};
   collect(rows.conflicts);collect(rows.recoveries.filter(r=>r.type!=='pin'));
   const pinId=crypto.randomUUID();tx.objectStore('recoveries').put({uid,id:pinId,type:'pin',hashes:[...refs.keys()]});
   return {snapshot,operations:rows.outbox.map(r=>r.operation),conflicts:rows.conflicts,recoveries:rows.recoveries.filter(r=>r.type!=='pin'),transfers:rows.transfers,evidenceRefs:[...refs.values()],pinId};
  });},
  async unpinBlobs(pinId,t=token){await transaction(['recoveries'],'readwrite',t,false,(rows,tx)=>{if(rows.recoveries.some(r=>r.id===pinId&&r.type==='pin'))tx.objectStore('recoveries').delete([uid,pinId]);});},
  async releaseBlob(hash,t=token){return transaction(STORES,'readwrite',t,true,(rows,tx)=>{
   const state=getState(rows),blob=rows.blobs.find(r=>r.id===hash),refs=state.snapshot.records.filter(r=>r.evidence?.sha256===hash);
   const retained=value=>{try{return JSON.stringify(value).includes(hash);}catch{return true;}};
   if(!blob||!refs.length||refs.some(r=>!r.evidence.cloudReady)||rows.transfers.some(r=>r.hash===hash&&r.state!=='complete')||rows.outbox.some(r=>retained(r.operation))||rows.recoveries.some(retained)||rows.conflicts.some(retained))return false;
   tx.objectStore('blobs').delete([uid,hash]);return true;
  });},
  async resolveConflict({conflictId,changes},t=token){await transaction(['workspaces','outbox','conflicts','recoveries'],'readwrite',t,true,(rows,tx)=>{
   const conflict=rows.conflicts.find(r=>r.id===conflictId);if(!conflict)throw new Error('Không có xung đột này.');const state=getState(rows),old=rows.outbox.find(r=>r.id===conflict.operationId);
   tx.objectStore('recoveries').put({uid,id:crypto.randomUUID(),type:'resolution',source:clone({conflict,operation:old?.operation||null})});
   const carry=old?old.operation.changes.filter(c=>keyOf(c)!==keyOf({kind:conflict.kind,id:conflict.recordId})&&!rows.conflicts.some(f=>f.id!==conflictId&&f.kind===c.kind&&f.recordId===c.id)):[];
   if(old){tx.objectStore('outbox').delete([uid,old.id]);rows.outbox=rows.outbox.filter(r=>r.id!==old.id);}
   tx.objectStore('conflicts').delete([uid,conflictId]);rows.conflicts=rows.conflicts.filter(r=>r.id!==conflictId);stage(state,rows,[...carry,...changes],tx,{priority:true});rebase(state,rows,tx);tx.objectStore('workspaces').put(state);
  },['workspaces','outbox','conflicts']);notify({localQueue:true});},
  release(){if(released)return;released=true;writable=false;unlock();}
 };
 return api;
}
