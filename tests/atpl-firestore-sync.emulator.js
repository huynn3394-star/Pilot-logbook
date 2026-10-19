import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {createProgressTransport} from '../public/atpl/sync/firebase-transport.js';
import {prepareBatch,acknowledge} from '../public/atpl/sync/model.js';
import {identity,counted,envelope,empty,report} from './fixtures/atpl-account.js';
import {importHash} from '../public/atpl/sync/import.js';
let env,db1,db2;const make=db=>createProgressTransport({db,uid:'alice',identity,getAuthGeneration:()=>1});
const batch=(state,baseline=counted(),id=crypto.randomUUID())=>prepareBatch({...envelope(baseline),state},{batchId:id,deviceId:id}).inflight.batch;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-atpl-sync',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firebase/firestore.rules','utf8')}});db1=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();db2=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();});after(async()=>env?.cleanup());
test('real concurrent Firestore transactions converge to 6/4; uncertain retry and session IDs do not duplicate',async()=>{
 await env.clearFirestore();const a=make(db1),b=make(db2);await a.commit(batch(counted(),empty(),'seed'));
 const exam=(id,answers)=>({ids:[1,2],qid:id,answers,submitted:false,startedAt:100});
 const ba=batch({...counted(5,3,'A',9999999),exam:exam(1,{1:'B'}),examHistory:[report(1000)]},counted(),'phone');ba.delta.sessions.exam.id='exam-phone';
 const bb=batch({...counted(4,3,'B',1),exam:exam(2,{2:'A'}),examHistory:[report(2000)]},counted(),'ipad');bb.delta.sessions.exam.id='exam-ipad';
 await Promise.all([a.commit(ba),b.commit(bb)]);const remote=await a.pull();assert.equal(remote.state.progress[1].attempts,6);assert.equal(remote.state.progress[1].correct,4);assert.equal(remote.state.examHistory.length,2);
 await a.commit(ba);assert.equal((await a.pull()).state.progress[1].attempts,6);assert.deepEqual(remote.state._sync.sessions['exam-phone'].state.answers,{1:'B'});assert.deepEqual(remote.state._sync.sessions['exam-ipad'].state.answers,{2:'A'});
 a.close();b.close();
});
test('same guest import on two devices uses one conservative import receipt and report union',async()=>{
 await env.clearFirestore();const guest={...counted(5,3),examHistory:[report()]},id=await importHash('MB',guest),e=envelope(empty());e.state=counted(6,4);e.state.examHistory=guest.examHistory;e.pendingImports=[{id,state:guest}];
 const one=prepareBatch(e,{batchId:'one',deviceId:'phone'}).inflight.batch,two=prepareBatch(e,{batchId:'two',deviceId:'ipad'}).inflight.batch;
 const a=make(db1),b=make(db2);await Promise.all([a.commit(one),b.commit(two)]);const remote=await a.pull();assert.equal(remote.state.progress[1].attempts,7);assert.equal(remote.state.progress[1].correct,5);assert.equal(remote.state.examHistory.length,1);await a.commit(one);assert.equal((await a.pull()).state.progress[1].attempts,7);a.close();b.close();
});
test('generation invalidation and stale epochs retain an unsent local envelope',async()=>{
 await env.clearFirestore();let generation=1;const a=createProgressTransport({db:db1,uid:'alice',identity,getAuthGeneration:()=>generation});generation=2;await assert.rejects(()=>a.pull(),/generation|tài khoản|đã đổi/);a.close();
 const b=make(db1);await b.commit(batch(counted(),empty(),'epoch-seed'));const wrong=batch(counted(4,3),counted(),'old');wrong.epoch='old-epoch';await assert.rejects(()=>b.commit(wrong),/epoch/);const e=prepareBatch({...envelope(),state:counted(4,3)},{batchId:'old',deviceId:'phone'}),before=structuredClone(e);assert.throws(()=>acknowledge(e,{uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'old-epoch',batchId:'old',cloudRevision:2,state:counted(4,3)}));assert.deepEqual(e,before);b.close();
});
test('two devices editing the same unfinished exam retain both independent answer changes',async()=>{
 await env.clearFirestore();const ex=answers=>({ids:[1,2],qid:1,answers,submitted:false,startedAt:100}),base={...empty(),exam:ex({})};const a=make(db1),b=make(db2);await a.commit(batch(base,empty(),'session-seed'));
 await Promise.all([a.commit(batch({...base,exam:ex({1:'B'})},base,'same-one')),b.commit(batch({...base,exam:ex({2:'A'})},base,'same-two'))]);assert.deepEqual((await a.pull()).state.exam.answers,{1:'B',2:'A'});a.close();b.close();
});
test('an explicit new epoch resets visible state and history while an imported resumable session stays recoverable',async()=>{
 await env.clearFirestore();const a=make(db1);await a.commit(batch({...counted(),examHistory:[report()]},empty(),'before-reset'));
 const reset=batch(empty(),empty(),'reset');reset.epoch='epoch-two';reset.resetFromEpoch='initial';await a.commit(reset);const cleared=await a.pull();assert.deepEqual(cleared.state.progress,{});assert.equal(cleared.state.examHistory.length,0);
 const guest={...empty(),study:{ids:[1,2],qid:1,answers:{},mode:'study',resumeQid:1,finished:false},examHistory:[report()]},id=await importHash('MB',guest),e=envelope(empty());e.epoch='epoch-two';e.state=guest;e.pendingImports=[{id,state:guest}];const prepared=prepareBatch(e,{batchId:'restore',deviceId:'phone'});await a.commit(prepared.inflight.batch);const restored=await a.pull();assert.equal(restored.state.study.qid,1);assert.equal(restored.state.examHistory.length,1);a.close();
});
test('a cached Firestore read cannot count as a successful cloud pull when the network is disabled',async()=>{
 await env.clearFirestore();const {disableNetwork,enableNetwork}=await import('firebase/firestore'),a=make(db1);await a.commit(batch(counted(),empty(),'cache-proof'));await a.pull();await disableNetwork(db1);try{await assert.rejects(()=>a.pull(),/offline|unavailable|network/i);}finally{await enableNetwork(db1);a.close();}
});
test('a malformed report with a changed original answer is rejected before creating any cloud record',async()=>{
 await env.clearFirestore();const {doc,getDocFromServer}=await import('firebase/firestore'),a=make(db1),bad=batch(counted(),empty(),'invalid-source-report');bad.reports=[{...report(),results:[{id:1,selected:'B',answer:'A',correct:true}]}];await assert.rejects(()=>a.commit(bad));assert.equal((await getDocFromServer(doc(db1,'users/alice/banks/MB'))).exists(),false);a.close();
});
test('23 completed reports pass real rules in bounded 20+3 transactions without adding counters twice',async()=>{
 await env.clearFirestore();const a=make(db1),reports=Array.from({length:23},(_,i)=>report(10000+i));let e=envelope(empty());e.state={...counted(),examHistory:reports};e=prepareBatch(e,{batchId:'history-first',deviceId:'phone'});const first=await a.commit(e.inflight.batch);assert.equal(first.state.examHistory.length,20);e=acknowledge(e,first);assert.equal(e.state.examHistory.length,23);e=prepareBatch(e,{batchId:'history-second',deviceId:'phone'});assert.equal(e.inflight.batch.reports.length,3);const second=await a.commit(e.inflight.batch);assert.equal(second.state.examHistory.length,23);assert.equal(second.state.progress[1].attempts,3);a.close();
});

test('two offline resets commit from the last server epoch and keep only new answers',async()=>{
 await env.clearFirestore();const {openAccountBank}=await import('../public/atpl/sync/store.js');const values=new Map(),store=await openAccountBank({storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},uid:'alice',identity,locks:{request:async(n,o,fn)=>fn({})}}),a=make(db1);
 try{store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted()));store.commitAck(await a.commit(store.prepare({batchId:'twice-seed',deviceId:'phone'})));
 store.replaceWithNewEpoch(empty());store.engineStorage.getItem('atpl_mb_v2_state');store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted(2,1)));store.replaceWithNewEpoch(empty());store.engineStorage.getItem('atpl_mb_v2_state');store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted(1,1)));
 store.commitAck(await a.commit(store.prepare({batchId:'twice-reset',deviceId:'phone'})));assert.equal(store.hasPending(),false);assert.equal((await a.pull()).state.progress[1].attempts,1);
 }finally{store.release();a.close();}
});

test('the same resumable import survives reset, resumed answers and a fresh-device pull',async()=>{
 await env.clearFirestore();const {openAccountBank}=await import('../public/atpl/sync/store.js');const values=new Map(),store=await openAccountBank({storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},uid:'alice',identity,locks:{request:async(n,o,fn)=>fn({})}}),a=make(db1),b=make(db2),guest={...empty(),study:{ids:[1,2],qid:1,answers:{},mode:'study',resumeQid:1,finished:false}},id=await importHash('MB',guest);
 try{await store.stageImport(guest,id);store.commitAck(await a.commit(store.prepare({batchId:'same-before',deviceId:'phone'})));assert.equal(store.getEnvelope().state.study.qid,1);store.replaceWithNewEpoch(empty());await store.stageImport(guest,id);store.commitAck(await a.commit(store.prepare({batchId:'same-after',deviceId:'phone'})));assert.equal(store.getEnvelope().state.study?.qid,1);
 const resumed=JSON.parse(store.engineStorage.getItem('atpl_mb_v2_state'));resumed.study.answers[1]='B';resumed.study.resumeQid=2;store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(resumed));store.commitAck(await a.commit(store.prepare({batchId:'same-resume',deviceId:'phone'})));const remote=await b.pull();assert.deepEqual(remote.state.study.answers,{1:'B'});assert.equal(remote.state.study.resumeQid,2);assert.ok(remote.state._sync.selected.study.length<=128);
 }finally{store.release();a.close();b.close();}
});
