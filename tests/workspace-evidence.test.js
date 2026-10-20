import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareEvidence,verifyEvidence} from '../public/workspace/evidence.js';
import {createTransfers} from '../public/workspace/transfers.js';
import {flightRecord} from './fixtures/workspace.js';
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==','base64'));
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
const file=(size=png.length,type='image/png')=>new Blob([png,new Uint8Array(Math.max(0,size-png.length))],{type});
test('original image bytes and exact 6 MiB boundary survive preparation; zero, larger, SVG, HTML and forged MIME fail',async()=>{
 const original=file(),result=await prepareEvidence(original);assert.equal(result.blob,original);assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),png);assert.equal(result.ref.cloudReady,false);assert.equal((await prepareEvidence(file(6*1024*1024))).ref.bytes,6*1024*1024);
 for(const bad of [new Blob([],{type:'image/png'}),file(6*1024*1024+1),file(png.length,'image/jpeg'),new Blob(['<svg/>'],{type:'image/svg+xml'}),new Blob(['<html>'],{type:'image/png'})])await assert.rejects(()=>prepareEvidence(bad));
});
test('downloaded or resumed byte mismatch never becomes verified',async()=>{const {ref}=await prepareEvidence(file());await assert.rejects(()=>verifyEvidence({...ref,sha256:'a'.repeat(64)},file()),/hash|SHA|digest/i);await assert.rejects(()=>verifyEvidence({...ref,bytes:ref.bytes+1},file()));const real=createImageBitmap;globalThis.createImageBitmap=async()=>{throw Error('decode failed');};try{await assert.rejects(()=>prepareEvidence(file()),/decode|giải mã/);}finally{globalThis.createImageBitmap=real;}});
async function setup({count=3,upload,download}={}){
 const {ref,blob}=await prepareEvidence(file());const prepared=await Promise.all(Array.from({length:count},(_,i)=>prepareEvidence(i===0?blob:new Blob([png,new Uint8Array([i])],{type:'image/png'}))));let records=prepared.map((p,i)=>flightRecord({id:'f'+i,evidence:p.ref,archived:i===2})),items=[],generation=1,closed=0;const listeners=new Set(),bytes=new Map(prepared.map(p=>[p.ref.sha256,p.blob]));
 const coordinator={capture:()=>({uid:'alice',generation}),isCurrent:t=>t.generation===generation&&t.uid==='alice',subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
 const repository={uid:'alice',writable:true,read:async()=>({records:structuredClone(records)}),transfers:async()=>items,getBlob:async hash=>bytes.get(hash)||null,putBlob:async(r,b)=>bytes.set(r.sha256,b),setTransfer:async item=>{items=items.filter(x=>x.id!==item.id);items.push(item);},save:async({changes})=>{for(const c of changes)records[records.findIndex(r=>r.id===c.id)]=structuredClone(c.next);},releaseBlob:async()=>false};
 const account={config:{enabled:true,evidenceSyncEnabled:true},currentUser:()=>({uid:'alice'}),validateSession:async()=> 'alice',subscribe:()=>()=>{}};
 const transport={upload:upload||(async()=>{}),download:download||(async()=>blob),close(){closed++;}};
 const transfers=createTransfers({account,repository,coordinator,transportFactory:()=>transport});return{transfers,repository,ref,blob,get records(){return records;},get items(){return items;},get closed(){return closed;},change(){generation++;for(const fn of listeners)fn();},removeBytes(hash){if(hash)bytes.delete(hash);else bytes.clear();},replace(){records[0].evidence={...ref,sha256:'e'.repeat(64)};}};
}
test('at most two uploads run, dedup same UID, metadata pending has separate status, and trash images participate',async()=>{
 let concurrent=0,max=0,calls=0;const s=await setup({upload:async()=>{calls++;max=Math.max(max,++concurrent);await new Promise(r=>setImmediate(r));concurrent--;}});await s.transfers.pump();assert.equal(max,2);assert.equal(calls,3);assert.ok(s.records.every(r=>r.evidence.cloudReady));assert.equal(s.transfers.status().pending,0);s.transfers.stop();
 const duplicate=await setup({count:1,upload:async()=>{calls++;}});await duplicate.transfers.pump();await duplicate.transfers.pump();assert.equal(calls,4);duplicate.transfers.stop();
});
test('failed/interrupted upload retains original bytes and retries, without marking complete',async()=>{
 let first=true;const s=await setup({count:1,upload:async()=>{if(first){first=false;throw Error('interrupted');}}});await s.transfers.pump();assert.equal(s.records[0].evidence.cloudReady,false);assert.equal(s.transfers.status().pending,1);assert.equal(await s.repository.getBlob(s.ref.sha256),s.blob);await s.transfers.pump();assert.equal(s.records[0].evidence.cloudReady,true);s.transfers.stop();
});
test('changed digest and changed account during upload cannot attach stale completion',async()=>{
 let s;s=await setup({count:1,upload:async()=>s.replace()});await s.transfers.pump();assert.equal(s.records[0].evidence.sha256,'e'.repeat(64));assert.equal(s.records[0].evidence.cloudReady,false);s.transfers.stop();
 let a;a=await setup({count:1,upload:async()=>a.change()});await a.transfers.pump();assert.equal(a.records[0].evidence.cloudReady,false);assert.ok(a.closed);a.transfers.stop();
});
test('download all includes trash, reports missing/unuploaded, and refuses account change before local put',async()=>{
 const s=await setup({count:1});await s.transfers.pump();s.removeBytes();await s.transfers.downloadAll();assert.ok(await s.repository.getBlob(s.ref.sha256));assert.equal(s.transfers.status().offlineReady,1);s.transfers.stop();
 const missing=await setup({count:1});missing.removeBytes();await missing.transfers.downloadAll();assert.equal(missing.transfers.status().missing,1);missing.transfers.stop();
 let changed;changed=await setup({count:1,download:async()=>{changed.change();return changed.blob;}});await changed.transfers.pump();changed.removeBytes();await changed.transfers.downloadAll();assert.equal(await changed.repository.getBlob(changed.ref.sha256),null);changed.transfers.stop();
});

test('upload and explicit download share the same two-worker limit',async()=>{
 let active=0,max=0;const releases=[];let unlocked=false;const work=async()=>{max=Math.max(max,++active);if(!unlocked)await new Promise(r=>releases.push(r));active--;};
 const s=await setup({count:4,upload:work,download:async ref=>{await work();return new Blob([png,new Uint8Array([Number.parseInt('0',10)])],{type:'image/png'});}});
 for(const r of s.records.slice(2)){r.evidence.cloudReady=true;s.removeBytes(r.evidence.sha256);}
 const running=Promise.all([s.transfers.pump(),s.transfers.downloadAll()]);for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));unlocked=true;for(const release of releases)release();await running;assert.equal(max,2);s.transfers.stop();
});

test('two flights sharing one digest use a single upload and both become cloud-ready',async()=>{
 let uploads=0;const s=await setup({count:2,upload:async()=>{uploads++;}});s.records[1].evidence={...s.records[0].evidence};await s.transfers.pump();assert.equal(uploads,1);assert.ok(s.records.every(r=>r.evidence.cloudReady));s.transfers.stop();
});
