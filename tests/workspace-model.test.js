import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRecord,validateOperation,recordKey} from '../public/workspace/schema.js';
import {mergeRecord,applyChanges,emptySnapshot} from '../public/workspace/model.js';
import {toWorkspaceView} from '../public/workspace/projection.js';
import {flightRecord,personRecord,dutyRecord,snapshot,operation,clone} from './fixtures/workspace.js';

test('independent note and Scheduled changes survive three-way merge',()=>{
 const base=flightRecord(),local=flightRecord({data:{note:'local note'}}),remote=flightRecord({data:{scheduled:{out:'2026-10-09T04:30:00.000Z',in:'2026-10-09T05:40:00.000Z'}}});
 const result=mergeRecord({base,local,remote});assert.equal(result.conflict,null);assert.equal(result.record.data.note,'local note');assert.equal(result.record.data.scheduled.out,'2026-10-09T04:30:00.000Z');assert.equal(result.record.data.actual.out,'2026-10-09T04:00:00.000Z');
});
test('same note changed differently is retained as conflict, not clock LWW',()=>{
 const result=mergeRecord({base:flightRecord(),local:flightRecord({data:{note:'A',updatedAt:'2099-01-01'}}),remote:flightRecord({data:{note:'B',updatedAt:'2000-01-01'}})});
 assert.deepEqual(result.conflict.groups,['note']);assert.equal(result.record,null);assert.equal(result.conflict.local.data.note,'A');assert.equal(result.conflict.remote.data.note,'B');
});
test('Actual is atomic across event clocks and confirmed metadata',()=>{
 const base=flightRecord(),local=flightRecord({data:{actual:{...base.data.actual,out:'2026-10-09T03:59:00.000Z'}}}),remote=flightRecord({data:{actual:{...base.data.actual,in:'2026-10-09T05:11:00.000Z'}}});
 assert.deepEqual(mergeRecord({base,local,remote}).conflict.groups,['actual']);
});
test('new cloud confirmation requires review of edits from an unconfirmed base',()=>{
 const base=flightRecord({data:{confirmed:false}}),local=flightRecord({data:{confirmed:false,note:'note',actual:{...base.data.actual,out:'2026-10-09T03:59:00.000Z'}}}),remote=flightRecord();
 assert.ok(mergeRecord({base,local,remote}).conflict.groups.includes('actual'));
});
test('equal concurrent changes converge while false zero empty and deletion are explicit',()=>{
 const base=flightRecord({data:{note:'old',confidence:50}}),local=flightRecord({data:{note:'',confidence:0}});let remote=clone(local);
 let result=mergeRecord({base,local,remote});assert.equal(result.conflict,null);assert.equal(result.record.data.note,'');assert.equal(result.record.data.confidence,0);
 delete local.data.note;remote=clone(base);result=mergeRecord({base,local,remote});assert.equal(Object.hasOwn(result.record.data,'note'),false);
 const p={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{tomorrow:true,beforeDuty:true,missingActual:true,leadMinutes:120,eveningHour:18}};
 assert.equal(mergeRecord({base:p,local:{...p,data:{...p.data,tomorrow:false}},remote:p}).record.data.tomorrow,false);
});
test('archive versus edit conflicts and clean archive keeps restorable raw record',()=>{
 const base=flightRecord(),local=flightRecord({archived:true,archive:{id:'trash-f1',at:'2026-10-09T06:00:00.000Z'}}),remote=flightRecord({data:{note:'remote'}});
 assert.ok(mergeRecord({base,local,remote}).conflict.groups.includes('archive'));
 const merged=mergeRecord({base,local,remote:base});assert.equal(merged.record.archived,true);assert.equal(merged.record.data.actual.in,'2026-10-09T05:10:00.000Z');
});
test('whole crew profiles do not mix different names and ranks',()=>{
 const base=personRecord(),local=clone(base),remote=clone(base);local.data.name='New QA';remote.data.rank='FO';assert.deepEqual(mergeRecord({base,local,remote}).conflict.groups,['person']);
});
test('evidence conflicts preserve both digests instead of silently replacing',()=>{
 const base=flightRecord(),local=flightRecord({evidence:{sha256:'a'.repeat(64),mime:'image/png',bytes:50,cloudReady:false}}),remote=flightRecord({evidence:{sha256:'b'.repeat(64),mime:'image/png',bytes:50,cloudReady:true}});
 assert.deepEqual(mergeRecord({base,local,remote}).conflict.groups,['evidence']);
});
test('archive duty projection preserves backlinks and respects later reassignment',()=>{
 const duty=dutyRecord(),flights=Array.from({length:10000},(_,i)=>flightRecord({id:'f'+i,data:{id:'f'+i,dutyId:i===0?'other-duty':'d1'}}));
 const original=snapshot([duty,...flights]),archived=clone(duty);archived.archived=true;archived.archive={id:'trash-d1',at:'2026-10-09T07:00:00.000Z'};
 const next=applyChanges(original,[{kind:'duty',id:'d1',base:duty,next:archived}]);assert.equal(next.records[2].data.dutyId,'d1');
 let view=toWorkspaceView(next,{});assert.equal(view.duties.length,0);assert.equal(view.flights[0].dutyId,'other-duty');assert.equal(view.flights[1].dutyId,null);assert.equal(view.trash[0].kind,'duty');
 view=toWorkspaceView(applyChanges(next,[{kind:'duty',id:'d1',base:archived,next:duty}]),{});assert.equal(view.flights[0].dutyId,'other-duty');assert.equal(view.flights[1].dutyId,'d1');assert.equal(view.trash.length,0);
});
test('new account projection never copies demo and keeps notification grants local',()=>{
 const snap=emptySnapshot('alice');assert.equal(snap.cloudRevision,0);assert.deepEqual(snap.records,[]);
 const view=toWorkspaceView(snap,{notifications:true});assert.equal(view.demo,false);assert.equal(view.flights.length,0);assert.equal(view.settings.notifications,true);assert.equal(view.settings.base,'SGN');
 assert.equal(toWorkspaceView(snap,{}).settings.notifications,false);
});
test('invalid domain data, identity fields and oversized metadata are rejected',()=>{
 for(const patch of [{date:'2026-02-30'},{actual:{out:'2026-10-09T06:00:00Z',in:'2026-10-09T05:00:00Z'}},{picMinutes:71},{nightMinutes:71},{captainId:'p1',foId:'p1'},{note:'x'.repeat(128*1024)},{attachment:'data:image/png;base64,abc'}])assert.throws(()=>validateRecord(flightRecord({data:patch})),undefined,JSON.stringify(Object.keys(patch)));
 assert.throws(()=>validateRecord({...personRecord(),kind:'any-path'}));assert.throws(()=>validateRecord(flightRecord({data:{id:'other'}})));
 assert.equal(validateRecord(flightRecord()).data.actual.in,'2026-10-09T05:10:00.000Z');
});
test('operations reject 9 records, oversized bytes and modified owner fields',()=>{
 const changes=Array.from({length:9},(_,i)=>({kind:'person',id:'p'+i,base:null,next:personRecord('p'+i)}));
 assert.throws(()=>validateOperation(operation(changes)));assert.doesNotThrow(()=>validateOperation(operation(changes.slice(0,8))));
 assert.throws(()=>validateOperation({...operation(changes.slice(0,1)),uid:''}));
 const large=Array.from({length:8},(_,i)=>{const f=flightRecord({id:'big'+i,data:{id:'big'+i,weather:{day:'2026-10-09',reports:['VVTS','VVNB'].map(station=>({station,provider:'NOAA',fetchedAt:'2026-10-09T04:00:00.000Z',source:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,metar:'M'.repeat(30000),taf:'T'.repeat(20000)}))}}});assert.doesNotThrow(()=>validateRecord(f));return {kind:'flight',id:f.id,base:f,next:f};});assert.throws(()=>validateOperation(operation(large)),/800 KiB/);
});
test('unsafe domain IDs are hashed rather than interpreted as path segments',async()=>{
 const key=await recordKey('person','a/b');assert.match(key,/^[a-f0-9]{64}$/);assert.notEqual(key,await recordKey('person','ab'));assert.notEqual(key,await recordKey('duty','a/b'));
});
test('causal dependencies are not capped by the eight-record write batch size',()=>{
 const person=personRecord();assert.doesNotThrow(()=>validateOperation({...operation([{kind:'person',id:'p1',base:null,next:person}]),parents:Array.from({length:9},(_,i)=>'parent-'+i)}));
});
test('weather text is its own group and never accepts image bytes or unrelated airports',()=>{
 const data={day:'2026-10-09',reports:[{station:'VVTS',provider:'NOAA Aviation Weather Center',fetchedAt:'2026-10-09T04:00:00.000Z',source:'https://aviationweather.gov/api/data/metar?ids=VVTS&format=raw',metar:'VVTS 090400Z 00000KT CAVOK 30/24 Q1010',taf:null}]};
 const base=flightRecord(),local=flightRecord({data:{weather:data}}),remote=flightRecord({data:{note:'other change'}});assert.equal(mergeRecord({base,local,remote}).record.data.weather.reports[0].metar,data.reports[0].metar);
 assert.throws(()=>validateRecord(flightRecord({data:{weather:{...data,reports:[{...data.reports[0],metar:'data:image/png;base64,abcd'}]}}})));
 assert.throws(()=>validateRecord(flightRecord({data:{weather:{...data,reports:[{...data.reports[0],station:'VTBS'}]}}})),/sân bay/);
});
