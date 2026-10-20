// Real main UI/Session/IDB/controllers; only external provider boundary is synthetic.
const assert=require('node:assert/strict');
module.exports=async({browser,origin,name})=>{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await context.route('**/atpl/firebase-config.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,workspaceSyncEnabled:true,evidenceSyncEnabled:true})}));
 await context.route('**/atpl/vendor/firebase-client.js',r=>r.fulfill({contentType:'application/javascript',body:`import {canonical,sha256} from '/workspace/schema.js'; import {applyChanges,emptySnapshot} from '/workspace/model.js';
 export function createAccountClient({config}){const user={uid:'background-qa',email:'synthetic@example.test'};let remote=emptySnapshot(user.uid);const Q=globalThis.backgroundQA={commits:[],uploadHeld:false,weatherHeld:0};
 return{config,status:'authenticated',ready:Promise.resolve(user),currentUser:()=>user,validateSession:async()=>user.uid,subscribe(fn){fn({user,status:'authenticated'});return()=>{};},workspaceTransport(){return{pull:async()=>structuredClone(remote),subscribe:()=>()=>{},close(){},commit:async op=>{remote=applyChanges(remote,op.changes.map(c=>({...c,next:{...c.next,revision:remote.cloudRevision+1}})));const priorRevision=remote.cloudRevision;remote.cloudRevision++;Q.commits.push(structuredClone(remote));return{uid:user.uid,operationId:op.operationId,operationHash:await sha256(canonical(op)),priorRevision,revision:remote.cloudRevision,results:op.changes.map(c=>({kind:c.kind,id:c.id,status:'accepted',record:remote.records.find(r=>r.kind===c.kind&&r.id===c.id)}))};}};},evidenceTransport(){return{close(){},upload:async()=>{Q.uploadHeld=true;await new Promise(resolve=>Q.releaseUpload=resolve);},download:async()=>{throw Error('Not this fixture');}};}};}` }));
 let releaseWeather;const weatherGate=new Promise(resolve=>releaseWeather=resolve);let weatherRequests=0;
 await context.route('**/api/weather?*',async route=>{weatherRequests++;await weatherGate;const station=new URL(route.request().url()).searchParams.get('station');await route.fulfill({contentType:'application/json',body:JSON.stringify({station,provider:'NOAA Aviation Weather Center',fetchedAt:new Date().toISOString(),metar:station+' SYNTHETIC',taf:null})});});
 await page.goto(origin+'/atpl/privacy.html');await page.evaluate(async()=>{
  const uid='background-qa';localStorage.setItem('atpl_active_account_v1',JSON.stringify({uid,email:'synthetic@example.test'}));
  const {openWorkspace}=await import('/workspace/repository.js'),{prepareEvidence}=await import('/workspace/evidence.js');const token={uid,generation:1},repo=await openWorkspace({uid,token,isCurrent:()=>true});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const prepared=await prepareEvidence(await new Promise(r=>canvas.toBlob(r,'image/png'))),today=new Date().toISOString().slice(0,10);
  const flight={schemaVersion:1,kind:'flight',id:'background-flight',revision:0,archived:false,evidence:prepared.ref,data:{id:'background-flight',date:today,flightNo:'VN987',dep:'SGN',dest:'HAN',scheduled:{out:today+'T01:00:00.000Z',in:today+'T03:00:00.000Z'},actual:{},confirmed:false,note:''}};
  await repo.save({changes:[{kind:'flight',id:flight.id,base:null,next:flight}],blobs:[prepared],token});repo.release();
 });
 await page.goto(origin);await page.waitForFunction(()=>globalThis.backgroundQA?.uploadHeld&&globalThis.backgroundQA.commits.length===1);await page.locator('[data-workspace-account]').filter({hasText:'Đã đồng bộ logbook'}).waitFor();assert.ok(weatherRequests>0);
 await page.evaluate(()=>{backgroundQA.statusHistory=[];new MutationObserver(()=>backgroundQA.statusHistory.push(document.querySelector('[data-workspace-account]')?.textContent||'')).observe(document.body,{subtree:true,childList:true});backgroundQA.releaseUpload();});
 await page.waitForFunction(()=>backgroundQA.commits.some(s=>s.records.some(r=>r.evidence?.cloudReady)),null,{timeout:9000});
 await page.waitForFunction(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('avilog-workspaces-v1',1);q.onsuccess=()=>r(q.result);});return new Promise(resolve=>{const q=db.transaction('outbox').objectStore('outbox').index('byUID').getAll('background-qa');q.onsuccess=()=>{resolve(q.result.length===0);db.close();};});});
 assert.equal(await page.evaluate(()=>backgroundQA.statusHistory.some(t=>t.includes('Đang chờ đồng bộ'))),true,'A local background write must invalidate the old synced label');releaseWeather();await page.waitForFunction(()=>backgroundQA.commits.some(s=>s.records.some(r=>r.data.weather?.reports.length===2)),null,{timeout:9000});
 assert.deepEqual(errors,[]);console.log(name+': background original-image completion and delayed weather automatically commit metadata without focus/manual sync');
 }finally{await context.close();}
};
