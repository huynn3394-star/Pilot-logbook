/* Real documents/quiz/IndexedDB, synthetic guest flights. No production data. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
async function appTab(view,tab,width){
 if(width<=720&&tab==='atpl'){await view.locator('[data-action=navy-more]').click();await view.locator('#modal [data-tab=atpl]').click();}
 else await view.locator((width<=720?'.bottom-nav':'.sidebar')+' [data-tab='+tab+']').click();
}
async function companionFrame(page){await page.locator('iframe[data-companion-frame]').waitFor({state:'attached'});return (await page.locator('iframe[data-companion-frame]').elementHandle()).contentFrame();}
const visibleArea=(page,host,area)=>page.waitForFunction(show=>document.body.classList.contains('companion-active')===show,host!==area);
(async()=>{
 const {createServer}=await import('../server.js');
 const server=createServer({firebaseConfig:{enabled:false},weather:{get:async station=>({station,provider:'Fixture',fetchedAt:'2026-11-22T10:10:00Z',metar:`METAR ${station} 221000Z 00000KT CAVOK 30/24 Q1013=`,taf:`TAF ${station} 220800Z 2209/2309 00000KT CAVOK=`,sources:{metar:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,taf:`https://aviationweather.gov/api/data/taf?ids=${station}&format=raw`}})}});
 let weatherRequests=0;const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{
  if(req.url.startsWith('/api/weather?'))weatherRequests++;
  if(req.url!=='/companion-login-qa')return handler(req,res);
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><head></head><body><main id="app"><button id="open">Ôn thi</button></main><script type="module">import{setupCompanionNavigation}from"/ui/companion-navigation.js";const nav=setupCompanionNavigation({area:"app",onLogin:async()=>{window.loginRequests=(window.loginRequests||0)+1;}});document.getElementById("open").onclick=()=>nav.open("/atpl/");</script></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const catalog=JSON.parse(await fs.readFile('public/atpl/catalog.json','utf8')),bank=catalog.banks.find(b=>b.code==='POF');
 const out=path.resolve('test-results/companion-navigation');await fs.mkdir(out,{recursive:true});const checks=[];
 try{for(const [name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,1440])for(const host of ['app','study']){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[],navigations=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.isNavigationRequest())navigations.push(r.url());});page.setDefaultTimeout(15000);
   try{
    await page.clock.setFixedTime(new Date('2026-11-22T10:10:00Z'));
    await page.goto(origin+'/?tab=logbook');await page.locator('[data-navy-logbook]').waitFor();
    await page.evaluate(async()=>{
     const {sampleState}=await import('/lib/sample.js'),{writeState}=await import('/lib/storage.js'),state=sampleState(),model=state.flights.find(f=>f.confirmed);
     state.flights=Array.from({length:3000},(_,i)=>{let date=new Date(Date.UTC(2026,0,1+Math.floor(i/6))).toISOString().slice(0,10);if(date==='2026-11-22')date='2026-11-21';return {...structuredClone(model),id:'perf-'+i,date,flightNo:'VN'+(1000+i),scheduled:{out:date+'T03:00:00Z',in:date+'T05:00:00Z'},actual:{out:date+'T03:00:00Z',off:date+'T03:10:00Z',on:date+'T04:50:00Z',in:date+'T05:00:00Z'},confirmed:true};});
     state.settings.weatherAirports=[];state.settings.weatherGroups=[];state.demo=false;await writeState(state);
    });
    await page.goto(origin+(host==='app'?'/?tab=logbook':bank.url));
    let app=page,study=page;
    if(host==='app'){
     await page.locator('[data-navy-logbook]').waitFor();await appTab(page,'atpl',width);study=await companionFrame(page);
     await study.locator('[data-bank=POF] a').click();await study.locator('[data-action=study]').first().waitFor();
    }else await study.locator('[data-action=study]').first().waitFor();
    await study.locator('[data-action=study]').first().click();await study.locator('[data-action=answer]').first().waitFor();
    await study.locator('[data-action=answer]').first().click();await study.locator('[data-action=bookmark]').click();
    const question=await study.locator('#view').innerText(),progress=await study.evaluate(()=>localStorage.getItem('atpl_pof_v2_state'));
    await study.evaluate(()=>{window.__studyMarker=crypto.randomUUID();window.__questionNode=document.querySelector('#view');});
    const marker=await study.evaluate(()=>__studyMarker);
    await study.locator('.study-header .brand a').click();
    if(host==='study')app=await companionFrame(page);
    await visibleArea(page,host,'app');
    await app.locator('[data-navy-logbook]').waitFor({state:'visible'});
    await app.evaluate(()=>{window.__appMarker=crypto.randomUUID();window.__logbookNode=document.querySelector('[data-navy-logbook]');});
    const appMarker=await app.evaluate(()=>__appMarker),beforeRequests=navigations.length,historyLength=await page.evaluate(()=>history.length);
    const dbBefore=await app.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState()));
    if(name==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
    const timings=[];
    for(let i=0;i<4;i++){
     const toStudy=await app.evaluate(async width=>{
      const start=performance.now();
      if(width<=720){document.querySelector('[data-action=navy-more]').click();document.querySelector('#modal [data-tab=atpl]').click();}else document.querySelector('.sidebar [data-tab=atpl]').click();
      return start;
     },width);
     await visibleArea(page,host,'study');
     await study.locator('[data-action=answer]').first().waitFor({state:'visible'});
     assert.equal(await study.evaluate(()=>__studyMarker),marker);assert.equal(await study.evaluate(()=>__questionNode===document.querySelector('#view')),true);
     const studyMS=await app.evaluate(start=>performance.now()-start,toStudy);
     const toApp=await study.evaluate(()=>{const start=performance.now();document.querySelector('.study-header .brand a').click();return start;});
     await visibleArea(page,host,'app');
     await app.locator('[data-navy-logbook]').waitFor({state:'visible'});
     const appMS=await study.evaluate(start=>performance.now()-start,toApp);
     assert.equal(await app.evaluate(()=>__appMarker),appMarker);assert.equal(await app.evaluate(()=>__logbookNode===document.querySelector('[data-navy-logbook]')),true);
     timings.push({studyMS,appMS});
    }
    assert.equal(navigations.length,beforeRequests,'warm switching must not request another document');
    assert.equal(await page.evaluate(()=>history.length),historyLength,'warm switches do not add hidden frame history entries');
    assert.equal(await app.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState())),dbBefore,'switching cannot change flights or settings');
    await appTab(app,'atpl',width);await visibleArea(page,host,'study');await study.locator('[data-action=answer]').first().waitFor({state:'visible'});
    assert.equal(await study.locator('#view').innerText(),question);assert.equal(await study.evaluate(()=>localStorage.getItem('atpl_pof_v2_state')),progress);
    assert.equal(await page.locator('iframe[data-companion-frame]').count(),1,'at most one retained companion');
    assert.equal(await(host==='app'?study:app).locator('iframe[data-companion-frame]').count(),0,'never nest another companion');
    assert(await study.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    await page.screenshot({path:path.join(out,`${name}-${width}-${host}-quiz.png`)});
    // Siblings/foreign message origins cannot navigate the retained host.
    const url=page.url();await page.evaluate(()=>{
     dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.test',source:document.querySelector('iframe').contentWindow,data:{channel:'avilog-companion-v1',type:'navigate',path:'/?tab=settings'}}));
     dispatchEvent(new MessageEvent('message',{origin:location.origin,source:window,data:{channel:'avilog-companion-v1',type:'navigate',path:'/?tab=settings'}}));
    });assert.equal(page.url(),url);
    // A real coordinator transition must retire the old guest engine before reuse.
    await study.evaluate(async()=>{
     const old=window.ATPLBankStore,{getCoordinator}=await import('/account/coordinator.js');
     getCoordinator().selectAuthenticatedUser({uid:'navigation-other-account'});
     let blocked=false;try{old.engineStorage.setItem('atpl_pof_v2_state',localStorage.getItem('atpl_pof_v2_state'));}catch{blocked=true;}
     sessionStorage.setItem('companion-old-writer-blocked',String(blocked));
    }).catch(error=>{if(!/destroyed|navigation|closed/.test(error.message))throw error;});
    await study.waitForFunction(()=>window.ATPLBankStore?.uid==='navigation-other-account');
    assert.equal(await study.evaluate(()=>sessionStorage.getItem('companion-old-writer-blocked')),'true');
    assert.equal(await study.evaluate(()=>localStorage.getItem('atpl_pof_v2_state')),progress,'account switch never overwrites guest progress');
    const accountState=await study.evaluate(()=>JSON.parse(ATPLBankStore.engineStorage.getItem('atpl_pof_v2_state')));
    assert.equal(Object.keys(accountState.progress||{}).length,0,'another account does not inherit guest answers');
    assert.deepEqual(errors,[]);checks.push({engine:name,width,host,flights:3000,cpuRate:name==='chromium'?4:1,timings,documentRequestsOnWarmSwitch:0,originalQuizDOM:true,answersAndBookmarks:true,originalAppDOM:true,unchangedGuestData:true,accountSwitchProtected:true});
   }catch(error){await page.screenshot({path:path.join(out,`${name}-${width}-${host}-failure.png`)}).catch(()=>{});throw error;}
   finally{await context.close();}
  }
  const authContext=await browser.newContext({serviceWorkers:'block'}),authPage=await authContext.newPage();
  try{
   await authPage.goto(origin+'/companion-login-qa');await authPage.locator('#open').click();const frame=await companionFrame(authPage);await frame.locator('[data-bank=POF]').waitFor();await authPage.waitForFunction(()=>document.body.classList.contains('companion-active'));
   assert.equal(await frame.evaluate(async()=>(await import('/ui/companion-navigation.js')).topLevelLogin()),true);
   await authPage.waitForFunction(()=>window.loginRequests===1);
   await frame.locator('.sidebar [data-tab=logbook]').click();await authPage.waitForFunction(()=>!document.body.classList.contains('companion-active'));
   await frame.evaluate(async()=>(await import('/ui/companion-navigation.js')).topLevelLogin());
   assert.equal(await authPage.evaluate(()=>loginRequests),1,'parked views cannot start a login');
  }finally{await authContext.close();}
  const weatherContext=await browser.newContext({serviceWorkers:'block'}),weatherPage=await weatherContext.newPage();
  try{
   await weatherPage.clock.setFixedTime(new Date('2026-11-22T10:10:00Z'));await weatherPage.goto(origin+'/?tab=weather');await weatherPage.locator('[data-weather-search]').waitFor();
   await weatherPage.evaluate(async()=>{const {readState,writeState}=await import('/lib/storage.js'),state=await readState();state.settings.weatherAirports=['VVPC'];state.settings.weatherGroups=[{id:'fixture',name:'Quốc nội',airports:['VVPC']}];await writeState(state);});
   await weatherPage.reload();await weatherPage.locator('.weather-row-current').waitFor();
   await weatherPage.locator('.sidebar [data-tab=atpl]').click();const study=await companionFrame(weatherPage);await study.locator('[data-bank=POF]').waitFor();await weatherPage.waitForFunction(()=>document.body.classList.contains('companion-active'));
   const before=weatherRequests;await weatherPage.clock.setFixedTime(new Date('2026-11-22T10:31:00Z'));await weatherPage.evaluate(()=>{dispatchEvent(new Event('online'));});
   await weatherPage.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(weatherRequests,before,'hidden Weather does not fetch on connectivity events');
   await study.locator('.sidebar [data-tab=weather]').click();await weatherPage.locator('.weather-row-saved').waitFor();await weatherPage.waitForFunction(()=>!document.querySelector('[data-watch-refresh]').disabled);
   assert.equal(weatherRequests,before+1,'Weather checks a due report once when resumed');
   await weatherPage.evaluate(async()=>{(await import('/account/coordinator.js')).getCoordinator().selectAuthenticatedUser({uid:'navigation-dormant-account'});});
   await weatherPage.locator('iframe[data-companion-frame]').waitFor({state:'detached'});
  }finally{await weatherContext.close();}
  const upgradeContext=await browser.newContext(),upgradePage=await upgradeContext.newPage();
  try{
   await upgradePage.goto(origin+'/?tab=logbook');await upgradePage.locator('[data-navy-logbook]').waitFor();await upgradePage.waitForFunction(()=>!!navigator.serviceWorker.controller);
   const proof=await upgradePage.evaluate(async url=>{
    const response=await fetch(url,{cache:'reload'}),bytes=await response.arrayBuffer(),digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const hash=await digest(bytes),headers=Object.fromEntries(response.headers);headers['x-frame-options']='DENY';headers['content-security-policy']="img-src 'self' data:; frame-ancestors 'none'";headers['x-atpl-verified-sha256']=hash;
    await(await caches.open('avilog-atpl-v1')).put(url,new Response(bytes,{headers}));
    const delivered=await fetch(url);return {hash,deliveredHash:await digest(await delivered.clone().arrayBuffer()),frame:delivered.headers.get('x-frame-options'),policy:delivered.headers.get('content-security-policy'),verified:delivered.headers.get('x-atpl-verified-sha256')};
   },bank.url);
   assert.equal(proof.hash,proof.deliveredHash);assert.equal(proof.verified,proof.hash);assert.equal(proof.frame,'SAMEORIGIN');assert.equal(proof.policy,"img-src 'self' data:; frame-ancestors 'self'");
   await upgradePage.locator('.sidebar [data-tab=atpl]').click();const study=await companionFrame(upgradePage);await study.locator('[data-bank=POF] a').click();await study.locator('[data-action=study]').first().click();await study.locator('[data-action=answer]').first().waitFor();
  }finally{await upgradeContext.close();}
  }finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(checks,null,2));}
 assert.equal(checks.length,8);console.log(JSON.stringify(checks,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
