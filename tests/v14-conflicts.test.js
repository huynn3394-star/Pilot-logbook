import {test} from 'node:test';import assert from 'node:assert/strict';
import * as api from '../public/workspace/flight-conflict.js';
import {flightRecord,clone} from './fixtures/workspace.js';
import {recordFlightRevision,validateAuditTransition} from '../public/lib/flight-audit.js';
import {mergeRecord} from '../public/workspace/model.js';
const opts={at:'2026-10-24T07:00:00Z',entryId:'base',reason:'Đối chiếu',replaceConfirmed:true};
function conflict(){const base=flightRecord();base.data.logbook={version:1,sicMinutes:70};base.data=recordFlightRevision(null,base.data,opts);const local=clone(base),remote=clone(base);local.data=recordFlightRevision(base.data,{...base.data,note:'local'},{...opts,entryId:'local'});remote.data=recordFlightRevision(base.data,{...base.data,note:'remote'},{...opts,entryId:'remote'});return{base,local,remote};}
test('choosing local after concurrent edits extends the remote history and can merge',()=>{
 assert.equal(typeof api.resolveFlightConflict,'function');const row=conflict();
 const next=api.resolveFlightConflict(row,'local',{...opts,entryId:'choice',reason:'Giữ ghi chú đã đối chiếu'});
 assert.equal(next.data.note,'local');assert.deepEqual(next.data.auditTrail.entries.slice(0,2),row.remote.data.auditTrail.entries);
 assert.equal(next.data.auditTrail.entries.at(-1).after.note,'local');assert.doesNotThrow(()=>validateAuditTransition(row.remote.data,next.data));
 assert.equal(mergeRecord({base:row.remote,local:next,remote:row.remote}).conflict,null);
 assert.equal(row.local.data.auditTrail.entries[1].id,'local');
});
test('choosing server preserves exact history; choosing local needs a reason',()=>{
 assert.equal(typeof api.resolveFlightConflict,'function');const row=conflict();
 assert.deepEqual(api.resolveFlightConflict(row,'remote'),row.remote);
 assert.throws(()=>api.resolveFlightConflict(row,'local',{...opts,reason:' '}),/lý do/i);
});
test('local evidence choice is hashed into resolution without dropping remote entries',()=>{
 assert.equal(typeof api.resolveFlightConflict,'function');const row=conflict();row.remote.evidence={sha256:'a'.repeat(64)};row.local.evidence={sha256:'b'.repeat(64)};
 const next=api.resolveFlightConflict(row,'local',{...opts,entryId:'choice'});
 assert.equal(next.data.auditTrail.entries.at(-1).before.evidenceHash,'a'.repeat(64));
 assert.equal(next.data.auditTrail.entries.at(-1).after.evidenceHash,'b'.repeat(64));
});
