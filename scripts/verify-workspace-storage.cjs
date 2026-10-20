/* Real IndexedDB + native Web Locks; only external network is a local static fixture server. */
const {chromium,webkit}=require('playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Workspace storage QA</title>');}if(u.pathname==='/atpl/firebase-config.json'){res.setHeader('Content-Type','application/json');return res.end('{"enabled":false}');}const file=path.resolve(root,u.pathname.startsWith('/tests/')?'.'+u.pathname:'public'+u.pathname);if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type','application/javascript');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const [name,type]of Object.entries({chromium,webkit}).filter(([name])=>!process.env.WORKSPACE_QA_BROWSER||process.env.WORKSPACE_QA_BROWSER===name)){
  const browser=await type.launch({headless:true}),context=await browser.newContext();const deadline=setTimeout(()=>browser.close(),30000);
  try{
   const a=await context.newPage(),b=await context.newPage();a.on('console',message=>console.log(name+': '+message.text()));await Promise.all([a.goto(origin),b.goto(origin)]);
   async function init(page,uid='alice',locks=true){return page.evaluate(async({uid,locks})=>{
    globalThis.selectedUID=uid;globalThis.generation=(globalThis.generation||0)+1;globalThis.token={uid,generation};
    globalThis.repoModule=await import('/workspace/repository.js');globalThis.fixtures=await import('/tests/fixtures/workspace.js');globalThis.schema=await import('/workspace/schema.js');
    globalThis.repo=await repoModule.openWorkspace({uid,token,isCurrent:t=>t.uid===selectedUID&&t.generation===generation,locks:locks?navigator.locks:null});return repo.writable;
   },{uid,locks});}
   assert.equal(await init(a),true);assert.equal(await init(b),false);console.log(name+': lock acquired');
   const abort=await a.evaluate(async()=>{
    globalThis.blob=new Blob(['qa-bytes'],{type:'image/png'});globalThis.ref={sha256:await schema.sha256(await blob.arrayBuffer()),mime:blob.type,bytes:blob.size,cloudReady:false};
    const real=IDBObjectStore.prototype.put;let blobPuts=0,failed=false;
    IDBObjectStore.prototype.put=function(...args){if(this.name==='blobs')blobPuts++;if(this.name==='workspaces')throw new DOMException('quota injection','QuotaExceededError');return real.apply(this,args);};
    try{await repo.save({changes:[{kind:'flight',id:'f1',base:null,next:fixtures.flightRecord({revision:0,evidence:ref})}],blobs:[{ref,blob}],transfers:[{id:'upload-one',hash:ref.sha256,direction:'upload',state:'pending'}],token});}catch{failed=true;}finally{IDBObjectStore.prototype.put=real;}
    return {failed,blobPuts,snapshot:await repo.read(),pending:await repo.pending(),blob:await repo.getBlob(ref.sha256,token),transfers:await repo.transfers()};
   });
   assert.equal(abort.failed,true);assert.ok(abort.blobPuts>0);assert.equal(abort.snapshot.localVersion,0);assert.deepEqual(abort.pending,[]);assert.equal(abort.blob,null);assert.deepEqual(abort.transfers,[]);console.log(name+': abort checked');
   await a.evaluate(async()=>{
    await repo.save({changes:[{kind:'flight',id:'f1',base:null,next:fixtures.flightRecord({revision:0,evidence:ref})}],blobs:[{ref,blob}],transfers:[{id:'upload-one',hash:ref.sha256,direction:'upload',state:'pending'}],token});
    globalThis.sent=(await repo.pending())[0];const current=(await repo.read()).records[0];
    await repo.save({changes:[{kind:'flight',id:'f1',base:current,next:{...current,data:{...current.data,note:'after-send'}}}],token});
    globalThis.ack={uid:'alice',operationId:sent.operationId,operationHash:await schema.sha256(schema.canonical(sent)),priorRevision:0,revision:1,results:[{kind:'flight',id:'f1',status:'accepted',record:{...sent.changes[0].next,revision:1}}]};
   });
   const failedAck=await a.evaluate(async()=>{
    const before=(await repo.pending()).map(x=>x.operationId),real=IDBObjectStore.prototype.put;let failed=false;
    IDBObjectStore.prototype.put=function(...args){if(this.name==='workspaces')throw new DOMException('quota acknowledgement','QuotaExceededError');return real.apply(this,args);};
    try{await repo.acceptAck(ack,token);}catch{failed=true;}finally{IDBObjectStore.prototype.put=real;}
    return {failed,before,after:(await repo.pending()).map(x=>x.operationId)};
   });assert.equal(failedAck.failed,true);assert.deepEqual(failedAck.after,failedAck.before);
   const accepted=await a.evaluate(async()=>{await repo.acceptAck(ack,token);const state=await repo.read();return {state,pending:await repo.pending(),blobText:await(await repo.getBlob(ref.sha256,token)).text()};});
   assert.equal(accepted.state.records[0].data.note,'after-send');assert.equal(accepted.state.cloudRevision,1);assert.equal(accepted.pending.length,1);assert.equal(accepted.pending[0].changes[0].next.data.note,'after-send');assert.equal(accepted.blobText,'qa-bytes');console.log(name+': ack tail checked');
   // Read-only export pins no domain writer; guest original remains independent.
   const capture=await b.evaluate(async()=>{const before=await repo.read(),copy=await repo.exportCapture(token);await repo.unpinBlobs(copy.pinId,token);return {before,after:await repo.read(),snapshot:copy.snapshot,blobs:copy.evidenceRefs.length};});
   assert.deepEqual(capture.before,capture.after);assert.equal(capture.snapshot.records[0].data.note,'after-send');assert.equal(capture.blobs,1);
   await b.evaluate(async()=>{repo.release();});assert.equal(await init(b,'bob'),true);assert.equal(await b.evaluate(async()=>(await repo.read()).records.length),0);
   assert.equal(await b.evaluate(async()=>{let denied=false;try{await repo.getBlob('a'.repeat(64),{uid:'alice',generation});}catch{denied=true;}return denied;}),true);console.log(name+': export and Bob isolation checked');
   // During asynchronous byte preparation the account changes; no result may persist.
   const changed=await b.evaluate(async()=>{
    const candidate=new Blob(['delayed'],{type:'image/png'}),real=candidate.arrayBuffer.bind(candidate);let resume;
    candidate.arrayBuffer=()=>new Promise(resolve=>{resume=async()=>resolve(await real());});
    const ref={sha256:await schema.sha256(await real()),mime:'image/png',bytes:7,cloudReady:false};
    const save=repo.save({changes:[{kind:'flight',id:'f1',base:null,next:fixtures.flightRecord({revision:0,evidence:ref})}],blobs:[{ref,blob:candidate}],token});
    for(let i=0;!resume&&i<100;i++)await new Promise(resolve=>setTimeout(resolve,1));if(!resume)throw Error('Byte preparation not reached');generation++;selectedUID='carol';await resume();let failed=false;try{await save;}catch{failed=true;}return failed;
   });assert.equal(changed,true);
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'bob'),true);assert.equal(await b.evaluate(async()=>(await repo.read()).records.length),0);
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'alice',false),false);assert.equal(await b.evaluate(async()=>(await repo.read()).records[0].data.note),'after-send');await b.evaluate(()=>repo.release());
   await a.close();await b.waitForFunction(async()=>!(await navigator.locks.query()).held.some(x=>x.name==='avilog-workspace-v1:alice'));assert.equal(await init(b,'alice'),true);await b.reload();await b.waitForFunction(async()=>!(await navigator.locks.query()).held.some(x=>x.name==='avilog-workspace-v1:alice'));assert.equal(await init(b,'alice'),true);assert.equal(await b.evaluate(async()=>(await repo.read()).records[0].data.note),'after-send');
   // Captured owner token becomes invalid before a plain operation: no save.
   assert.equal(await b.evaluate(async()=>{const old=token;generation++;try{await repo.save({changes:[{kind:'person',id:'p1',base:null,next:fixtures.personRecord()}],token:old});return false;}catch{return true;}}),true);
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'alice'),true);
   // Record saves/exports must not depend on reading every unrelated full image body.
   const bounded=await b.evaluate(async()=>{
    const getAll=IDBIndex.prototype.getAll;let forbidRecoveryRead=true;IDBIndex.prototype.getAll=function(...args){if(this.objectStore.name==='blobs'||(this.objectStore.name==='recoveries'&&forbidRecoveryRead))throw new DOMException('bulk binary/recovery data unavailable','UnknownError');return getAll.apply(this,args);};
    try{await repo.save({changes:[{kind:'person',id:'p2',base:null,next:fixtures.personRecord('p2')}],token});await repo.saveRecovery({draft:{note:'keep'}},token);forbidRecoveryRead=false;const capture=await repo.exportCapture(token);await repo.unpinBlobs(capture.pinId,token);const hash=await schema.sha256(new TextEncoder().encode('qa-bytes'));return await(await repo.getBlob(hash,token)).text();}finally{IDBIndex.prototype.getAll=getAll;}
   });assert.equal(bounded,'qa-bytes');await b.evaluate(()=>repo.release());assert.equal(await init(b,'dave'),true);
   const resolution=await b.evaluate(async()=>{
    const person=fixtures.personRecord();person.revision=0;await repo.save({changes:[{kind:'person',id:'p1',base:null,next:person}],token});
    const remote={...person,revision:1,data:{...person.data,name:'Remote QA'}};await repo.acceptRemote({schemaVersion:1,uid:'dave',cloudRevision:1,localVersion:0,records:[remote]},token);
    const conflict=(await repo.conflicts())[0];await repo.resolveConflict({conflictId:conflict.id,changes:[{kind:'person',id:'p1',base:remote,next:{...remote,data:{...remote.data,name:'Resolved QA'}}}]},token);
    return {count:(await repo.pending()).length,name:(await repo.read()).records[0].data.name,conflicts:(await repo.conflicts()).length};
   });assert.deepEqual(resolution,{count:1,name:'Resolved QA',conflicts:0});await b.evaluate(()=>repo.release());assert.equal(await init(b,'x'.repeat(128)),true);
   await b.evaluate(async()=>repo.save({changes:[{kind:'person',id:'p1',base:null,next:fixtures.personRecord()}],token}));assert.equal(await b.evaluate(async()=>(await repo.pending()).length),1);
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'cleanup'),true);
   const cleaned=await b.evaluate(async()=>{
    const blob=new Blob(['cleanup-bytes'],{type:'image/png'}),ref={sha256:await schema.sha256(await blob.arrayBuffer()),mime:'image/png',bytes:13,cloudReady:true};
    await repo.save({changes:[{kind:'flight',id:'f1',base:null,next:fixtures.flightRecord({revision:0,evidence:ref})}],blobs:[{ref,blob}],token});const op=(await repo.pending())[0];
    await repo.acceptAck({uid:'cleanup',operationId:op.operationId,operationHash:await schema.sha256(schema.canonical(op)),priorRevision:0,revision:1,results:[{kind:'flight',id:'f1',status:'accepted',record:{...op.changes[0].next,revision:1}}]},token);
    await repo.saveRecovery({draft:{note:'unsubmitted'},source:undefined},token);const pin=await repo.exportCapture(token);const held=await repo.releaseBlob(ref.sha256,token);await repo.unpinBlobs(pin.pinId,token);
    return {held,released:await repo.releaseBlob(ref.sha256,token),missing:await repo.getBlob(ref.sha256,token)===null};
   });assert.deepEqual(cleaned,{held:false,released:true,missing:true});
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'backup-conflict-photos'),true);
   const conflictPhotos=await b.evaluate(async()=>{
    const {prepareEvidence}=await import('/workspace/evidence.js'),{captureBackup,exportBackupParts,previewRestore}=await import('/workspace/backup.js');
    const images=[];for(const color of ['red','green','blue']){const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,2,2);images.push(await prepareEvidence(await new Promise(r=>canvas.toBlob(r,'image/png'))));}
    const [original,local,remote]=images;for(const image of images)await repo.putBlob(image.ref,image.blob,token);
    const base=fixtures.flightRecord({revision:1,evidence:original.ref});await repo.acceptRemote({schemaVersion:1,uid:token.uid,cloudRevision:1,localVersion:0,records:[base]},token);
    await repo.save({changes:[{kind:'flight',id:'f1',base,next:{...base,evidence:local.ref}}],token});const op=(await repo.pending())[0],other={...base,revision:2,evidence:remote.ref};
    await repo.acceptRemote({schemaVersion:1,uid:token.uid,cloudRevision:2,localVersion:0,records:[other]},token);const conflict=(await repo.conflicts())[0];
    await repo.acceptAck({uid:token.uid,operationId:op.operationId,operationHash:await schema.sha256(schema.canonical(op)),priorRevision:2,revision:3,results:[{kind:'flight',id:'f1',status:'conflict',conflict}]},token);
    if((await repo.pending()).length)throw Error('Fixture must acknowledge and remove its pending operation');
    async function capture(){const c=await captureBackup({repository:repo,token});const parts=[];try{for await(const p of exportBackupParts({capture:c,loadBlob:h=>repo.getBlob(h,token)}))parts.push(p);return {capture:c,parts};}finally{await repo.unpinBlobs(c.pinId,token);}}
    const first=await capture(),wanted=images.map(i=>i.ref.sha256).sort(),actual=first.capture.evidenceRefs.map(r=>r.sha256).sort();
    if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Error('Full backup omitted a conflicted original: expected '+wanted.length+' refs, received '+actual.length);
    const preview=await previewRestore({parts:first.parts.map(p=>new File([p.jsonText],p.filename)),targetUID:'new-device',current:{schemaVersion:1,uid:'new-device',cloudRevision:0,localVersion:0,records:[]}});
    const emitted=first.parts.flatMap(p=>JSON.parse(p.jsonText).payload.entries).filter(e=>e.type==='image'&&e.dataURL);if(!preview.complete||emitted.length!==3)throw Error('All conflicted originals must survive validated backup bytes');
    await repo.resolveConflict({conflictId:conflict.id,changes:[{kind:'flight',id:'f1',base:other,next:other}]},token);
    const resolved=await capture();if(JSON.stringify(resolved.capture.evidenceRefs.map(r=>r.sha256).sort())!==JSON.stringify(wanted))throw Error('Resolved-conflict recovery photo omitted');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('avilog-workspaces-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete([token.uid,local.ref.sha256]);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
    let rejected=false;try{await capture();}catch{rejected=true;}if(!rejected)throw Error('A missing conflicted original must reject full export');
    const missing=await captureBackup({repository:repo,token}),partial=[];try{for await(const p of exportBackupParts({capture:missing,loadBlob:h=>repo.getBlob(h,token),allowMissing:true}))partial.push(JSON.parse(p.jsonText));}finally{await repo.unpinBlobs(missing.pinId,token);}
    return {images:emitted.length,missingExplicit:partial.every(p=>!p.manifest.complete&&p.manifest.missingImages.some(i=>i.hash===local.ref.sha256))};
   });assert.deepEqual(conflictPhotos,{images:3,missingExplicit:true});console.log(name+': acknowledged/resolved evidence conflicts retain every original in backup; missing recovery bytes reject full export');
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'multipart-resume'),true);
   const savedParts=await b.evaluate(async()=>{
    const {prepareEvidence}=await import('/workspace/evidence.js'),{exportBackupParts,previewRestore,stageRestore}=await import('/workspace/backup.js');const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const raw=await new Promise(r=>canvas.toBlob(r,'image/png')),image=await prepareEvidence(new Blob([raw,new Uint8Array(800)],{type:'image/png'}));
    const record=fixtures.flightRecord({evidence:image.ref}),capture={uid:'source',backupSetId:crypto.randomUUID(),snapshot:{schemaVersion:1,uid:'source',cloudRevision:1,localVersion:1,records:[record]},operations:[],conflicts:[],recoveries:[],transfers:[],evidenceRefs:[image.ref]},parts=[];for await(const p of exportBackupParts({capture,loadBlob:async()=>image.blob,maxBytes:2400}))parts.push(p.jsonText);
    const metadata=parts.filter(p=>JSON.parse(p).payload.entries.some(e=>e.type==='record')),preview=await previewRestore({parts:metadata.map((p,i)=>new File([p],'metadata-'+i)),targetUID:token.uid,current:await repo.read(),loadRestoreProgress:id=>repo.getRestoreProgress(id,token)});
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='recoveries'&&value.type==='restore-progress')throw new DOMException('Synthetic restore-progress quota','QuotaExceededError');return put.call(this,value,...rest);};let failed=false;try{await stageRestore({repository:repo,preview,confirm:async()=>true,token});}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
    if(!failed||(await repo.pending()).length||(await repo.read()).records.length||await repo.getRestoreProgress(preview.restoreIdentity,token))throw Error('Progress quota must roll back staged metadata atomically');
    await stageRestore({repository:repo,preview,confirm:async()=>true,token});return{parts,ids:(await repo.pending()).map(o=>o.operationId),hash:image.ref.sha256};
   });await b.evaluate(()=>repo.release());await b.reload();await b.waitForFunction(async()=>!(await navigator.locks.query()).held.some(l=>l.name==='avilog-workspace-v1:multipart-resume'));assert.equal(await init(b,'multipart-resume'),true);
   const continued=await b.evaluate(async saved=>{
    const {previewRestore,stageRestore}=await import('/workspace/backup.js'),imageParts=saved.parts.filter(p=>JSON.parse(p).payload.entries.every(e=>e.type!=='record'));
    const options=async()=>({targetUID:token.uid,current:await repo.read(),loadRestoreProgress:id=>repo.getRestoreProgress(id,token)}),preview=await previewRestore({parts:imageParts.map((p,i)=>new File([p],'image-'+i)),...await options()});
    if(!preview.images.length||!preview.resumeRecords.length||!preview.complete)throw Error('Reloaded image-only continuation must recognize durable metadata progress');
    await stageRestore({repository:repo,preview,confirm:async()=>true,token});const bytes=await repo.getBlob(saved.hash,token);if(!bytes||await schema.sha256(await bytes.arrayBuffer())!==saved.hash)throw Error('Continuation image bytes mismatch');
    const all=await previewRestore({parts:saved.parts.map((p,i)=>new File([p],'all-'+i)),...await options()});await stageRestore({repository:repo,preview:all,confirm:async()=>true,token});return{ids:(await repo.pending()).map(o=>o.operationId),complete:all.complete};
   },savedParts);assert.deepEqual(continued,{ids:savedParts.ids,complete:true});console.log(name+': offline multipart continuation survives reload, atomic progress quota and complete-set retry without new operation IDs');
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'gap-ack'),true);
   const gap=await b.evaluate(async()=>{
    const person=fixtures.personRecord();person.revision=0;await repo.save({changes:[{kind:'person',id:'p1',base:null,next:person}],token});const op=(await repo.pending())[0];
    const accepted={...person,revision:1},newer={...accepted,revision:2,data:{...accepted.data,name:'Later cloud edit'}};
    await repo.acceptRemote({schemaVersion:1,uid:'gap-ack',cloudRevision:2,localVersion:0,records:[newer]},token);const predicted=(await repo.conflicts()).length;
    await repo.acceptAck({uid:'gap-ack',operationId:op.operationId,operationHash:await schema.sha256(schema.canonical(op)),priorRevision:0,revision:1,results:[{kind:'person',id:'p1',status:'accepted',record:accepted}]},token);
    return{predicted,conflicts:(await repo.conflicts()).length,pending:(await repo.pending()).length,name:(await repo.read()).records[0].data.name};
   });assert.deepEqual(gap,{predicted:1,conflicts:0,pending:0,name:'Later cloud edit'});
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'mixed-causal'),true);
   const mixed=await b.evaluate(async()=>{
    const first=fixtures.personRecord('p1'),second=fixtures.personRecord('p2');first.revision=second.revision=0;
    await repo.save({changes:[{kind:'person',id:'p1',base:null,next:first},{kind:'person',id:'p2',base:null,next:second}],token});
    await repo.save({changes:[{kind:'person',id:'p1',base:first,next:{...first,data:{...first.data,name:'Local tail one'}}},{kind:'person',id:'p2',base:second,next:{...second,data:{...second.data,name:'Local tail two'}}}],token});
    await repo.acceptRemote({schemaVersion:1,uid:'mixed-causal',cloudRevision:1,localVersion:0,records:[{...first,revision:1,data:{...first.data,name:'Other device'}}]},token);
    return(await repo.read()).records.find(r=>r.id==='p2').data.name;
   });assert.equal(mixed,'Local tail two');
   const shared=await b.evaluate(async()=>{
    localStorage.setItem('atpl_active_account_v1',JSON.stringify({uid:'alice',displayName:'QA',email:'alice@example.test'}));
    const real=fetch;let requests=0;globalThis.fetch=(...args)=>{if(args[0]==='/atpl/firebase-config.json')requests++;return real(...args);};
    try{const main=await import('/account/client.js'),legacy=await import('/atpl/account.js');const first=main.getAccountClient(),second=legacy.getAccountClient(),account=await first;await account.ready;let denied=false;try{await account.validateSession();}catch{denied=true;}return {samePromise:first===second,requests,user:account.currentUser(),status:account.status,denied,workspace:account.config.workspaceSyncEnabled,evidence:account.config.evidenceSyncEnabled};}finally{globalThis.fetch=real;}
   });assert.deepEqual(shared,{samePromise:true,requests:1,user:null,status:'disabled',denied:true,workspace:false,evidence:false});
   await b.evaluate(()=>repo.release());assert.equal(await init(b,'migration-qa'),true);
   const migration=await b.evaluate(async()=>{
    const {previewMigration,stageMigration}=await import('/workspace/migration.js');const source={version:1,flights:[fixtures.flightRecord().data],people:[],duties:[],settings:{name:'Migration QA',base:'SGN'},demo:false};
    const guest=await import('/lib/storage.js');await guest.writeState(source);const original=JSON.stringify(await guest.readState()),preview=await previewMigration({source,sourceText:original,current:await repo.read()});
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='recoveries')throw new DOMException('recovery quota','QuotaExceededError');return put.apply(this,args);};let failed=false;try{await stageMigration({repository:repo,preview,confirm:async()=>true,token});}catch{failed=true;}finally{IDBObjectStore.prototype.put=put;}
    const before=(await repo.pending()).length;await stageMigration({repository:repo,preview,confirm:async()=>true,token});const capture=await repo.exportCapture(token);await repo.unpinBlobs(capture.pinId,token);
    return{failed,before,after:(await repo.pending()).length,guestUnchanged:JSON.stringify(await guest.readState())===original,raw:capture.recoveries.some(r=>r.sourceText===original)};
   });assert.deepEqual(migration,{failed:true,before:0,after:1,guestUnchanged:true,raw:true});
   const imageValidation=await b.evaluate(async base64=>{
    const {prepareEvidence}=await import('/workspace/evidence.js'),data=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),blob=new Blob([data],{type:'image/png'}),prepared=await prepareEvidence(blob),big=new Blob([data,new Uint8Array(6*1024*1024-data.length)],{type:'image/png'});
    const boundary=await prepareEvidence(big);let denied=0;for(const bad of[new Blob([data],{type:'image/jpeg'}),new Blob([data.slice(0,20)],{type:'image/png'}),new Blob(['<svg/>'],{type:'image/png'})])try{await prepareEvidence(bad);}catch{denied++;}
    return{denied,bytes:prepared.ref.bytes,unchanged:await schema.sha256(await blob.arrayBuffer())===prepared.ref.sha256,boundary:boundary.ref.bytes};
   },'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');assert.equal(imageValidation.denied,3);assert.equal(imageValidation.unchanged,true);assert.equal(imageValidation.boundary,6*1024*1024);
   await b.evaluate(()=>repo.release());console.log(name+': atomic abort, ack tail/retry, Blob reload, UID guards, readonly export, bounded image reads, shared client and conflict recovery passed');
  }finally{clearTimeout(deadline);await context.close();await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
