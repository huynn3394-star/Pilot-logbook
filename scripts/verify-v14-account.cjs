/* Real bundled Firebase SDK + local Auth/Firestore emulators; synthetic accounts only. */
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium,webkit}=require('playwright');
const {accountMenu}=require('./ui-controls.cjs');
const root=path.resolve(__dirname,'..');
async function login(page,origin,email){
 await page.goto(origin);await page.locator('[data-workspace-account]').waitFor();await accountMenu(page);
 const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'Tiếp tục với Google',exact:true}).click();const popup=await popupEvent;await popup.waitForLoadState();
 await popup.getByRole('button',{name:'Add new account'}).click();await popup.locator('#email-input').fill(email);await popup.locator('#display-name-input').fill('V14 test pilot');await popup.getByRole('button',{name:'Sign in with Google.com',exact:true}).click();
 await page.locator('[data-workspace-account]').filter({hasText:email}).waitFor({timeout:20000});
 await page.waitForFunction(async()=>!(await import('/account/coordinator.js')).getCoordinator().getCachedSelection()?.loginPending);
 await page.goto(origin+'/atpl/privacy.html');
 await page.waitForFunction(async()=>!(await navigator.locks.query()).held.some(l=>l.name.startsWith('avilog-workspace-v1:')));
 await page.evaluate(async()=>{
  const account=await(await import('/account/client.js')).getAccountClient();await account.ready;
  const coordinator=(await import('/account/coordinator.js')).getCoordinator(),{openWorkspaceSession}=await import('/workspace/session.js');
  const Q=globalThis.Q={account,coordinator};Q.open=async enabled=>Q.session=await openWorkspaceSession({coordinator,v14Enabled:()=>enabled});await Q.open(account.config.logbookV14Enabled===true);
  const {createWorkspaceController}=await import('/workspace/controller.js');Q.controller=createWorkspaceController({account,repository:Q.session.repository,coordinator,online:()=>true,scheduler:{setTimeout:()=>0,clearTimeout(){},random:()=>.5}});
 });
}
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'server.js'))),{readFirebaseConfig}=await import(pathToFileURL(path.join(root,'lib/firebase-auth.js'))),{flightRecord}=await import(pathToFileURL(path.join(root,'tests/fixtures/workspace.js')));
 const config=readFirebaseConfig({ATPL_ACCOUNTS_ENABLED:'true',ATPL_APP_ORIGIN:'http://127.0.0.1:0',FIREBASE_PROJECT_ID:'demo-atpl-sync',FIREBASE_API_KEY:'demo-api-key',FIREBASE_APP_ID:'1:123:web:demo',ATPL_USE_EMULATORS:'true',AVILOG_WORKSPACE_SYNC_ENABLED:'true',AVILOG_EVIDENCE_SYNC_ENABLED:'true',AVILOG_LOGBOOK_V14_ENABLED:'true',FIREBASE_STORAGE_BUCKET:'demo-atpl-sync.firebasestorage.app'});
 const server=createServer({firebaseConfig:config});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;config.appOrigin=origin;config.authDomain=new URL(origin).host;
 try{for(const [name,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true}),a=await browser.newContext({serviceWorkers:'block'}),b=await browser.newContext({serviceWorkers:'block'}),pa=await a.newPage(),pb=await b.newPage();
  try{
   await login(pa,origin,name+'-v14@example.test');await login(pb,origin,name+'-v14@example.test');
   assert.equal(await pa.evaluate(()=>Q.account.config.logbookV14Enabled),true);
   await a.setOffline(true);
   await pa.evaluate(async f=>{const {recordFlightRevision}=await import('/lib/flight-audit.js'),capture=Q.session.captureForm(),next=Q.session.view();f.logbook={version:1,ifrMinutes:70,instrumentMinutes:30,landingDay:1};next.flights.push(recordFlightRevision(null,f,{entryId:'first',at:'2026-10-24T07:00:00Z'}));await Q.session.saveView({...capture,next});},flightRecord({revision:0}).data);
   assert.equal(await pa.evaluate(async()=>(await Q.session.repository.pending()).length),1);
   // Native IDB read after closing the session, with no provider access.
   await pa.evaluate(async()=>{Q.controller.stop();Q.session.release();await Q.open(true);});
   const offline=await pa.evaluate(()=>Q.session.view().flights[0]);assert.equal(offline.logbook.instrumentMinutes,30);assert.equal(offline.logbook.sicMinutes,undefined);assert.equal(offline.auditTrail.entries.length,1);
   await a.setOffline(false);
   await pa.evaluate(async()=>{const {createWorkspaceController}=await import('/workspace/controller.js');Q.controller=createWorkspaceController({account:Q.account,repository:Q.session.repository,coordinator:Q.coordinator,scheduler:{setTimeout:()=>0,clearTimeout(){},random:()=>.5}});await Q.controller.syncNow();});
   assert.equal(await pb.evaluate(async()=>{await Q.controller.syncNow();await Q.session.refresh();return Q.session.view().flights[0].logbook.instrumentMinutes;}),30);
   await pb.evaluate(async()=>{const {recordFlightRevision}=await import('/lib/flight-audit.js'),capture=Q.session.captureForm(),next=Q.session.view();next.flights[0]=recordFlightRevision(next.flights[0],{...next.flights[0],note:'V14 second device'},{entryId:'second',at:'2026-10-24T08:00:00Z'});await Q.session.saveView({...capture,next});await Q.controller.syncNow();});
   await pa.evaluate(async()=>{await Q.controller.syncNow();await Q.session.refresh();});
   const received=await pa.evaluate(()=>Q.session.view().flights[0]);assert.equal(received.note,'V14 second device');assert.equal(received.auditTrail.entries.length,2);assert.equal(received.actual.out,'2026-10-09T04:00:00.000Z');
   await pa.evaluate(async()=>{Q.controller.stop();Q.session.release();await Q.open(false);});
   assert.equal(await pa.evaluate(async()=>{const capture=Q.session.captureForm(),next=Q.session.view();next.flights[0].scheduled.out='2026-10-09T04:01:00.000Z';try{await Q.session.saveView({...capture,next});return false;}catch(e){return /V14/.test(e.message);}}),true);
   assert.equal(await pa.evaluate(async()=>(await Q.session.repository.pending()).length),0);
   console.log(name+': V14 enabled SDK preserves unknown SIC, explicit times, two-device audit history and offline IDB; flag-off blocks writes without dropping data');
  }finally{await a.close();await b.close();await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
