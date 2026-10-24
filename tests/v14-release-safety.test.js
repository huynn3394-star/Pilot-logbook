import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeRoster,restoreBackup} from '../public/lib/domain.js';
import {recordFlightRevision} from '../public/lib/flight-audit.js';
import {timeTotals} from '../public/lib/flight-times.js';
import {previewRecords} from '../public/workspace/migration.js';
import {assertImportCapability} from '../public/workspace/capabilities.js';
import {flightRecord,snapshot,clone} from './fixtures/workspace.js';
const options={at:'2026-10-24T07:00:00Z',entryId:'final',replaceConfirmed:true,reason:'Checked original'};
const roster=()=>({...flightRecord().data,dep:'BKK',dest:'DLI',aircraft:'A320',actual:{},confirmed:false});
function reopened(){const first=recordFlightRevision(null,{...flightRecord().data,logbook:{version:1}},options);return recordFlightRevision(first,{...first,confirmed:false},{...options,entryId:'reopened'});}
test('roster changes only Scheduled after a FINAL is reopened, retaining its operational fields and history',()=>{
 const old=reopened(),{flights:[next]}=mergeRoster([old],[roster()],{v14Enabled:true});
 assert.equal(next.dep,'SGN');assert.equal(next.dest,'HAN');assert.equal(next.aircraft,'A321');
 assert.equal(next.scheduled.dep,'BKK');assert.equal(next.scheduled.dest,'DLI');assert.deepEqual(next.auditTrail,old.auditTrail);
});
test('roster cannot modify an existing V14 record when cloud capability is off',()=>{
 const old=reopened();assert.deepEqual(mergeRoster([old],[roster()],{v14Enabled:false}).flights,[old]);
});
test('new V14 roster flights keep blank SIC unknown after FINAL while existing legacy entries keep their original allocation',()=>{
 const fresh=mergeRoster([],[roster()],{v14Enabled:true}).flights[0];
 const final=recordFlightRevision(fresh,{...fresh,actual:flightRecord().data.actual,confirmed:true},options);
 assert.equal(timeTotals(final).sic,null);assert.equal(timeTotals(final).legacySIC,false);
 const legacy=flightRecord({data:{confirmed:false}}).data;
 const existing=mergeRoster([legacy],[roster()],{v14Enabled:true}).flights[0];
 assert.equal(existing.logbook,undefined);assert.equal(timeTotals(existing).sic,70);
 assert.equal(mergeRoster([],[roster()],{v14Enabled:false}).flights[0].logbook,undefined);
});
test('legacy backup cannot remove an existing draft explicit allocation in guest or account restore',async()=>{
 const old=flightRecord({data:{confirmed:false,logbook:{version:1,sicMinutes:60}}}),incoming=clone(old);delete incoming.data.logbook;
 const preview=await previewRecords({records:[incoming],current:snapshot([old]),raw:{}});
 assert.equal(preview.collisions[0].protected,true);assert.deepEqual(preview.changes[0].next,old);
 const restored=restoreBackup({version:1,flights:[incoming.data]},[old.data]);assert.deepEqual(restored.flights[0],old.data);
});
test('flag-off import checks the existing base as well as incoming data before any staging',()=>{
 const base=flightRecord({data:{confirmed:false,logbook:{version:1,sicMinutes:60}}}),next=clone(base);delete next.data.logbook;
 for(const preview of [{changes:[{base,next}]},{parts:[{changes:[{base,next}]}]}]){
  assert.throws(()=>assertImportCapability(preview,{uid:'alice',enabled:false}),/V14/);
  assert.doesNotThrow(()=>assertImportCapability(preview,{uid:'alice',enabled:true}));
 }
});
