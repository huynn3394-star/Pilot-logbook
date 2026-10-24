import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as capability from '../public/workspace/capabilities.js';
const record=data=>({kind:'flight',id:'f',data:{id:'f',...data}});
test('disabled cloud V14 blocks extended guest/backup import before staging',()=>{
 assert.equal(typeof capability.assertImportCapability,'function');
 const next=record({logbook:{version:1}});
 assert.throws(()=>capability.assertImportCapability({changes:[{next}]},{uid:'pilot',enabled:false}),/V14/);
 assert.throws(()=>capability.assertImportCapability({parts:[{changes:[{next:record({auditTrail:{version:1,entries:[]}})}]}]},{uid:'pilot',enabled:false}),/V14/);
 assert.throws(()=>capability.assertImportCapability({resumeRecords:[{record:next}]},{uid:'pilot',enabled:false}),/V14/);
});
test('legacy imports and explicit V14 activation remain usable without stripping metadata',()=>{
 assert.equal(typeof capability.assertImportCapability,'function');
 assert.doesNotThrow(()=>capability.assertImportCapability({changes:[{next:record({})}]},{uid:'pilot',enabled:false}));
 const p={changes:[{next:record({logbook:{version:1,sicMinutes:0}})}]};const before=JSON.stringify(p);
 assert.doesNotThrow(()=>capability.assertImportCapability(p,{uid:'pilot',enabled:true}));
 assert.doesNotThrow(()=>capability.assertImportCapability(p,{uid:null,enabled:false}));
 assert.equal(JSON.stringify(p),before);
});
