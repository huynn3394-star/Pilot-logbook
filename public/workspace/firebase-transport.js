import {doc,collection,query,orderBy,documentId,startAfter,limit,getDocFromServer,getDocsFromServer,runTransaction,onSnapshot,serverTimestamp} from 'firebase/firestore';
import {validUID,validateRecord,validateOperation,recordKey,sha256,canonical,clone,bytes,MAX_OPERATION_BYTES} from './schema.js';
import {mergeRecord} from './model.js';
import {pullStableWorkspace,references} from './pull.js';
import {flightKey} from '../lib/domain.js';

export function createWorkspaceTransport({db,uid,getAuthGeneration=()=>0}){
 if(!validUID(uid))throw new Error('UID workspace không hợp lệ.');
 const generation=getAuthGeneration(),path=`users/${uid}/workspaces/main`,root=doc(db,path),stops=new Set();let closed=false;
 const alive=()=>!closed&&generation===getAuthGeneration();
 const guard=()=>{if(!alive())throw new Error('Tài khoản/generation đã đổi; dừng đồng bộ workspace.');};
 const readHead=async()=>{guard();const snapshot=await getDocFromServer(root);guard();return snapshot.exists()?snapshot.data():null;};
 const readPage=async({after,limit:count})=>{const clauses=[orderBy(documentId()),limit(count)];if(after)clauses.push(startAfter(after));const page=await getDocsFromServer(query(collection(db,path+'/records'),...clauses));guard();return page.docs.map(d=>({key:d.id,data:d.data()}));};
 async function commit(op){
  guard();validateOperation(op);if(op.uid!==uid)throw new Error('Operation khác tài khoản.');
  const operationHash=await sha256(canonical(op)),receiptRef=doc(db,path+'/receipts/'+op.operationId),entries=await Promise.all(op.changes.map(async change=>({change,key:await recordKey(change.kind,change.id)})));guard();
  const ack=await runTransaction(db,async tx=>{
   guard();const [head,receipt]=await Promise.all([tx.get(root),tx.get(receiptRef)]);guard();
   if(receipt.exists()){const r=receipt.data();if(r.uid!==uid||r.operationId!==op.operationId||r.operationHash!==operationHash)throw new Error('Receipt hash khác nội dung operation.');const {schemaVersion,...prior}=r;return prior;}
   const core=head.exists()?head.data():{schemaVersion:1,revision:0};
   if(core.schemaVersion!==1||!Number.isSafeInteger(core.revision)||core.revision<0||op.baseRevision>core.revision)throw new Error('Workspace revision/schema không hợp lệ.');
   const revision=core.revision+1,snaps=await Promise.all(entries.map(e=>tx.get(doc(db,path+'/records/'+e.key))));
   const importRef=op.importPart?doc(db,path+'/imports/'+op.importPart.hash+'-'+op.importPart.index):null,priorImport=importRef?await tx.get(importRef):null;guard();
   if(priorImport?.exists()&&canonical(priorImport.data().recordKeys)!==canonical(entries.map(e=>e.key)))throw new Error('Phần nhập cùng hash khác danh sách bản ghi.');
   const results=entries.map(({change},i)=>{const remote=snaps[i].exists()?snaps[i].data():null;if(remote)validateRecord(remote);if(priorImport?.exists()){if(!remote)throw new Error('Thiếu bản ghi của phần đã nhập.');return {kind:change.kind,id:change.id,status:'already-applied',record:remote};}const merged=mergeRecord({base:change.base,local:change.next,remote});if(merged.conflict)return {kind:change.kind,id:change.id,status:'conflict',conflict:merged.conflict};const equal=remote&&canonical({...remote,revision:0})===canonical({...merged.record,revision:0});return {kind:change.kind,id:change.id,status:equal?'already-applied':'accepted',record:equal?remote:{...merged.record,revision}};});
   const recordIndex=new Map(entries.map((e,i)=>[e.change.kind+'\0'+e.change.id,snaps[i].exists()?snaps[i].data():null]));for(const r of results)if(r.record)recordIndex.set(r.kind+'\0'+r.id,r.record);
   const needed=new Map();for(const r of results)if(r.record)for(const ref of references(r.record)){const key=ref.kind+'\0'+ref.id;if(!recordIndex.has(key))needed.set(key,ref);}
   for(const [key,ref]of needed){const snapshot=await tx.get(doc(db,path+'/records/'+await recordKey(ref.kind,ref.id)));recordIndex.set(key,snapshot.exists()?snapshot.data():null);}guard();
   function reject(result,groups,reason){const i=results.indexOf(result),change=entries[i].change;delete result.record;result.status='conflict';result.conflict={kind:change.kind,recordId:change.id,groups,base:clone(change.base),local:clone(change.next),remote:snaps[i].exists()?snaps[i].data():null,reason};}
   for(const r of results)if(r.record&&references(r.record).some(ref=>!recordIndex.get(ref.kind+'\0'+ref.id)))reject(r,['references'],'Tham chiếu crew/duty không tồn tại.');
   const claims=new Map();
   for(let i=0;i<entries.length;i++)for(const record of [snaps[i].exists()?snaps[i].data():null,results[i].record])if(record?.kind==='flight'&&!record.archived){const key=flightKey(record.data);if(!claims.has(key)){const hash=await sha256(key),ref=doc(db,path+'/flightKeys/'+hash),snapshot=await tx.get(ref);claims.set(key,{ref,data:snapshot.exists()?snapshot.data():null});}}guard();
   const claimWrites=new Map();
   for(let i=0;i<results.length;i++){
    const result=results[i];if(!result.record||result.kind!=='flight')continue;const old=snaps[i].exists()?snaps[i].data():null,next=result.record,newKey=next.archived?null:flightKey(next.data),oldKey=old&&!old.archived?flightKey(old.data):null;
    if(newKey){const claim=claims.get(newKey),owner=claimWrites.has(newKey)?claimWrites.get(newKey):claim.data;if(owner&&owner.flightId!==next.id){reject(result,['identity'],'Chuyến bay ngày/số hiệu đã có ở ID khác.');continue;}claimWrites.set(newKey,{schemaVersion:1,key:newKey,flightId:next.id,recordKey:entries[i].key,revision});}
    if(oldKey&&oldKey!==newKey){const claim=claims.get(oldKey),owner=claimWrites.has(oldKey)?claimWrites.get(oldKey):claim.data;if(owner?.flightId===next.id)claimWrites.set(oldKey,null);}
   }
   const wire={uid,operationId:op.operationId,operationHash,priorRevision:core.revision,revision,results};if(bytes(wire)>MAX_OPERATION_BYTES)throw new Error('Receipt vượt 800 KiB; giữ bản máy.');
   // No writes precede the final claim/reference reads.
   for(let i=0;i<results.length;i++)if(results[i].status==='accepted')tx.set(doc(db,path+'/records/'+entries[i].key),results[i].record);
   for(const [key,data]of claimWrites){const ref=claims.get(key).ref;if(data)tx.set(ref,data);else tx.delete(ref);}
   if(importRef&&!priorImport.exists()&&results.every(r=>r.status!=='conflict'))tx.set(importRef,{schemaVersion:1,hash:op.importPart.hash,index:op.importPart.index,total:op.importPart.total,operationId:op.operationId,revision,recordKeys:entries.map(e=>e.key)});
   tx.set(root,{schemaVersion:1,revision,updatedAt:serverTimestamp()});tx.set(receiptRef,{schemaVersion:1,...wire});return wire;
  });guard();return ack;
 }
 return {pull:async()=>{guard();return pullStableWorkspace({uid,readHead,readPage,guard});},commit,
  subscribe(onRevision,onError=()=>{}){guard();const stop=onSnapshot(root,snapshot=>{if(alive()&&snapshot.exists())onRevision(snapshot.data().revision);},error=>{if(alive())onError(error);});stops.add(stop);return()=>{stop();stops.delete(stop);};},
  close(){if(closed)return;closed=true;for(const stop of stops)stop();stops.clear();}
 };
}
