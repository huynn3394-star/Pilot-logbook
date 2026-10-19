import {doc,collection,query,where,getDocFromServer as getDoc,getDocsFromServer as getDocs,runTransaction,onSnapshot} from 'firebase/firestore';
import {applyDelta,validateState,canonicalReportHash,bytes,CORE_LIMIT,BATCH_LIMIT} from './model.js';
import {clone,legacyMax,importSessionID} from './common.js';
import {blankState,validUID} from './store.js';
const safeID=id=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(id);
export function createProgressTransport({db,uid,identity,getAuthGeneration=()=>0}){
 if(!validUID(uid))throw new Error('Tài khoản không hợp lệ.');
 const generation=getAuthGeneration(),root=`users/${uid}/banks/${identity.code}`,coreRef=doc(db,root);let closed=false;const stops=new Set();
 function guard(){if(closed||generation!==getAuthGeneration())throw new Error('Tài khoản đã đổi (generation); dừng đồng bộ cũ.');}
 function checkCore(core){if(core.code!==identity.code||core.bankSHA256!==identity.bankSHA256||core.schemaVersion!==1)throw new Error('Định danh ngân hàng trên mây không khớp.');}
 function snapshot(core,sessions=[],reports=[]){
  const state={...blankState(),...clone(core.state),examHistory:reports.map(r=>clone(r.report)),_sync:{revision:core.revision,sessions:{},selected:core.selected||{}}};
  for(const session of sessions)if(session.data.epoch===core.epoch)state._sync.sessions[session.id]={kind:session.data.kind,state:session.data.state,revision:session.data.revision};
  for(const kind of ['study','exam'])state[kind]=clone(state._sync.sessions[core.selected?.[kind]]?.state||null);
  validateState(state,identity);return state;
 }
 async function pull(){
  guard();const snap=await getDoc(coreRef);guard();if(!snap.exists())return {epoch:'initial',cloudRevision:0,state:blankState()};const core=snap.data();checkCore(core);
  const [sessions,reports]=await Promise.all(['sessions','exams'].map(name=>getDocs(query(collection(db,`${root}/${name}`),where('epoch','==',core.epoch)))));guard();
  return {epoch:core.epoch,cloudRevision:core.revision,state:snapshot(core,sessions.docs.map(d=>({id:d.id,data:d.data()})),reports.docs.map(d=>d.data()))};
 }
 async function commit(batch){
  guard();if(batch.schemaVersion!==1||batch.uid!==uid||batch.code!==identity.code||batch.bankSHA256!==identity.bankSHA256||!safeID(batch.batchId)||!safeID(batch.deviceId)||!safeID(batch.epoch))throw new Error('Lô đồng bộ khác tài khoản/ngân hàng.');
  if(bytes(batch)>BATCH_LIMIT||batch.reports.length>20||batch.imports.length>10)throw new Error('Lô đồng bộ vượt giới hạn.');
  validateState({...blankState(),examHistory:batch.reports},identity);
  if(batch.imports.some(item=>!(/^[a-f0-9]{64}$/.test(item.id)))||JSON.stringify(batch.importIds)!==JSON.stringify(batch.imports.map(item=>item.id)))throw new Error('Định danh bản nhập không hợp lệ.');
  const reports=await Promise.all(batch.reports.map(async report=>({hash:await canonicalReportHash(identity.code,report),report})));guard();
  const receiptRef=doc(db,`${root}/receipts/${batch.batchId}`),importRefs=batch.imports.map(item=>doc(db,`${root}/imports/${batch.epoch}~${item.id}`)),reportRefs=reports.map(item=>doc(db,`${root}/exams/${batch.epoch}~${item.hash}`));
  const legacySessions=await Promise.all(batch.imports.flatMap((item,index)=>['study','exam'].filter(kind=>item.state[kind]).map(async kind=>({index,id:await importSessionID(batch.epoch,item.id,kind),kind,state:item.state[kind]}))));guard();
  const affected=Object.entries(batch.delta.sessions||{});for(const[,change]of affected)if(!safeID(change.id))throw new Error('Phiên học thiếu UUID.');
  await runTransaction(db,async tx=>{
   guard();const [coreSnap,receipt]=await Promise.all([tx.get(coreRef),tx.get(receiptRef)]);
   const core=coreSnap.exists()?coreSnap.data():{schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:'initial',revision:0,state:blankState(),selected:{}};checkCore(core);
   if(receipt.exists())return;const resetting=batch.resetFromEpoch===core.epoch&&batch.epoch!==core.epoch;
   if(core.epoch!==batch.epoch&&!resetting)throw new Error('Xung đột epoch: giữ bản lưu tại máy để xuất.');
   const [imports,existingReports,existingSessions,existingLegacySessions]=await Promise.all([Promise.all(importRefs.map(ref=>tx.get(ref))),Promise.all(reportRefs.map(ref=>tx.get(ref))),Promise.all(affected.map(([,change])=>tx.get(doc(db,`${root}/sessions/${change.id}`)))),Promise.all(legacySessions.map(item=>tx.get(doc(db,`${root}/sessions/${item.id}`))))]);
   const baseCore=resetting?{...core,epoch:batch.epoch,state:blankState(),selected:{}}:core;
   let state=snapshot(baseCore,existingSessions.filter(s=>s.exists()).map(s=>({id:s.id,data:s.data()})));
   for(let i=0;i<batch.imports.length;i++)if(!imports[i].exists()){const legacy=validateState(batch.imports[i].state,identity);state=legacyMax(state,legacy);}
   const revision=core.revision+1;
   for(const item of legacySessions)if(!imports[item.index].exists()){state._sync.sessions[item.id]={kind:item.kind,state:clone(item.state),revision};if(!state._sync.selected[item.kind]){state._sync.selected[item.kind]=item.id;state[item.kind]=clone(item.state);}}
   state=applyDelta(state,batch.delta,revision);validateState(state,identity);
   const coreState=clone(state);delete coreState._sync;coreState.examHistory=[];coreState.study=null;coreState.exam=null;
   const next={schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,revision,state:coreState,selected:state._sync.selected};if(bytes(next)>CORE_LIMIT)throw new Error('Tiến độ trên mây vượt 800 KiB.');
   for(let i=0;i<affected.length;i++){
    const [kind,change]=affected[i],data={schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,kind,revision,state:state._sync.sessions[change.id].state};if(bytes(data)>CORE_LIMIT)throw new Error('Phiên học vượt 800 KiB.');tx.set(doc(db,`${root}/sessions/${change.id}`),data);
   }
   for(let i=0;i<legacySessions.length;i++)if(!imports[legacySessions[i].index].exists()&&!existingLegacySessions[i].exists()){const item=legacySessions[i];tx.set(doc(db,`${root}/sessions/${item.id}`),{schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,kind:item.kind,revision,state:item.state});}
   for(let i=0;i<reports.length;i++)if(!existingReports[i].exists())tx.set(reportRefs[i],{schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,...reports[i]});
   for(let i=0;i<batch.imports.length;i++)if(!imports[i].exists())tx.set(importRefs[i],{schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,hash:batch.imports[i].id});
   tx.set(coreRef,next);tx.set(receiptRef,{schemaVersion:1,code:identity.code,bankSHA256:identity.bankSHA256,epoch:batch.epoch,batchId:batch.batchId,revision,deviceId:batch.deviceId,importIds:batch.importIds});
  });guard();const remote=await pull();guard();if(remote.epoch!==batch.epoch)throw new Error('Xung đột epoch sau khi gửi; hãy xuất bản lưu.');return {...remote,uid,code:identity.code,bankSHA256:identity.bankSHA256,batchId:batch.batchId,reportIds:reports.map(r=>r.hash),importIds:batch.importIds};
 }
 return {pull,commit,subscribe(onRemote,onError=()=>{}){guard();const stop=onSnapshot(coreRef,snap=>{if(closed||generation!==getAuthGeneration())return;if(snap.exists())onRemote({epoch:snap.data().epoch,cloudRevision:snap.data().revision});},onError);stops.add(stop);return()=>{stop();stops.delete(stop);};},close(){closed=true;for(const stop of stops)stop();stops.clear();}};
}
