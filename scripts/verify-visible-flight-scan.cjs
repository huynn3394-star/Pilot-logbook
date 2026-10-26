/* Local synthetic guest sessions; no camera hardware, OCR recognition or live cloud writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {pageManage,flightTab,flightScheduled}=require('./ui-controls.cjs');
const out=path.resolve('test-results/visible-flight-scan');
const report={scope:'Real local app; synthetic guest flights and OCR text; external providers blocked. Not physical iOS or live cloud.',checks:[],errors:[]};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const {createServer}=await import('../server.js');const server=createServer({firebaseConfig:{enabled:false}});
 let unavailable=false;const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(const [engineName,engine]of Object.entries({chromium,webkit})){
   const browser=await engine.launch({headless:true});
   try{for(const width of [320,390,820,1440])for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage(),errors=[];
    p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
    try{
     await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
     await p.route('**/api/weather**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic UI check"}'}));
     await p.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
     await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();
     await p.evaluate(async theme=>(await import('/lib/appearance.js')).setAppearance({theme}),theme);
     await p.locator('[data-tab=logbook]:visible').first().click();
     const form=p.locator('#flight-form'),records=[];
     for(const [code,final]of [['VN9911',false],['VN9912',true]]){
      await pageManage(p);await p.locator('[data-action=add]:visible').click();await form.waitFor();
      for(const [name,value]of Object.entries({flightNo:code,date:'2026-10-26',dep:'HAN',dest:'CAN',reg:'VN-A603',note:'Preserve '+code}))await form.locator(`[name=${name}]`).fill(value);
      await flightScheduled(p);
      for(const [name,value]of Object.entries({s_out:'06:00',s_out_date:'2026-10-26',s_in:'08:00',s_in_date:'2026-10-26'}))await form.locator(`[name=${name}]`).fill(value);
      if(final){for(const [name,value]of Object.entries({a_out:'06:00',a_off:'06:13',a_on:'07:35',a_in:'07:58'}))await form.locator(`[name=${name}]`).fill(value);await flightTab(p,'tools');await form.locator('[name=confirmed]').check();}
      const id=await form.getAttribute('data-id');records.push({id,code,final});await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});
     }
     const close=async()=>{await p.locator('#modal [data-action=close]').first().click();await p.locator('#modal').waitFor({state:'hidden'});};
     const inspect=async(button,record)=>{
      await button.waitFor();assert.equal(await button.innerText(),'Scan Flight Log');
      const g=await button.evaluate(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n),ancestors=[];for(let a=n;a;a=a.parentElement){const s=getComputedStyle(a);ancestors.push({tag:a.tagName,class:a.className,display:s.display,zoom:s.zoom,transform:s.transform,height:s.height,minHeight:s.minHeight,animation:s.animationName});}return{left:r.left,right:r.right,height:r.height,cssHeight:c.height,minHeight:c.minHeight,color:c.color,background:c.backgroundColor,clipped:n.scrollWidth>n.clientWidth+1,ancestors}});
      report.lastMeasurement={engineName,width,theme,flight:record.code,placement:await button.getAttribute('data-flight-scan-shortcut'),geometry:g};
      assert(g.height>=44,'touch height: '+JSON.stringify(report.lastMeasurement));assert(g.left>=0&&g.right<=width+1,'visible without horizontal scrolling: '+JSON.stringify(g));assert(!g.clipped);
      await button.focus();assert(await button.evaluate(n=>document.activeElement===n));await p.keyboard.press('Enter');
      await p.locator('[data-image-flight-target]').waitFor();assert.match(await p.locator('[data-image-flight-target]').innerText(),new RegExp(record.code));
      assert.equal(await p.locator('#image-date').inputValue(),'2026-10-26');assert.equal(await p.locator('[name=family]').inputValue(),'A320');
      await p.locator('[data-action=image-cancel]').last().click();await form.waitFor();assert.equal(await form.getAttribute('data-id'),record.id);
      assert.equal(await form.locator('[name=note]').inputValue(),'Preserve '+record.code);assert.equal(await form.locator('[name=a_out]').inputValue(),record.final?'06:00':'');
      assert.equal(await p.locator('[data-flight-log-scan]').count(),1);
      if(record.final){await flightTab(p,'tools');assert.equal(await form.locator('[name=replaceConfirmed]').isChecked(),false);}
      await close();return g;
     };
     await p.locator('[data-tab=schedule]:visible').first().click();
     await p.waitForFunction(()=>{const n=document.querySelector('[data-flight-scan-shortcut=schedule]');return n&&parseFloat(getComputedStyle(n).minHeight)===44});
     const geometry=[];
     for(const record of records)geometry.push(await inspect(p.locator(`[data-flight-scan-shortcut=schedule][data-id="${record.id}"]`),record));
     if(width===390)await p.screenshot({path:path.join(out,`${engineName}-${theme}-schedule.png`),fullPage:true});
     await p.locator('[data-tab=logbook]:visible').first().click();await p.locator('[data-filter=search]').fill('VN99');
     await p.locator('[data-flight-scan-shortcut=list]').first().waitFor();
     assert.equal(await p.locator('[data-flight-scan-shortcut=list]').count(),2);
     const count=await p.evaluate(async()=>{const m=await import('/ui/flight-scan-shortcuts.js');const h=m.mountFlightScanShortcuts(document.querySelector('#app'));h.refresh();h.refresh();return document.querySelectorAll('[data-flight-scan-shortcut=list]').length;});assert.equal(count,2,'no duplicate buttons or observers');
     for(const record of records){const button=p.locator(`[data-flight-scan-shortcut=list][data-id="${record.id}"]`);assert(await button.evaluate(n=>n.closest('td')===n.closest('tr').firstElementChild));geometry.push(await inspect(button,record));}
     if(width===390)await p.screenshot({path:path.join(out,`${engineName}-${theme}-logbook.png`),fullPage:true});
     const raw=(code,time='06:00')=>`AOC FLT LOG\nFLT ID/DATE DEPT/DEST\n${code}/-- VVNB/ZGGG\nOUT ${time}\nOFF 06:13\nON 07:35\nIN 07:58`;
     await p.locator(`[data-flight-scan-shortcut=list][data-id="${records[0].id}"]`).click();
     await p.locator('#image-text').fill(raw('VN9912'));await p.locator('[data-action=image-parse]').click();assert.match(await p.locator('#modal [data-error]').innerText(),/không khớp/);
     await p.locator('#image-text').fill(raw('VN9911'));await p.locator('[data-action=image-parse]').click();await form.waitFor();assert.equal(await form.getAttribute('data-id'),records[0].id);assert.equal(await form.locator('[name=a_out]').inputValue(),'06:00');await close();
     await p.locator(`[data-flight-scan-shortcut=list][data-id="${records[0].id}"]`).click();await p.locator('[data-action=image-cancel]').last().click();assert.equal(await form.locator('[name=a_out]').inputValue(),'','preview did not save');await close();
     // FINAL may be opened through the shortcut, but saving changes still requires consent.
     await p.locator(`[data-flight-scan-shortcut=list][data-id="${records[1].id}"]`).click();await p.locator('#image-text').fill(raw('VN9912','06:01'));await p.locator('[data-action=image-parse]').click();
     await form.locator('[name=scanReviewed]').check();await flightTab(p,'tools');await form.locator('[name=confirmed]').check();await p.locator('.fe-save').click();assert.match(await form.locator('[data-error]').innerText(),/bảo vệ|cho phép/i);await close();
     await p.locator('[data-filter=status]').selectOption('confirmed');await p.locator('[data-flight-scan-shortcut=list]').waitFor();assert.equal(await p.locator('[data-flight-scan-shortcut=list]').count(),1);assert.equal(await p.locator('[data-flight-scan-shortcut=list]').getAttribute('data-id'),records[1].id);
     await p.locator('[data-filter=status]').selectOption('all');
     await p.locator('[data-filter=search]').fill('ZZ-NO-FLIGHT');assert.equal(await p.locator('[data-flight-scan-shortcut]').count(),0);
     await p.locator('[data-filter=search]').fill('VN99');await p.locator('[data-flight-scan-shortcut=list]').first().waitFor();
     // Global importer remains separate and unbound.
     await pageManage(p);await p.locator('[data-page-manage] [data-action=image]:visible').click();await p.locator('#image-date').waitFor();assert.equal(await p.locator('[data-image-flight-target]').count(),0);await close();
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);
     report.checks.push({label:`${engineName} ${width}px ${theme}`,geometry});
     if(width===390&&theme==='dark'){
      await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
      const cached=await p.evaluate(async()=>{const k=(await caches.keys()).find(k=>k.includes('scan-shortcuts'));if(!k)return false;const c=await caches.open(k);return !!(await c.match('/ui/flight-scan-shortcuts.js'))&&!!(await c.match('/ui/flight-scan-shortcuts.css'));});assert(cached);
      unavailable=true;assert(await p.evaluate(()=>fetch('/api/health',{cache:'no-store'}).then(()=>false).catch(()=>true)));
      await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();await p.locator('[data-tab=logbook]:visible').first().click();
      // The app initializes the month independently of the previously selected one.
      await p.locator('input[type=month]').fill('2026-10');await p.locator('[data-filter=search]').fill('VN99');
      await p.locator(`[data-flight-scan-shortcut=list][data-id="${records[0].id}"]`).click();await p.locator('[data-image-flight-target]').waitFor();assert.match(await p.locator('[data-image-flight-target]').innerText(),/VN9911/);
      report.checks.push({label:`${engineName} offline shortcut opens correct saved flight; OCR not invoked`});unavailable=false;
     }
    }catch(error){await p.screenshot({path:path.join(out,`${engineName}-${width}-${theme}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
    finally{unavailable=false;await context.close();}
   }}finally{await browser.close();}
  }
 }catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
 finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1});
