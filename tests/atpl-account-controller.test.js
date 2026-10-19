import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSyncController,reviewLegacyImport} from '../public/atpl/sync/controller.js';
import {openAccountBank} from '../public/atpl/sync/store.js';import {identity,counted,empty,report} from './fixtures/atpl-account.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
async function fixture(){const s=storage(),store=await openAccountBank({storage:s,uid:'alice',identity,locks:{request:async(n,o,f)=>f({})}});let user={uid:'alice'},listener=()=>{};const account={currentUser:()=>user,config:{enabled:true},subscribe(fn){listener=fn;return()=>{};}};return {s,store,account,switchUser(next){user=next;listener({user});}};}
const ack=(batch,state,revision=1)=>({uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:batch.batchId,cloudRevision:revision,state,importIds:batch.importIds,reportIds:[]});
test('authentication never uploads guest storage; declining import leaves all data untouched',async()=>{
 const f=await fixture();f.s.setItem('atpl_mb_v2_state',JSON.stringify(counted(8,4)));let commits=0;const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>({pull:async()=>({epoch:'initial',cloudRevision:0,state:empty()}),commit:async()=>{commits++;throw new Error('unexpected');},close(){}}),online:()=>true,codes:['MB']});
 await c.syncNow('MB');assert.equal(commits,0);assert.deepEqual(f.store.getEnvelope().state.progress,{});assert.equal(JSON.parse(f.s.getItem('atpl_mb_v2_state')).progress[1].attempts,8);
 const before=f.store.getEnvelope();assert.equal(await reviewLegacyImport({store:f.store,guest:counted(8,4),identity,confirm:async()=>false,backup:()=>{throw new Error('decline should not download');}}),false);assert.deepEqual(f.store.getEnvelope(),before);c.stop();f.store.release();
});
test('partial history upload remains pending, then all acknowledged reports can show synced',async()=>{
 const f=await fixture(),reports=Array.from({length:23},(_,i)=>report(i+100));f.store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify({...counted(),examHistory:reports}));let remote=empty(),revision=0;
 const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>({commit:async batch=>{remote={...counted(),examHistory:[...remote.examHistory,...batch.reports]};return ack(batch,remote,++revision);},close(){}}),online:()=>true,codes:['MB'],maxBatches:1});
 await c.syncNow('MB');assert.equal(c.status().kind,'pending');assert.equal(f.store.getEnvelope().state.examHistory.length,23);await c.syncNow('MB');assert.equal(c.status().kind,'synced');c.stop();f.store.release();
});
test('quota/auth failures and identity switches cannot claim sync or commit stale acknowledgements',async()=>{
 const f=await fixture();f.store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted()));let resolve,started;const ready=new Promise(r=>started=r),response=new Promise(r=>resolve=r);const before=f.store.getEnvelope().cloudRevision;
 const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>({commit:async batch=>{started(batch);return response;},close(){}}),online:()=>true,codes:['MB']});const syncing=c.syncNow('MB'),batch=await ready;f.switchUser({uid:'bob'});resolve(ack(batch,counted()));await syncing;assert.equal(f.store.getEnvelope().cloudRevision,before);assert.notEqual(c.status().kind,'synced');c.stop();f.store.release();
 const g=await fixture();g.store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted()));const quota=createSyncController({account:g.account,openBank:async()=>g.store,transportFactory:()=>({commit:async()=>{throw Object.assign(new Error('quota'),{code:'resource-exhausted'});},close(){}}),online:()=>true,codes:['MB']});await quota.syncNow();assert.equal(quota.status().kind,'error');assert.ok(g.store.getEnvelope().inflight);quota.stop();g.store.release();
});
test('reviewed import saves backup first and malformed imports never partially overwrite the account',async()=>{
 const f=await fixture();let backups=0;assert.equal(await reviewLegacyImport({store:f.store,guest:counted(8,4),identity,confirm:async()=>true,backup:()=>{backups++;}}),true);assert.equal(backups,1);assert.equal(f.store.getEnvelope().state.progress[1].attempts,8);const before=f.store.getEnvelope();await assert.rejects(()=>reviewLegacyImport({store:f.store,guest:{...counted(),bookmarks:[999]},identity,confirm:async()=>true,backup:()=>{}}));assert.deepEqual(f.store.getEnvelope(),before);f.store.release();
});
test('an unsaved engine answer prevents a false synced label even if older durable state syncs',async()=>{
 const f=await fixture();const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>({pull:async()=>({epoch:'initial',cloudRevision:0,state:empty()}),close(){}}),online:()=>true,codes:['MB']});c.setLocalDurability(false);await c.syncNow();assert.equal(c.status().kind,'error');assert.match(c.status().message,/lưu|save/i);c.stop();f.store.release();
});
test('an invalid refresh token stops before opening a cloud transport and requires Google sign-in again',async()=>{
 const f=await fixture();f.account.validateSession=async()=>{throw Object.assign(new Error('invalid refresh token'),{code:'auth/invalid-refresh-token'});};let opened=false;const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>{opened=true;return {pull:async()=>({epoch:'initial',cloudRevision:0,state:empty()}),close(){}};},online:()=>true,codes:['MB']});await c.syncNow();assert.equal(c.status().kind,'reauth');assert.equal(opened,false);c.stop();f.store.release();
});
test('cloud epoch recovery backs up before confirmation, preserves a declined queue, and replaces only on approval',async()=>{
 const f=await fixture();f.store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(counted()));const before=f.store.getEnvelope(),events=[];const c=createSyncController({account:f.account,openBank:async()=>f.store,transportFactory:()=>({pull:async()=>({epoch:'reset-remote',cloudRevision:2,state:empty()}),close(){}}),online:()=>true,codes:['MB']});
 assert.equal(await c.restoreFromCloud('MB',{backup:()=>events.push('backup'),confirm:()=>{events.push('confirm');return false;}}),false);assert.deepEqual(events,['backup','confirm']);assert.deepEqual(f.store.getEnvelope(),before);
 assert.equal(await c.restoreFromCloud('MB',{backup:e=>assert.equal(e.state.progress[1].attempts,3),confirm:()=>true}),true);assert.equal(f.store.getEnvelope().epoch,'reset-remote');assert.deepEqual(f.store.getEnvelope().state.progress,{});c.stop();f.store.release();
});
