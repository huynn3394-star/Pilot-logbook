import {test} from 'node:test';import assert from 'node:assert/strict';
import {previewImport,mergeLegacy,importHash} from '../public/atpl/sync/import.js';
import {prepareBatch,acknowledge} from '../public/atpl/sync/model.js';
import {identity,empty,counted,envelope,report} from './fixtures/atpl-account.js';
// Break: legacy aggregates are added together as if their attempts were independent.
test('legacy merge takes conservative maxima, unions reports/bookmarks and preserves the account session',()=>{
 const exam={ids:[1],qid:1,answers:{},submitted:false,startedAt:100};
 const account={...counted(5,4),bookmarks:[1],exam,examHistory:[report()]},guest={...counted(8,3),bookmarks:[2],examHistory:[report(),report(2000)]};
 const source=structuredClone(guest),merged=mergeLegacy(account,guest,identity);
 assert.equal(merged.progress[1].attempts,8);assert.equal(merged.progress[1].correct,4);assert.deepEqual(merged.bookmarks,[1,2]);assert.equal(merged.examHistory.length,2);assert.deepEqual(merged.exam,exam);assert.deepEqual(guest,source);
 assert.equal(previewImport(account,guest,identity).guestDone,1);assert.equal(previewImport(account,guest,identity).counterPolicy,'maxima');
});
test('same legacy state has one identity regardless of object order or export timestamp',async()=>{
 const s=counted(),wrapped={format:'atpl-mb-backup',exportedAt:'later',state:s};
 assert.equal(await importHash('MB',s),await importHash('MB',wrapped));
 assert.notEqual(await importHash('MB',s),await importHash('MBR',s));
});
test('legacy uplift is not counted again as new offline attempts during batch preparation',()=>{
 const base=counted(3,2),guest=counted(5,3);
 const e=envelope(base);e.pendingImports=[{id:'import-one',state:guest}];e.state=counted(6,4);
 const batch=prepareBatch(e,{batchId:'b',deviceId:'phone'}).inflight.batch;
 assert.equal(batch.delta.progress[1].attempts,1);assert.equal(batch.delta.progress[1].correct,1);assert.equal(batch.importIds[0],'import-one');
});
test('an import made while a batch is in flight remains pending after its ack',()=>{
 let e=prepareBatch({...envelope(),state:counted(4,3)},{batchId:'b',deviceId:'phone'});
 e.pendingImports=[{id:'later-import',state:counted(8,6)}];e.state=counted(9,7);e.localVersion++;
 e=acknowledge(e,{uid:'alice',code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'b',cloudRevision:1,state:counted(4,3),importIds:[],reportIds:[]});
 assert.equal(e.state.progress[1].attempts,9);assert.equal(e.pendingImports.length,1);
 const next=prepareBatch(e,{batchId:'c',deviceId:'phone'}).inflight.batch;assert.equal(next.delta.progress[1].attempts,1);
});
test('a backup for another bank or previous bank identity cannot change account state',()=>{
 const original=counted(),before=structuredClone(original);
 for(const guest of [{subject:'MBR',state:counted()},{subject:'MB',bankSHA256:'b'.repeat(64),state:counted()},{...empty(),bookmarks:[999]}])assert.throws(()=>mergeLegacy(original,guest,identity));
 assert.deepEqual(original,before);
});
test('legacy import uses the wrong membership from the same snapshot as its chosen last answer',()=>{
 const account=counted(5,3,'A'),guest=counted(8,4,'B');const merged=mergeLegacy(account,guest,identity);assert.equal(merged.progress[1].lastSelected,'B');assert.deepEqual(merged.wrong,[]);
});
