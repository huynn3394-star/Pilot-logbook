/* Deterministic clock + native IndexedDB. No live weather or user account writes. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {createServer}=await import('../server.js');
 const {noaaSource}=await import('../public/workspace/weather-report.js');
 let calls=0,mode='unchanged';
 const report=()=>({station:'VVPC',provider:'Fixture',fetchedAt:mode==='fresh'?'2026-11-22T10:31:00Z':'2026-11-22T10:01:00Z',metar:`METAR VVPC 22${mode==='fresh'?'1030':'1000'}Z 02004KT 9999 FEW027 29/24 Q1012=`,taf:'TAF VVPC 220800Z 2209/2309 07008KT 9999 FEW020=',sources:{metar:noaaSource('VVPC','metar'),taf:noaaSource('VVPC','taf')}});
 const server=createServer({firebaseConfig:{enabled:false},weather:{get:async()=>{calls++;return report();}}});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  if(req.url==='/weather-schedule-qa'){
   res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/ui/tokens.css"><link rel="stylesheet" href="/ui/weather-attention.css"></head><body><main id="app"><div id="weather"></div></main></body></html>');
  }else handler(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('test-results/weather-schedule');await fs.mkdir(out,{recursive:true});const checks=[];
 try{for(const [name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,1440])for(const theme of ['light','dark']){
   calls=0;mode='unchanged';const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.clock.install({time:new Date('2026-11-22T10:10:00Z')});await page.clock.pauseAt(new Date('2026-11-22T10:10:00Z'));
    await page.goto(origin+'/weather-schedule-qa');
    await page.evaluate(async({initial,theme})=>{
     document.documentElement.dataset.theme=theme;
     const {connect}=await import('/lib/storage.js'),db=await connect();
     await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put({reports:{VVPC:initial}},'weather-watch:v2:guest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
     window.mount=async()=>{
      window.ui?.dispose();window.watch?.dispose();
      const {createWeatherWatch}=await import('/workspace/weather-watch.js'),{mountWeatherWatch}=await import('/workspace/weather-watch-ui.js');
      window.watch=createWeatherWatch({airports:['VVPC']});await watch.ready;
      window.ui=mountWeatherWatch({element:document.getElementById('weather'),watch,getGroups:()=>[{id:'dom',name:'Quốc nội',airports:['VVPC']}],onGroups:async()=>{}});
     };await mount();
    },{initial:report(),theme});
    await page.locator('.weather-row-current').waitFor();assert.equal(calls,0);
    await page.clock.fastForward(19*60000);await page.evaluate(()=>mount());await page.locator('.weather-row-current').waitFor();assert.equal(calls,0,'remount before next cycle must use disk');
    await page.clock.fastForward(60000);await page.waitForFunction(()=>!watch.snapshot().loading.length&&watch.snapshot().reports.VVPC);
    await page.locator('.weather-row-saved').waitFor();assert.equal(calls,1,'first check at 10:30');
    const text=await page.locator('[data-weather-preview=metar]').innerText();assert.match(text,/221000Z/);
    await page.evaluate(()=>mount());await page.locator('.weather-row-saved').waitFor();assert.equal(calls,1,'retry delay survives disk reopen');
    await page.clock.fastForward(59000);assert.equal(calls,1);mode='fresh';await page.clock.fastForward(1000);
    await page.locator('.weather-row-current').waitFor();assert.equal(calls,2);assert.match(await page.locator('[data-weather-preview=metar]').innerText(),/221030Z/);
    await context.setOffline(true);await page.evaluate(()=>{window.dispatchEvent(new Event('offline'));});
    await page.locator('.weather-row-current').waitFor();await page.clock.fastForward(29*60000);
    await page.locator('.weather-row-saved').waitFor();assert.equal(calls,2,'offline boundary repaints without requests');
    await page.locator('[data-weather-product=taf]').click();await page.locator('.weather-row-current').waitFor();assert.equal(calls,2,'TAF remains current independently');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,`${name}-${width}-${theme}.png`),fullPage:true});
    checks.push({engine:name,width,theme,checks:'no initial/remount requests, exact boundary, unchanged stays saved, persisted retry, newer returns Current, offline boundary, independent TAF'});
   }finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(checks,null,2));}
 assert.equal(checks.length,8);console.log('PASS weather schedule: '+checks.length+' browser/viewport/theme combinations');
})().catch(error=>{console.error(error);process.exitCode=1;});
