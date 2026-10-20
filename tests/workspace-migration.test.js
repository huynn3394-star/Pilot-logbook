import {test} from 'node:test';import assert from 'node:assert/strict';
import {previewMigration,stageMigration} from '../public/workspace/migration.js';import {flightRecord,personRecord,dutyRecord,snapshot} from './fixtures/workspace.js';
const source=()=>({version:1,flights:[flightRecord().data],duties:[],people:[],settings:{name:'Test pilot',base:'SGN',notifications:true},demo:false});
const empty=()=>snapshot([]);
test('declined imports and unselected demo cannot stage data or images; raw source remains unchanged',async()=>{
 const raw=source(),before=JSON.stringify(raw),preview=await previewMigration({source:raw,sourceText:before,current:empty()});let writes=0;const repository={uid:'alice',saveRecovery:async()=>writes++,save:async()=>writes++};
 assert.equal(await stageMigration({repository,preview,confirm:async()=>false,token:{uid:'alice'}}),false);assert.equal(writes,0);assert.equal(JSON.stringify(raw),before);
 const demo=await previewMigration({source:{...raw,demo:true},current:empty()});assert.equal(demo.changes.length,0);assert.ok(demo.blockedRows.length);assert.equal((await previewMigration({source:{...raw,demo:true},current:empty(),includeDemo:true})).changes.length,2);
});
test('recovery quota failure blocks every import operation; raw input is preserved before first domain save',async()=>{
 const raw=source(),preview=await previewMigration({source:raw,sourceText:JSON.stringify(raw),current:empty()});let saves=0;
 await assert.rejects(()=>stageMigration({repository:{uid:'alice',saveRecovery:async()=>{throw Error('quota');},save:async()=>saves++},preview,confirm:async()=>true,token:{uid:'alice'}}),/quota/);assert.equal(saves,0);
 let recovery;await stageMigration({repository:{uid:'alice',saveRecovery:async value=>{recovery=value;},save:async()=>{assert.equal(recovery.sourceText,JSON.stringify(raw));saves++;}},preview,confirm:async()=>true,token:{uid:'alice'}});assert.ok(saves);
});
test('source identity cannot switch account; canonical import hash excludes external UID/device/export time',async()=>{
 const raw=source(),one=await previewMigration({source:{...raw,uid:'bob',email:'b@example.test',exportedAt:'yesterday'},current:empty()}),two=await previewMigration({source:{...raw,uid:'eve',deviceId:'other',exportedAt:'today'},current:empty()});assert.equal(one.targetUID,'alice');assert.equal(one.importHash,two.importHash);assert.equal(one.profilePreferences.profile.name,'Test pilot');assert.ok(one.changes.every(c=>c.next.data.notifications===undefined));
});
test('confirmed existing Actual survives restore; unknown row fields are blocked rather than silently removed',async()=>{
 const current=snapshot([flightRecord()]),raw=source();raw.flights[0].actual.out='2026-10-09T03:59:00.000Z';const preview=await previewMigration({source:raw,current});const change=preview.changes.find(c=>c.kind==='flight');assert.equal(change.next.data.actual.out,current.records[0].data.actual.out);assert.ok(preview.collisions.some(c=>c.protected));
 raw.flights[0].surprise='never drop';const invalid=await previewMigration({source:raw,current:empty()});assert.ok(invalid.blockedRows.some(r=>r.kind==='flight'));assert.equal(invalid.raw.source.flights[0].surprise,'never drop');
});
test('unsafe IDs remain data, dependencies precede flights, chunks fit bounded operations and v1 limits reject',async()=>{
 const raw=source();raw.people=[personRecord('a/b').data];raw.duties=[dutyRecord().data];raw.flights[0].captainId='a/b';raw.flights[0].dutyId='d1';const preview=await previewMigration({source:raw,current:empty()});assert.equal(preview.blockedRows.length,0);assert.equal(preview.changes.find(c=>c.kind==='person').id,'a/b');assert.ok(preview.parts.findIndex(p=>p.changes.some(c=>c.kind==='person'))<=preview.parts.findIndex(p=>p.changes.some(c=>c.kind==='flight')));assert.ok(preview.parts.every(p=>p.changes.length<=8));
 await assert.rejects(()=>previewMigration({source:{...raw,flights:Array(10001).fill(raw.flights[0])},current:empty()}),/10.000|10000/);await assert.rejects(()=>previewMigration({source:raw,sourceText:' '.repeat(50*1024*1024+1),current:empty()}),/50/);
});
test('different source IDs with the same active flightKey are blocked at preview before partial staging',async()=>{const raw=source();raw.flights.push({...structuredClone(raw.flights[0]),id:'duplicate-source'});const preview=await previewMigration({source:raw,current:empty()});assert.ok(preview.blockedRows.some(r=>/trùng|cùng/i.test(r.message)));let writes=0;await assert.rejects(()=>stageMigration({repository:{uid:'alice',saveRecovery:async()=>writes++,save:async()=>writes++},preview,confirm:async()=>true,token:{uid:'alice'}}));assert.equal(writes,0);});
