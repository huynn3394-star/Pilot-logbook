const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/atpl');fs.mkdirSync(out,{recursive:true});
const jump=(p,n)=>p.evaluate(n=>{const b=document.createElement('button');b.dataset.action='jump';b.dataset.qid=n;document.body.append(b);b.click();b.remove()},n);
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'server.js')));const server=createServer();let failPath=null,originUnavailable=false,blockedOriginRequests=0;
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(originUnavailable){blockedOriginRequests++;req.socket.destroy();return}if(new URL(req.url,'http://test').pathname===failPath){res.writeHead(503,{'Content-Type':'text/plain'});res.end('Intentional test interruption')}else handler(req,res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const report={date:new Date().toISOString(),browsers:{}};
 try{for(const [name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true}),context=await browser.newContext({viewport:{width:1024,height:1366},hasTouch:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,url:p.url()}));
  await p.goto(base);await p.locator('[data-action="tab"][data-tab="atpl"]:visible').first().click();await p.waitForURL('**/atpl/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const catalog=await p.evaluate(async()=>await(await fetch('/atpl/catalog.json')).json());assert.equal(await p.locator('[data-bank]').count(),12);
  const state=await p.evaluate(async()=>{const m=await import('/lib/storage.js');return JSON.stringify(await m.readState())});assert(state.includes('flights'));
  // Cancel after two actual saved assets: no ready marker, then reuse partial cache.
  const cancelled=await p.evaluate(async bank=>{const m=await import('/atpl/offline.js'),a=new AbortController();try{await m.downloadBank(bank,{signal:a.signal,onProgress:x=>{if(x.completed===2)a.abort()}});return{error:'not cancelled'}}catch(e){return{error:e.name,ready:(await m.bankStatus(bank)).ready}}},catalog.banks.find(b=>b.code==='COM'));
  assert.equal(cancelled.error,'AbortError');assert.equal(cancelled.ready,false);
  // Real503 failure through the server, not a fake cache implementation.
  const agk=catalog.banks.find(b=>b.code==='AGK');failPath=agk.url;
  await p.locator('[data-download="AGK"]').click();await p.waitForFunction(()=>!document.querySelector('[data-download="AGK"]').disabled);assert(!(await p.locator('[data-bank="AGK"] [data-ready]').innerText()).includes('✓'));assert((await p.locator('[data-bank="AGK"] .atpl-progress').innerText()).length>20);failPath=null;
  for(const b of catalog.banks){
   await p.locator(`[data-download="${b.code}"]`).click();await p.waitForFunction(code=>!document.querySelector(`[data-download="${code}"]`).disabled,b.code,{timeout:180000});
   assert((await p.locator(`[data-bank="${b.code}"] [data-ready]`).innerText()).includes('✓'),name+':'+b.code+':'+await p.locator(`[data-bank="${b.code}"] .atpl-progress`).innerText());
   if(b.code==='COM') {const corrupted=await p.evaluate(async b=>{const m=await import('/atpl/offline.js'),c=await caches.open(m.ATPL_CACHE),manifest=await(await c.match(b.manifest)).json();await c.put(manifest.assets.find(a=>a.url.endsWith('.webp')).url,new Response('corrupted-but-present'));return(await m.bankStatus(b)).ready},b);assert.equal(corrupted,false,'Unverified replacement must not still be called offline-ready');await p.locator('[data-download="COM"]').click();await p.waitForFunction(()=>!document.querySelector('[data-download="COM"]').disabled)}
  }
  // Missing asset must invalidate ready; retry must repair it.
  const missing=await p.evaluate(async b=>{const m=await import('/atpl/offline.js'),c=await caches.open(m.ATPL_CACHE),a=await(await c.match(b.manifest)).json();await c.delete(a.assets.find(a=>a.url.endsWith('.webp')).url);return (await m.bankStatus(b)).ready},catalog.banks.find(b=>b.code==='MB'));
  assert.equal(missing,false);await p.locator('[data-download="MB"]').click();await p.waitForFunction(()=>!document.querySelector('[data-download="MB"]').disabled);
  // Storage failure can be safely injected at the actual browser cache boundary.
  const quota=await p.evaluate(async b=>{const m=await import('/atpl/offline.js'),c=await caches.open(m.ATPL_CACHE);await c.delete(b.manifest);const original=Cache.prototype.put;Cache.prototype.put=async function(){throw new DOMException('Test quota full','QuotaExceededError')};let result;try{await m.downloadBank(b);result={error:'none'}}catch(e){result={error:e.name,message:m.downloadError(e)}}finally{Cache.prototype.put=original}return{...result,ready:(await m.bankStatus(b)).ready}},catalog.banks.find(b=>b.code==='HUM'));
  assert.equal(quota.error,'QuotaExceededError');assert.equal(quota.ready,false);assert(quota.message.includes('Chưa tải xong'));
  await p.locator('[data-download="HUM"]').click();await p.waitForFunction(()=>!document.querySelector('[data-download="HUM"]').disabled);
  // New SW activation must retain the ATPL cache and unrelated caches.
  await p.evaluate(async()=>{await(await caches.open('unrelated-app-cache')).put('/keep',new Response('keep'));await(await caches.open('avilog-shell-obsolete')).put('/old',new Response('old'));await navigator.serviceWorker.register('/sw.js?qa-update=1',{scope:'/'});});
  await p.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('qa-update=1') && navigator.serviceWorker.controller.state==='activated');
  const cacheKeys=await p.evaluate(()=>caches.keys());assert(cacheKeys.includes('avilog-atpl-v1'));assert(cacheKeys.includes('unrelated-app-cache'));assert(!cacheKeys.includes('avilog-shell-obsolete'));
  // Playwright WebKit offline emulation rejects even literal SW navigations:
  // https://github.com/microsoft/playwright/issues/42775 . Refuse all origin
  // connections for WebKit instead; Chromium uses the actual offline flag.
  if(name==='chromium')await context.setOffline(true);else originUnavailable=true;
  await p.goto(base+'/atpl/');await p.locator('[data-bank="POF"] [data-ready]').filter({hasText:'✓'}).waitFor({timeout:30000});
  const banks={};let popupCount=0;
  for(const b of catalog.banks){
   await p.goto(base+b.url);await p.locator('[data-action="study"]').first().waitFor();await p.locator('#atpl-offline-button').waitFor();
   const grade=await p.evaluate(()=>{const E=window.ATPLQuizEngine,b=Object.values(JSON.parse(document.getElementById('bank-data').textContent))[0].questions,valid=b.filter(q=>q.valid);let s=E.startExam(E.defaultState(),valid.map(q=>q.id));for(const q of valid)s=E.answerExam(s,q.id,q.answer);s=E.submitExam(s,b);const round=E.importBackup(E.exportBackup(s),b);return{count:valid.length,correct:s.exam.report.correct,backup:round.examHistory[0].correct===valid.length}});assert.equal(grade.correct,b.count,b.code);assert(grade.backup);
   await p.locator('[data-action="study"]').first().click();const id=b.code==='INS'?148:1;await jump(p,id);
   const key=await p.evaluate(id=>Object.values(JSON.parse(document.getElementById('bank-data').textContent))[0].questions.find(q=>q.id===id).answer,id);await p.locator(`[data-action="answer"][data-key="${key}"]`).click();
   if(b.code==='INS')assert.deepEqual(await p.locator('.answer-option .letter').allTextContents(),['E','F','G','H']);
   await p.locator('[data-action="bookmark"]').click();
   const old=await p.locator('html').getAttribute('data-theme');await p.locator('[data-action="theme"]').click();assert.notEqual(await p.locator('html').getAttribute('data-theme'),old);
   const source=p.locator('[data-action="source"],[data-action="image"]').first();if(await source.count()){
    await source.evaluate(el=>{for(let x=el.parentElement;x;x=x.parentElement)if(x.tagName==='DETAILS')x.open=true});await source.click();await p.locator('#image-dialog img').evaluate(img=>img.decode());assert(await p.locator('#image-dialog img').evaluate(img=>img.naturalWidth>500));await p.locator('[data-action="image-close"]').click();popupCount++;
   }
   assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),b.code+' overflow');
   await p.reload();await p.locator('[data-action="resume"]').first().click();await jump(p,id);assert.equal(await p.locator('[data-action="bookmark"]').innerText(),'★');
   if(b.code==='MB'){await p.locator('a.mb-mode-link').click();await p.waitForURL('**/'+catalog.banks.find(b=>b.code==='MBR').url.split('/').pop());await p.locator('#atpl-offline-button').waitFor();assert.equal(await p.evaluate(()=>window.ATPL_SUBJECT),'MBR')}
   banks[b.code]=grade;console.log('OFFLINE PASS',name,b.code,grade.correct);
  }
  assert(popupCount>=8,'real offline source-image popups required');
  await p.goto(base);const after=await p.evaluate(async()=>{const m=await import('/lib/storage.js');return JSON.stringify(await m.readState())});assert.equal(after,state,'Logbook IndexedDB unchanged');
  await p.locator('[data-action="tab"][data-tab="atpl"]:visible').first().click();await p.waitForURL('**/atpl/');await p.locator('[data-bank="POF"] [data-ready]').filter({hasText:'✓'}).waitFor();await p.screenshot({path:path.join(out,name+'-ipad-offline.png'),fullPage:true});
  assert(!(await p.locator('#atpl-status').innerText()).includes('load failed'),'Offline must not display a script registration error');
  assert.deepEqual(errors,[],name);report.browsers[name]={version:browser.version(),offlineMode:name==='chromium'?'context.setOffline(true)':'All origin connections refused; Playwright WebKit issue 42775',blockedOriginRequests,banks,popupCount,cancellation:true,httpFailure:true,quotaFailure:true,missingAssetRepair:true,workerUpdateRetainsDownloads:true,logbookUnchanged:true,errors};fs.writeFileSync(path.join(out,'Browser_QA.json'),JSON.stringify(report,null,2));await browser.close();originUnavailable=false;
 }}finally{server.close()}
 report.complete=true;fs.writeFileSync(path.join(out,'Browser_QA.json'),JSON.stringify(report,null,2));console.log('PASS Chromium offline + WebKit origin unavailable, source-key scoring, images and logbook preservation');
})().catch(e=>{console.error(e);process.exit(1)});
