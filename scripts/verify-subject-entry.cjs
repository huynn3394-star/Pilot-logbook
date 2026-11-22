/* Real banks, browsers, HTTP cache and offline storage; synthetic progress only. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {createServer}=await import('../server.js'),server=createServer({firebaseConfig:{enabled:false}}),handler=server.listeners('request')[0];
 const held=new Set(),heldCatalog=new Set(),hits=new Map();let blockPanel=true,catalogMode='',catalogObserved;
 server.removeAllListeners('request');server.on('request',(req,res)=>{
  if(req.url.startsWith('/atpl/banks/'))hits.set(req.url,(hits.get(req.url)||0)+1);
  if(req.url==='/atpl/catalog.json'&&catalogMode){
   if(catalogMode==='fail'){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{}');return;}
   const pending={req,res};heldCatalog.add(pending);res.on('close',()=>heldCatalog.delete(pending));catalogObserved?.();return;
  }
  if(blockPanel&&req.url==='/atpl/account-panel.js'){
   const pending={req,res};held.add(pending);res.on('close',()=>held.delete(pending));return;
  }
  handler(req,res);
 });
 const release=()=>{blockPanel=false;for(const p of held){if(!p.res.destroyed)handler(p.req,p.res);}held.clear();};
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('test-results/subject-entry'),checks=[];await fs.mkdir(out,{recursive:true});
 try{for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{for(const width of [390,1440])for(const mode of ['guest','account']){
  blockPanel=true;const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/atpl/privacy.html');
   const seeded=await page.evaluate(async mode=>{
    const ids=await(await fetch('/atpl/identities.json')).json(),{openAccountBank,blankState}=await import('/atpl/sync/store.js');
    for(const code of ['MET','INS']){
     const state=blankState();state.progress[1]={attempts:3,correct:2,lastSelected:ids[code].questions[1].answer,lastAt:100};state.bookmarks=[1];
     localStorage.setItem(`atpl_${code.toLowerCase()}_v2_state`,JSON.stringify(state));
     const bank=await openAccountBank({storage:localStorage,uid:'entry-qa',identity:ids[code],locks:navigator.locks});bank.engineStorage.getItem(`atpl_${code.toLowerCase()}_v2_state`);bank.engineStorage.setItem(`atpl_${code.toLowerCase()}_v2_state`,JSON.stringify(state));bank.release();
    }
    localStorage.setItem('atpl_active_account_v1',JSON.stringify(mode==='account'?{uid:'entry-qa'}:{mode:'guest'}));
    return Object.fromEntries(['atpl_met_v2_state','atpl_ins_v2_state','atpl_account_v1:entry-qa:MET','atpl_account_v1:entry-qa:INS'].map(k=>[k,localStorage.getItem(k)]));
   },mode);
   const read=()=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(seeded));
   await page.goto(origin+'/atpl/',{waitUntil:'domcontentloaded'});await page.locator('[data-bank=MET] a').waitFor();
   const metrics=[];
   for(const code of ['MET','INS','MET']){
    const url=await page.locator('[data-bank='+code+'] a').getAttribute('href'),before=hits.get(url)||0,start=Date.now();
    await page.locator('[data-bank='+code+'] a').click();await page.locator('[data-action=study]').first().waitFor();await page.locator('[data-study-subject]').waitFor();
    assert.equal(await page.evaluate(()=>ATPLBankStore.uid),mode==='account'?'entry-qa':null);assert.equal(await page.evaluate(()=>ATPLBankStore.writable),true);
    assert.deepEqual(await read(),seeded,'opening subjects never rewrites progress');
    const fetched=(hits.get(url)||0)-before;
    if(metrics.some(m=>m.code===code))assert.equal(fetched,0,'reopening the unchanged bank must use the browser cache');
    metrics.push({code,openMS:Date.now()-start,networkDocuments:fetched});
    await page.locator('#choose-subject').click();await page.locator('[data-bank=MET] a').waitFor();
   }
   await page.locator('[data-bank=MET] a').click();await page.locator('[data-action=study]').first().click();
   await page.locator('[data-action=answer]').first().click();await page.locator('[data-action=bookmark]').click();
   const saved=await read(),key=mode==='account'?'atpl_account_v1:entry-qa:MET':'atpl_met_v2_state';assert.notEqual(saved[key],seeded[key]);
   for(const other of Object.keys(seeded).filter(k=>k!==key))assert.equal(saved[other],seeded[other],'other banks/accounts stay isolated');
   assert(held.size>0,'cloud/account panel is still unavailable while the quiz is usable');
   // Releasing the panel later must attach the existing store, without losing early answers.
   release();await page.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));assert.deepEqual(await read(),saved);
   await page.reload();await page.locator('[data-action=resume]').waitFor();assert.deepEqual(await read(),saved);
   await page.screenshot({path:path.join(out,`${engine}-${width}-${mode}.png`)});assert.deepEqual(errors,[]);
   checks.push({engine,width,mode,metrics,quizUsableWithoutCloudUI:true,earlyAnswersPreserved:true,otherProgressIsolated:true,unchangedBankNotRefetched:true});
  }finally{release();await context.close();}
 }
 // Slow/failed optional catalog metadata cannot block a local quiz, account
 // controls or shared appearance, nor reject a module when navigating away.
 const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 try{
  blockPanel=false;await page.goto(origin+'/atpl/');await page.locator('[data-bank=MET] a').waitFor();
  catalogMode='hold';const requested=new Promise(resolve=>catalogObserved=resolve);
  await page.locator('[data-bank=MET] a').click();await requested;await page.locator('[data-action=study]').first().waitFor();
  await page.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));
  assert.equal(await page.locator('#atpl-offline-button').isDisabled(),true);
  assert.equal(await page.evaluate(async()=>{const m=await import('/lib/appearance.js');m.setAppearance({theme:'light'});document.querySelector('[data-action=theme]').click();return m.appearance().theme;}),'dark');
  await page.locator('[data-action=study]').first().click();await page.locator('[data-action=answer]').first().click();
  const saved=await page.evaluate(()=>localStorage.getItem('atpl_met_v2_state'));assert(saved);
  catalogMode='';await page.locator('#choose-subject').click();await page.locator('[data-bank=MET] a').waitFor();
  for(const p of heldCatalog)if(!p.res.destroyed)handler(p.req,p.res);heldCatalog.clear();
  catalogMode='fail';await page.locator('[data-bank=MET] a').click();await page.locator('[data-bank-manage]>summary').click();
  await page.locator('#atpl-offline-button').filter({hasText:'Thử lại'}).waitFor();await page.locator('[data-action=resume]').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('atpl_met_v2_state')),saved);
  catalogMode='';await page.locator('#atpl-offline-button').click();await page.locator('#atpl-offline-button').filter({hasText:'Tải offline ·'}).waitFor();
  assert.deepEqual(errors,[]);checks.push({engine,width:390,mode:'metadata-guard',quizAndAccountUIWithoutCatalog:true,appearanceWithoutCatalog:true,cancelledNavigationHandled:true,failedMetadataRetry:true,progressPreserved:true});
 }finally{catalogMode='';catalogObserved=null;for(const p of heldCatalog)if(!p.res.destroyed)handler(p.req,p.res);heldCatalog.clear();await context.close();}
 }finally{await browser.close();}
 }}finally{release();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(checks,null,2));}
 assert.equal(checks.length,10);console.log(JSON.stringify(checks,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
