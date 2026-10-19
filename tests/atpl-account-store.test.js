import {test} from 'node:test';import assert from 'node:assert/strict';
import {openAccountBank,accountKey} from '../public/atpl/sync/store.js';
import {createCoordinator} from '../public/atpl/account-bootstrap.js';
import {identity,empty,counted} from './fixtures/atpl-account.js';
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const locks=()=>({request:async(name,options,fn)=>fn({name})});
const open=(storage,uid='alice',extra={})=>openAccountBank({storage,uid,identity,locks:locks(),...extra});
const key='atpl_mb_v2_state';
test('account writes are atomic and cannot affect guest or another UID',async()=>{
 const s=memory();s.setItem(key,JSON.stringify(counted()));const a=await open(s),b=await open(s,'bob');
 a.engineStorage.setItem(key,JSON.stringify(counted(5,3)));assert.equal(JSON.parse(s.getItem(key)).progress[1].attempts,3);assert.equal(b.getEnvelope().state.progress[1],undefined);
 const before=s.getItem(accountKey('alice','MB'));s.setItem=()=>{throw new Error('QuotaExceededError');};
 assert.throws(()=>a.engineStorage.setItem(key,JSON.stringify(counted(6,4))),/Quota/);assert.equal(s.getItem(accountKey('alice','MB')),before);assert.equal(a.getEnvelope().state.progress[1].attempts,5);
 assert.throws(()=>a.engineStorage.setItem('atpl_mbr_v2_state','{}'));a.release();b.release();
});
test('ack commits retain intervening durable answer and pending session ID survives quota failure',async()=>{
 const s=memory(),a=await open(s);a.engineStorage.setItem(key,JSON.stringify(counted(3,2)));a.prepare({batchId:'b',deviceId:'phone'});a.engineStorage.setItem(key,JSON.stringify(counted(4,3)));
 a.commitAck({uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'b',cloudRevision:1,state:counted(3,2),reportIds:[],importIds:[]});assert.equal(a.getEnvelope().state.progress[1].attempts,4);
 const before=a.getEnvelope().sessionIds.study,id=a.beginSession('study');assert.notEqual(id,before);const original=s.setItem;s.setItem=()=>{throw new Error('quota');};assert.throws(()=>a.engineStorage.setItem(key,JSON.stringify(counted(5,3))));assert.equal(a.getEnvelope().sessionIds.study,before);
 s.setItem=original;a.engineStorage.setItem(key,JSON.stringify(counted(5,3)));assert.equal(a.getEnvelope().sessionIds.study,id);a.release();
});
test('unsupported Web Locks prevents account writes while raw guest storage remains usable',async()=>{
 const s=memory(),a=await open(s,'alice',{locks:null});assert.equal(a.writable,false);assert.throws(()=>a.engineStorage.setItem(key,JSON.stringify(empty())),/khóa|read.only/i);s.setItem(key,JSON.stringify(counted()));assert.ok(s.getItem(key));a.release();
});
test('identity generations reject callbacks from old account and broadcast external changes',()=>{
 const storage=memory(),events=[];const c=createCoordinator({storage,eventTarget:null,channel:null});c.subscribe(x=>events.push(x));const start=c.generation;
 c.selectAuthenticatedUser({uid:'alice',displayName:'A',email:'a@example.com'});const token=c.capture();assert.equal(c.isCurrent(token),true);c.selectGuest();assert.equal(c.isCurrent(token),false);assert.ok(c.generation>start);assert.equal(c.getCachedSelection(),null);assert.equal(events.length,2);
 assert.throws(()=>c.selectAuthenticatedUser({uid:'../bob'}));
});
test('an active engine can save another answer after remote acknowledgement without losing merged attempts or jumping sessions',async()=>{
 const s=memory(),a=await open(s),st={ids:[1,2],qid:1,mode:'study',answers:{},resumeQid:1,finished:false};
 a.engineStorage.getItem(key);a.engineStorage.setItem(key,JSON.stringify({...counted(3,2),study:st}));a.prepare({batchId:'active',deviceId:'phone'});
 a.commitAck({uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'active',cloudRevision:2,state:counted(6,4),reportIds:[],importIds:[]});
 a.engineStorage.setItem(key,JSON.stringify({...counted(4,3),study:{...st,answers:{1:'B'},resumeQid:2}}));assert.equal(a.getEnvelope().state.progress[1].attempts,7);assert.equal(a.getEngineState().study.qid,1);a.release();
});
test('sync metadata writes do not recursively schedule new local changes',async()=>{
 let changes=0;const s=memory(),a=await open(s,'alice',{onChange:()=>changes++});a.engineStorage.setItem(key,JSON.stringify(counted()));a.prepare({batchId:'notifications',deviceId:'phone'});a.commitAck({uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'notifications',cloudRevision:1,state:counted(),reportIds:[],importIds:[]});assert.equal(changes,1);a.release();
});
test('resuming a server-selected exam retains its UUID instead of forking the answer into a different session',async()=>{
 const s=memory(),a=await open(s);a.engineStorage.getItem(key);a.engineStorage.setItem(key,JSON.stringify(counted()));a.prepare({batchId:'pick-session',deviceId:'phone'});const exam={ids:[1,2],qid:1,answers:{},submitted:false,startedAt:100};
 a.commitAck({uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'pick-session',cloudRevision:1,state:{...counted(),exam,_sync:{revision:1,sessions:{'remote-exam':{kind:'exam',state:exam,revision:1}},selected:{exam:'remote-exam'}}},reportIds:[],importIds:[]});
 const resumed=JSON.parse(a.engineStorage.getItem(key));resumed.exam.answers[1]='B';a.engineStorage.setItem(key,JSON.stringify(resumed));assert.equal(a.prepare({batchId:'resumed',deviceId:'phone'}).delta.sessions.exam.id,'remote-exam');a.release();
});
test('explicit guest choice survives provider-disabled logout and suppresses a later cached Google auto-login',()=>{
 const s=memory(),c=createCoordinator({storage:s,eventTarget:null});c.selectAuthenticatedUser({uid:'alice'});c.selectGuest();const reopened=createCoordinator({storage:s,eventTarget:null});assert.equal(reopened.getCachedSelection(),null);assert.equal(reopened.isExplicitGuest(),true);reopened.selectAuthenticatedUser({uid:'bob'});assert.equal(reopened.isExplicitGuest(),false);
});
test('an explicit Google login intent survives redirect while cancellation restores the guest choice',()=>{
 const s=memory(),c=createCoordinator({storage:s,eventTarget:null});c.selectGuest();c.beginLoginIntent();const reopened=createCoordinator({storage:s,eventTarget:null});assert.equal(reopened.isExplicitGuest(),false);assert.equal(reopened.getCachedSelection(),null);reopened.cancelLoginIntent();assert.equal(reopened.isExplicitGuest(),true);
});
test('a fresh device adopts an existing cloud reset epoch, while queued old-epoch work remains exportable',async()=>{
 const s=memory(),a=await open(s);a.acceptRemote({epoch:'reset-on-ipad',cloudRevision:4,state:counted(6,4)});assert.equal(a.getEnvelope().epoch,'reset-on-ipad');assert.equal(a.getEnvelope().state.progress[1].attempts,6);a.release();
 const b=await open(memory());b.engineStorage.setItem(key,JSON.stringify(counted(4,3)));const before=b.getEnvelope();assert.throws(()=>b.acceptRemote({epoch:'reset-on-ipad',cloudRevision:4,state:empty()}),/epoch|đặt lại/);assert.deepEqual(b.getEnvelope(),before);b.adoptRemoteEpoch({epoch:'reset-on-ipad',cloudRevision:4,state:empty()});assert.equal(b.getEnvelope().epoch,'reset-on-ipad');assert.deepEqual(b.getEnvelope().state.progress,{});assert.equal(before.state.progress[1].attempts,4);b.release();
});
