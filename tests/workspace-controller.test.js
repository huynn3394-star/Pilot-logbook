import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceController} from '../public/workspace/controller.js';
const copy=structuredClone;
function setup({operations=[],conflicts=[],offline=false,disabled=false,commit,acceptAck,validateSession}={}){
 let queue=copy(operations),issues=copy(conflicts),generation=1,user={uid:'alice'},revision=0,pulls=0,commits=[],closed=0,subscribed=0,listeners=new Set(),jobs=new Map(),next=1,online=!offline;
 const scheduler={setTimeout(fn,ms){const id=next++;jobs.set(id,{fn,ms});return id;},clearTimeout(id){jobs.delete(id);},random:()=>.5};
 const account={config:{enabled:true,workspaceSyncEnabled:!disabled},currentUser:()=>user,validateSession:validateSession||(async()=>user.uid),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
 const coordinator={capture:()=>({uid:user?.uid,generation}),isCurrent:t=>t.uid===user?.uid&&t.generation===generation,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
 const repository={uid:'alice',writable:true,pending:async()=>copy(queue),conflicts:async()=>copy(issues),read:async()=>({cloudRevision:revision,records:[]}),acceptRemote:async s=>{revision=s.cloudRevision;},acceptAck:async ack=>{if(acceptAck)await acceptAck(ack);queue=queue.filter(o=>o.operationId!==ack.operationId);issues.push(...ack.results.filter(r=>r.status==='conflict').map(r=>({...r.conflict,operationId:ack.operationId})));revision=ack.revision;}};
 const transport={pull:async()=>{pulls++;return{cloudRevision:revision,records:[]};},commit:async op=>{commits.push(copy(op));if(commit)return commit(op,{queue,issues});return{operationId:op.operationId,revision:++revision,results:op.changes.map(c=>({...c,status:'accepted'}))};},subscribe(){subscribed++;return()=>subscribed--;},close(){closed++;}};
 const controller=createWorkspaceController({account,repository,coordinator,transportFactory:()=>transport,online:()=>online,scheduler});
 return{controller,commits,jobs,repository,get pulls(){return pulls;},get closed(){return closed;},get subscribed(){return subscribed;},add(op){queue.push(copy(op));},setOnline(v){online=v;},change(){generation++;user={uid:'bob'};for(const fn of listeners)fn({user});},fire(){const job=[...jobs.values()][0];jobs.clear();return job?.fn();}};
}
const op=(id,key='f1',parents=[])=>({operationId:id,parents,changes:[{kind:'flight',id:key}]});
test('parent precedes child; receipt conflicts block only same-record descendants and let unrelated records continue',async()=>{
 const parent=op('parent'),child=op('child','f1',['parent']),other=op('unrelated','f2'),s=setup({operations:[parent,child,other],commit:async o=>({operationId:o.operationId,revision:1,results:o.changes.map(c=>({...c,status:o.operationId==='parent'?'conflict':'accepted',conflict:{kind:c.kind,recordId:c.id}}))})});
 await s.controller.syncNow();assert.deepEqual(s.commits.map(o=>o.operationId),['parent','unrelated']);assert.equal(s.controller.status().kind,'conflict');s.controller.stop();
});
test('an unknown receipt is retried unchanged before applying a predictive local conflict',async()=>{
 const request=op('unknown'),s=setup({operations:[request],conflicts:[{kind:'flight',recordId:'f1',operationId:'unknown'}]});await s.controller.syncNow();assert.deepEqual(s.commits,[request]);s.controller.stop();
});
test('durability failure retains immutable operation and manual retry; edits during sending retain their tail',async()=>{
 let first=true,s;const request=op('parent');s=setup({operations:[request],acceptAck:async()=>{if(first){first=false;s.add(op('tail','f1',['parent']));throw Error('local quota');}}});
 await s.controller.syncNow();assert.equal(s.controller.status().kind,'error');assert.equal((await s.repository.pending()).length,2);await s.controller.syncNow();assert.deepEqual(s.commits.map(o=>o.operationId),['parent','parent','tail']);assert.deepEqual(s.commits[0],s.commits[1]);assert.equal(s.controller.status().kind,'synced');s.controller.stop();
});
test('offline, disabled and expired accounts retain their pending local records',async()=>{
 for(const options of [{offline:true,kind:'offline'},{disabled:true,kind:'disabled'},{validateSession:async()=>{throw Object.assign(Error('expired'),{code:'unauthenticated'});},kind:'reauth'}]){const s=setup({...options,operations:[op('queued')]});await s.controller.syncNow();assert.equal(s.controller.status().kind,options.kind);assert.equal((await s.repository.pending()).length,1);assert.equal(s.commits.length,0);assert.equal(s.jobs.size,0);s.controller.stop();}
});
test('events coalesce; UID generation stops pending callbacks and closes listener/transport',async()=>{
 let release;const gate=new Promise(r=>release=r),s=setup({operations:[op('one')],commit:async o=>{await gate;return{operationId:o.operationId,revision:1,results:[]};}});s.controller.schedule();s.controller.schedule();assert.equal(s.jobs.size,1);assert.equal([...s.jobs.values()][0].ms,2000);
 const first=s.controller.syncNow(),second=s.controller.syncNow();assert.equal(first,second);await new Promise(r=>setImmediate(r));assert.equal(s.commits.length,1);s.change();release();await first;assert.equal((await s.repository.pending()).length,1);assert.equal(s.jobs.size,0);assert.equal(s.subscribed,0);assert.ok(s.closed);s.controller.stop();
});
test('only transient failures retry at bounded jittered backoff, at most five attempts',async()=>{
 const s=setup({operations:[op('queued')],commit:async()=>{throw Object.assign(Error('network'),{code:'unavailable'});}});await s.controller.syncNow();for(const delay of [2000,4000,8000,16000,32000]){assert.equal([...s.jobs.values()][0].ms,delay);await s.fire();}assert.equal(s.jobs.size,0);assert.equal(s.commits.length,6);s.controller.stop();
});
test('revision gap pulls then retries the exact acknowledgement; contiguous ack avoids a read',async()=>{
 let gap=true;const s=setup({operations:[op('one')],acceptAck:async()=>{if(gap){gap=false;throw Object.assign(Error('gap'),{code:'workspace/requires-pull'});}}});await s.controller.syncNow();assert.equal(s.pulls,1);assert.equal(s.commits.length,1);assert.equal(s.controller.status().kind,'synced');s.controller.stop();
 const contiguous=setup({operations:[op('one')]});await contiguous.controller.syncNow();assert.equal(contiguous.pulls,0);contiguous.controller.stop();
});
test('failed empty-account fetch is error rather than a successful empty workspace',async()=>{
 const s=setup();s.repository.acceptRemote=async()=>{throw Error('IDB failed');};await s.controller.syncNow();assert.equal(s.controller.status().kind,'error');s.controller.stop();
});
