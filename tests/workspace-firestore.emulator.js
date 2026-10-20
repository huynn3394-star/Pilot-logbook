import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDocFromServer,getDocsFromServer,collection,query,orderBy,documentId,startAfter,limit,writeBatch,serverTimestamp} from 'firebase/firestore';
import {createWorkspaceTransport} from '../public/workspace/firebase-transport.js';
import {pullStableWorkspace} from '../public/workspace/pull.js';
import {recordKey} from '../public/workspace/schema.js';
import {flightRecord,personRecord,operation,clone} from './fixtures/workspace.js';
let env,aDB,bDB;
const root='users/alice/workspaces/main';
const transport=db=>createWorkspaceTransport({db,uid:'alice',getAuthGeneration:()=>1});
const op=(changes,id=crypto.randomUUID())=>({...operation(changes),operationId:id,baseRevision:0});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-atpl-sync',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firebase/firestore.rules','utf8')}});aDB=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();bDB=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();});
beforeEach(()=>env.clearFirestore());after(()=>env?.cleanup());
test('same immutable receipt retries once and rejects reused ID with modified body',async()=>{
 const a=transport(aDB),change={kind:'flight',id:'f1',base:null,next:flightRecord({revision:0})},request=op([change],'first');
 const first=await a.commit(request),again=await a.commit(clone(request));assert.equal(first.revision,1);assert.deepEqual(again,first);assert.equal((await a.pull()).records.length,1);
 const modified=clone(request);modified.changes[0].next.data.note='tampered';await assert.rejects(()=>a.commit(modified),/hash|nội dung|receipt/i);a.close();
});
test('two real writers merge separate groups and retain same-group conflicts',async()=>{
 const a=transport(aDB),b=transport(bDB);await a.commit(op([{kind:'flight',id:'f1',base:null,next:flightRecord({revision:0})}],'seed'));
 const base=(await a.pull()).records[0],local={...clone(base),data:{...base.data,note:'phone note'}},remote={...clone(base),data:{...base.data,scheduled:{...base.data.scheduled,out:'2026-10-09T04:01:00.000Z'}}};
 await Promise.all([a.commit(op([{kind:'flight',id:'f1',base,next:local}],'phone')),b.commit(op([{kind:'flight',id:'f1',base,next:remote}],'ipad'))]);
 let current=(await a.pull()).records[0];assert.equal(current.data.note,'phone note');assert.equal(current.data.scheduled.out,'2026-10-09T04:01:00.000Z');
 const left=clone(current),right=clone(current);left.data.note='A';right.data.note='B';const results=await Promise.all([a.commit(op([{kind:'flight',id:'f1',base:current,next:left}],'left')),b.commit(op([{kind:'flight',id:'f1',base:current,next:right}],'right'))]);
 assert.equal(results.flatMap(r=>r.results).filter(r=>r.status==='conflict').length,1);a.close();b.close();
});
test('confirmed Actual is not overwritten by an older unconfirmed client',async()=>{
 const a=transport(aDB),base=flightRecord({revision:0,data:{confirmed:false}});await a.commit(op([{kind:'flight',id:'f1',base:null,next:base}],'unconfirmed'));
 const old=(await a.pull()).records[0],confirmed=clone(old);confirmed.data.confirmed=true;await a.commit(op([{kind:'flight',id:'f1',base:old,next:confirmed}],'confirmed'));
 const late=clone(old);late.data.actual.out='2026-10-09T03:59:00.000Z';const result=await a.commit(op([{kind:'flight',id:'f1',base:old,next:late}],'late'));assert.equal(result.results[0].status,'conflict');assert.equal((await a.pull()).records[0].data.actual.out,'2026-10-09T04:00:00.000Z');a.close();
});
test('different record IDs cannot create duplicate flightKeys; archive/rekey/restore preserve claims',async()=>{
 const a=transport(aDB),b=transport(bDB),one=flightRecord({id:'f1',revision:0}),two=flightRecord({id:'f2',revision:0,data:{id:'f2'}});
 const concurrent=await Promise.all([a.commit(op([{kind:'flight',id:'f1',base:null,next:one}],'one')),b.commit(op([{kind:'flight',id:'f2',base:null,next:two}],'two'))]);assert.equal(concurrent.flatMap(r=>r.results).filter(r=>r.status==='conflict').length,1);
 const first=(await a.pull()).records[0],archived={...clone(first),archived:true,archive:{id:'trash-one',at:'2026-10-09T08:00:00.000Z'}};
 await a.commit(op([{kind:'flight',id:first.id,base:first,next:archived}],'archive'));const newcomer=flightRecord({id:'new',revision:0,data:{id:'new'}});assert.equal((await b.commit(op([{kind:'flight',id:'new',base:null,next:newcomer}],'new'))).results[0].status,'accepted');
 const archivedCloud=(await a.pull()).records.find(r=>r.id===first.id),restore={...clone(archivedCloud),archived:false};delete restore.archive;assert.equal((await a.commit(op([{kind:'flight',id:first.id,base:archivedCloud,next:restore}],'restore'))).results[0].status,'conflict');
 const active=(await b.pull()).records.find(r=>r.id==='new'),moved=clone(active);moved.data.flightNo='VN777';assert.equal((await b.commit(op([{kind:'flight',id:'new',base:active,next:moved}],'move'))).results[0].status,'accepted');assert.equal((await a.commit(op([{kind:'flight',id:first.id,base:archivedCloud,next:restore}],'restore-after-move'))).results[0].status,'accepted');
 assert.equal((await a.pull()).records.filter(r=>!r.archived).length,2);a.close();b.close();
});
test('eight flight records and claims fit actual transaction rules; mixed conflict does not reject unrelated record',async()=>{
 const a=transport(aDB),changes=Array.from({length:8},(_,i)=>{const f=flightRecord({id:'f'+i,revision:0,data:{id:'f'+i,flightNo:'VN'+(1000+i),weather:{day:'2026-10-09',reports:['VVTS','VVNB'].map(station=>({station,provider:'NOAA Aviation Weather Center',fetchedAt:'2026-10-09T04:00:00.000Z',source:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,metar:station+' 090400Z 00000KT CAVOK 30/24 Q1010',taf:null}))}}});return {kind:'flight',id:f.id,base:null,next:f};});
 const ack=await a.commit(op(changes,'eight'));assert.equal(ack.results.filter(r=>r.status==='accepted').length,8);const original=(await a.pull()).records.find(r=>r.id==='f0'),other=clone(original);other.data.note='changed';await a.commit(op([{kind:'flight',id:'f0',base:original,next:other}],'changed'));
 const stale=clone(original);stale.data.note='old client';const p=personRecord('p1');const mixed=await a.commit(op([{kind:'flight',id:'f0',base:original,next:stale},{kind:'person',id:'p1',base:null,next:p}],'mixed'));assert.deepEqual(mixed.results.map(r=>r.status),['conflict','accepted']);assert.ok((await a.pull()).records.some(r=>r.id==='p1'));a.close();
});
async function pagedSetup(){
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore(),batch=writeBatch(db);batch.set(doc(db,root),{schemaVersion:1,revision:1,updatedAt:serverTimestamp()});for(let i=0;i<201;i++){const p=personRecord('p'+i);batch.set(doc(db,root+'/records/'+await recordKey('person',p.id)),p);}await batch.commit();});
}
function readers(onFirstPage=async()=>{}){
 return {uid:'alice',guard:()=>{},readHead:async()=>{const r=await getDocFromServer(doc(aDB,root));return r.exists()?r.data():null;},readPage:async({after,limit:count})=>{const conditions=[orderBy(documentId()),limit(count)];if(after)conditions.push(startAfter(after));const page=await getDocsFromServer(query(collection(aDB,root+'/records'),...conditions));if(!after)await onFirstPage();return page.docs.map(d=>({key:d.id,data:d.data()}));}};
}
test('actual paginated pull retries a real second writer between pages and publishes one consistent revision',async()=>{
 await pagedSetup();const b=transport(bDB);let writes=0;const sdkReaders=readers(async()=>{if(writes++)return;const current=(await getDocFromServer(doc(bDB,root+'/records/'+await recordKey('person','p0')))).data(),next=clone(current);next.data.note='second writer';await b.commit(op([{kind:'person',id:'p0',base:current,next}],'page-race'));});
 const snapshot=await pullStableWorkspace(sdkReaders);assert.equal(snapshot.cloudRevision,2);assert.equal(snapshot.records.length,201);assert.equal(snapshot.records.find(r=>r.id==='p0').data.note,'second writer');assert.ok(writes>=2);b.close();
});
test('three continuously changing real snapshots return pending rather than partial records',async()=>{
 await pagedSetup();const b=transport(bDB);let writes=0;const sdkReaders=readers(async()=>{writes++;const current=(await getDocFromServer(doc(bDB,root+'/records/'+await recordKey('person','p0')))).data(),next=clone(current);next.data.note='writer '+writes;await b.commit(op([{kind:'person',id:'p0',base:current,next}],'unstable-'+writes));});
 await assert.rejects(()=>pullStableWorkspace(sdkReaders),error=>error.code==='workspace/unstable-snapshot');assert.equal(writes,3);b.close();
});
test('account generation changes stop server reads and commits before old state can be applied',async()=>{
 let generation=1;const a=createWorkspaceTransport({db:aDB,uid:'alice',getAuthGeneration:()=>generation});generation=2;await assert.rejects(()=>a.pull(),/generation|tài khoản|đã đổi/);await assert.rejects(()=>a.commit(op([{kind:'person',id:'p1',base:null,next:personRecord()}])),/generation|tài khoản|đã đổi/);a.close();
});
test('missing references conflict while unrelated records and valid crew references can sync',async()=>{
 const a=transport(aDB),bad=flightRecord({revision:0,data:{captainId:'missing'}}),person=personRecord();
 const mixed=await a.commit(op([{kind:'flight',id:'f1',base:null,next:bad},{kind:'person',id:'p1',base:null,next:person}],'refs-bad'));assert.deepEqual(mixed.results.map(r=>r.status),['conflict','accepted']);
 const good=flightRecord({revision:0,data:{captainId:'p1'}});assert.equal((await a.commit(op([{kind:'flight',id:'f1',base:null,next:good}],'refs-good'))).results[0].status,'accepted');a.close();
});
test('reimporting the same source part after later edits keeps those edits and does not overwrite its marker',async()=>{
 const a=transport(aDB),source=personRecord(),first=op([{kind:'person',id:'p1',base:null,next:source}],'import-first');first.importPart={hash:'b'.repeat(64),index:0,total:1};await a.commit(first);
 const current=(await a.pull()).records[0],edited=clone(current);edited.data.name='User edit after import';await a.commit(op([{kind:'person',id:'p1',base:current,next:edited}],'edit-after-import'));
 const duplicate=clone(first);duplicate.operationId='import-other-device';const ack=await a.commit(duplicate);assert.equal(ack.results[0].status,'already-applied');assert.equal((await a.pull()).records[0].data.name,'User edit after import');a.close();
});
test('controller recovers an actual lost Firestore receipt before its causal child and retains original server revision',async()=>{
 const {createWorkspaceController}=await import('../public/workspace/controller.js');
 const a=transport(aDB),record=personRecord(),first=op([{kind:'person',id:'p1',base:null,next:record}],'causal-parent'),second=op([{kind:'person',id:'p1',base:record,next:{...clone(record),data:{...record.data,name:'Tail after send'}}}],'causal-child');second.parents=[first.operationId];
 const committed=await a.commit(first);let pending=[first,second],localRevision=0,fail=true;const sent=[];
 const repository={uid:'alice',writable:true,read:async()=>({cloudRevision:localRevision}),pending:async()=>clone(pending),conflicts:async()=>[],acceptRemote:async s=>{localRevision=s.cloudRevision;},acceptAck:async ack=>{if(fail){fail=false;throw Error('local durability failure');}localRevision=Math.max(localRevision,ack.revision);pending=pending.filter(o=>o.operationId!==ack.operationId);}};
 const account={config:{enabled:true,workspaceSyncEnabled:true},currentUser:()=>({uid:'alice'}),validateSession:async()=> 'alice',subscribe:()=>()=>{}};
 const coordinator={capture:()=>({uid:'alice',generation:1}),isCurrent:()=>true,subscribe:()=>()=>{}};
 const controller=createWorkspaceController({account,repository,coordinator,transportFactory:()=>({...a,subscribe:()=>()=>{},commit:async request=>{sent.push(request.operationId);return a.commit(request);}})});
 await controller.syncNow();assert.equal(controller.status().kind,'error');assert.equal(pending.length,2);await controller.syncNow();assert.deepEqual(sent,['causal-parent','causal-parent','causal-child']);assert.equal((await a.pull()).records[0].data.name,'Tail after send');assert.equal((await a.commit(first)).revision,committed.revision);assert.equal(controller.status().kind,'synced');controller.stop();
});
test('same deterministic import on two real devices applies once and resumes later parts',async()=>{
 const a=transport(aDB),b=transport(bDB),p=personRecord(),first=op([{kind:'person',id:'p1',base:null,next:p}],'import-phone'),second=clone(first);first.importPart={hash:'c'.repeat(64),index:0,total:2};second.importPart=clone(first.importPart);second.operationId='import-ipad';
 const acks=await Promise.all([a.commit(first),b.commit(second)]);assert.equal(acks.flatMap(r=>r.results).filter(r=>r.status==='accepted').length,1);assert.equal((await a.pull()).records.length,1);
 const f=flightRecord({revision:0,data:{captainId:'p1'}}),tail=op([{kind:'flight',id:'f1',base:null,next:f}],'import-resume');tail.importPart={hash:'c'.repeat(64),index:1,total:2};await b.commit(tail);assert.equal((await a.pull()).records.length,2);assert.deepEqual(await a.commit(first),acks[0]);a.close();b.close();
});
