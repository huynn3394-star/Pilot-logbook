import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateState,diffState,applyDelta,prepareBatch,acknowledge,canonicalReportHash} from '../public/atpl/sync/model.js';
import {identity,empty,counted,envelope,report} from './fixtures/atpl-account.js';
// Break: replacing a bank with unchecked imported JSON accepts an invalid key/statistic.
test('rejects malformed counters, unknown IDs, wrong source keys and oversized sessions without changing inputs',()=>{
 for(const bad of [{...counted(),progress:{1:{attempts:1,correct:2,lastSelected:'B',lastAt:100}}},{...counted(),bookmarks:[9]},{...counted(),progress:{1:{attempts:3,correct:2,lastSelected:'Z',lastAt:100}}},{...counted(),examHistory:[{...report(),results:[{id:1,selected:'B',answer:'A',correct:true}]}]},{...empty(),study:{ids:[1],qid:1,resumeQid:1,finished:false,mode:'x'.repeat(900000),answers:{}}}]){
  const original=structuredClone(bad);assert.throws(()=>validateState(bad,identity));assert.deepEqual(bad,original);
 }
 assert.equal(validateState({...empty(),progress:{148:{attempts:1,correct:1,lastSelected:'F',lastAt:1}}},identity).progress[148].lastSelected,'F');
});
// Break: accepting whole snapshots loses independent offline attempts.
test('adds independent offline deltas and uses server acceptance order despite device clock skew',()=>{
 const base=counted(),a=counted(5,3,'A',9999999999999),b=counted(4,3,'B',1);
 const merged=applyDelta(applyDelta(base,diffState(base,a,identity),1),diffState(base,b,identity),2);
 assert.deepEqual(merged.progress[1],{attempts:6,correct:4,lastSelected:'B',lastAt:1});assert.deepEqual(merged.wrong,[]);
 const stale=applyDelta(merged,diffState(base,a,identity),1);assert.equal(stale.progress[1].attempts,6);
});
// Break: sending a stale full bookmark set resurrects a deleted bookmark.
test('only changed memberships are applied and explicit removal survives stale unchanged sets',()=>{
 const base={...empty(),bookmarks:[1]},removed={...base,bookmarks:[]},staleOther={...base,settings:{theme:'dark',language:'both'}};
 const remote=applyDelta(base,diffState(base,removed,identity),1);
 assert.deepEqual(applyDelta(remote,diffState(base,staleOther,identity),2).bookmarks,[]);
});
// Break: a retry changes its batch ID/body after a new answer.
test('a prepared in-flight batch stays immutable while local work continues',()=>{
 let e=prepareBatch({...envelope(),state:counted(5,3)}, {batchId:'batch-a',deviceId:'phone'});
 const before=JSON.stringify(e.inflight);e.state=counted(6,4);e.localVersion++;
 e=prepareBatch(e,{batchId:'batch-should-not-replace',deviceId:'phone'});
 assert.equal(JSON.stringify(e.inflight),before);assert.equal(e.inflight.batch.batchId,'batch-a');
});
// Break: applying an ack erases a new answer or applies a sent delta again.
test('acknowledgement rebases only the newer local tail and retains pending history',()=>{
 let e=prepareBatch({...envelope(),state:counted(5,3)},{batchId:'batch-a',deviceId:'phone'});
 e.state=counted(6,4);e.localVersion++;
 e=acknowledge(e,{uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'batch-a',cloudRevision:2,state:counted(6,4),reportIds:[],importIds:[]});
 assert.equal(e.state.progress[1].attempts,7);assert.equal(e.state.progress[1].correct,5);assert.equal(e.baseline.progress[1].attempts,6);assert.equal(e.inflight,null);
 assert.throws(()=>acknowledge({...e,inflight:{batch:{batchId:'other'}}},{uid:'bob'}),/account|tài khoản|ack/i);
});
test('epoch conflict preserves offline work for export',()=>{
 const e=prepareBatch({...envelope(),state:counted(4,3)},{batchId:'batch-a',deviceId:'phone'}),before=structuredClone(e);
 assert.throws(()=>acknowledge(e,{uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'reset-on-ipad',batchId:'batch-a',cloudRevision:2,state:empty()}),/epoch|phiên bản|đặt lại/i);
 assert.deepEqual(e,before);
});
// Break: merging exam snapshots from unrelated session IDs invents one combined exam.
test('independent exam sessions survive and only changes to a shared session answer are merged',()=>{
 const base=empty(),exam=(id,answers)=>({ids:[1,2],qid:id,answers,submitted:false,startedAt:100});
 const a=diffState(base,{...base,exam:exam(1,{1:'B'})},identity);a.sessions.exam.id='exam-phone';
 const b=diffState(base,{...base,exam:exam(2,{2:'A'})},identity);b.sessions.exam.id='exam-ipad';
 const remote=applyDelta(applyDelta(base,a,1),b,2);
 assert.deepEqual(remote._sync.sessions['exam-phone'].state.answers,{1:'B'});assert.deepEqual(remote.exam.answers,{2:'A'});
 const same=diffState({...base,exam:exam(1,{1:'B'})},{...base,exam:exam(2,{1:'B',2:'A'})},identity);same.sessions.exam.id='exam-phone';
 const next=applyDelta(remote,same,3);assert.deepEqual(next.exam.answers,{1:'B',2:'A'});
});
test('completed report hashes are stable across object ordering and bank-specific',async()=>{
 const a=report(),b={results:a.results,percent:100,correct:1,size:1,at:1000};
 assert.equal(await canonicalReportHash('MB',a),await canonicalReportHash('MB',b));
 assert.notEqual(await canonicalReportHash('MB',a),await canonicalReportHash('MBR',a));
 assert.match(await canonicalReportHash('MB',a),/^[0-9a-f]{64}$/);
});
test('unacknowledged report batches survive core acknowledgement and are bounded',()=>{
 const state={...counted(4,3),examHistory:Array.from({length:23},(_,i)=>report(1000+i))};
 let e=prepareBatch({...envelope(),state},{batchId:'batch-a',deviceId:'phone'});
 assert.equal(e.inflight.batch.reports.length,20);
 const accepted={...counted(4,3),examHistory:state.examHistory.slice(0,20)};
 e=acknowledge(e,{uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'batch-a',cloudRevision:1,state:accepted,reportIds:[],importIds:[]});
 assert.equal(e.state.examHistory.length,23);
 const next=prepareBatch(e,{batchId:'batch-b',deviceId:'phone'});assert.equal(next.inflight.batch.reports.length,3);assert.deepEqual(next.inflight.batch.delta.progress,{});
});
