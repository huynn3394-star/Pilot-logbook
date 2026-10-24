import {test} from 'node:test';import assert from 'node:assert/strict';
import {openWorkspaceSession} from '../public/workspace/session.js';
import {prepareEvidence} from '../public/workspace/evidence.js';
import {recordFlightRevision,evidenceFingerprint} from '../public/lib/flight-audit.js';
import {exportBackupParts,previewRestore,stageRestore} from '../public/workspace/backup.js';
import {snapshot,flightRecord,clone} from './fixtures/workspace.js';
import {applyChanges,mergeRecord} from '../public/workspace/model.js';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const opts={at:'2026-10-24T07:00:00Z',entryId:'first',reason:'Đối chiếu',replaceConfirmed:true};
function audited(){const r=flightRecord();r.data.logbook={version:1,sicMinutes:70,instrumentMinutes:50};r.data=recordFlightRevision(null,r.data,opts);return r;}
function adapters(uid,record){let state=snapshot([record]),guest={version:1,flights:[clone(record.data)],people:[],duties:[],settings:{},trash:[]};let generation=1;const writes=[];const token={uid,generation};
 const coordinator={capture:()=>token,isCurrent:t=>t.uid===uid&&t.generation===generation,getCachedSelection:()=>uid?{uid}:null,subscribe:()=>()=>{}};
 const repository={uid,writable:true,read:async()=>clone(state),devicePreferences:async()=>({}),release(){},save:async request=>{for(const c of request.changes||[]){const remote=state.records.find(r=>r.kind===c.kind&&r.id===c.id);const merged=mergeRecord({base:c.base,local:c.next,remote});assert.equal(merged.conflict,null);state=applyChanges(state,[{...c,next:merged.record}]);}writes.push(request);}};
 return{options:{coordinator,v14Enabled:()=>true,openRepository:async()=>repository,guestStorage:{readState:async()=>clone(guest),writeState:async next=>{guest=clone(next);writes.push(next);}}},writes,change(){generation++;}};
}
for(const uid of [null,'alice'])test('V14 '+(uid?'account':'guest')+' session preserves metadata/history and rejects removing an earlier revision',async()=>{
 const a=adapters(uid,audited()),session=await openWorkspaceSession(a.options);const capture=session.captureForm(),view=session.view();view.flights[0]=recordFlightRevision(view.flights[0],{...view.flights[0],note:'reviewed'},{...opts,entryId:'second'});
 await session.saveView({...capture,next:view});assert.equal(session.view().flights[0].auditTrail.entries.length,2);assert.equal(session.view().flights[0].logbook.sicMinutes,70);
 const broken=session.view();broken.flights[0].auditTrail.entries.shift();await assert.rejects(()=>session.saveView({...session.captureForm(),next:broken,confirmActualReplacement:true}),/lịch sử/);
 session.release();
});
for(const uid of [null,'alice'])test('V14 '+(uid?'account':'guest')+' rejects unlogged changes after reopening FINAL before writing',async()=>{
 const record=audited();record.data=recordFlightRevision(record.data,{...record.data,confirmed:false},{...opts,entryId:'reopened'});
 const a=adapters(uid,record),s=await openWorkspaceSession({...a.options,v14Enabled:()=>true}),next=s.view();next.flights[0].dep='BKK';
 await assert.rejects(()=>s.saveView({...s.captureForm(),next}),/lịch sử/i);assert.equal(a.writes.length,0);s.release();
});
test('flag-off account keeps V14 data readable but rejects edits and archive before writing',async()=>{
 const a=adapters('alice',audited()),s=await openWorkspaceSession({...a.options,v14Enabled:()=>false});
 assert.equal(s.view().flights[0].logbook.sicMinutes,70);
 const next=s.view();next.flights[0]=recordFlightRevision(next.flights[0],{...next.flights[0],note:'changed'},{...opts,entryId:'second'});
 await assert.rejects(()=>s.saveView({...s.captureForm(),next}),/V14/);
 await assert.rejects(()=>s.archive('flight','f1'),/V14/);assert.equal(a.writes.length,0);s.release();
});
test('stale account generation cannot store V14 time/audit data',async()=>{const a=adapters('alice',audited()),s=await openWorkspaceSession(a.options);const c=s.captureForm(),next=s.view();next.flights[0].note='late result';a.change();await assert.rejects(()=>s.saveView({...c,next}),/đổi|phiên/);assert.equal(a.writes.length,0);s.release();});
test('native WebCrypto fingerprints exact original image bytes',async()=>{
 // Independently calculated SHA-256 fixture, not derived by the production helper.
 const result=await evidenceFingerprint({attachment:'data:image/png;base64,'+PNG});
 assert.equal(result,'4ff6ab670a58c14270e034e2090d9a432caa263a14e0a25785386b0c12f880b5');
 assert.equal(await evidenceFingerprint({evidence:{sha256:result}}),result);
});
test('full V14 backup restores exact image bytes, metadata and history together',async()=>{
 const old=globalThis.createImageBitmap;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
 try{
  const blob=new Blob([Buffer.from(PNG,'base64')],{type:'image/png'}),prepared=await prepareEvidence(blob),record=audited();record.evidence=prepared.ref;
  const capture={uid:'alice',backupSetId:'qa-v14-images',snapshot:snapshot([record]),evidenceRefs:[prepared.ref],operations:[],conflicts:[],recoveries:[],transfers:[]};const parts=[];
  for await(const part of exportBackupParts({capture,loadBlob:async()=>blob})){const file=new Blob([part.jsonText],{type:'application/json'});file.name=part.filename;parts.push(file);}
  const preview=await previewRestore({parts,targetUID:'alice',current:snapshot([])});assert.equal(preview.complete,true);
  const writes=[],recoveries=[],repository={uid:'alice',pending:async()=>[],read:async()=>snapshot([]),saveRecovery:async r=>recoveries.push(r),save:async r=>writes.push(r)};
  await stageRestore({repository,preview,confirm:async()=>true,token:{uid:'alice'}});
  const saved=writes.flatMap(w=>w.changes||[]).find(c=>c.kind==='flight').next;assert.deepEqual(saved.data.logbook,record.data.logbook);assert.deepEqual(saved.data.auditTrail,record.data.auditTrail);
  const image=writes.flatMap(w=>w.blobs||[])[0];assert.deepEqual(Buffer.from(await image.blob.arrayBuffer()),Buffer.from(PNG,'base64'));assert.ok(recoveries.length>=1);
 }finally{globalThis.createImageBitmap=old;}
});
