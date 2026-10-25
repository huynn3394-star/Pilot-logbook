/* Local synthetic guest records. Exercises the existing parser with OCR text; no live OCR/cloud writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {pageManage,flightTab,flightScheduled}=require('./ui-controls.cjs');
const out=path.resolve('test-results/flight-scan'),report={scope:'Local guest data; parser/review/save flow, not camera hardware or OCR recognition accuracy',checks:[],errors:[]};
const raw=(code='VN9911',out='06:00')=>`AOC FLT LOG\nFLT ID/DATE DEPT/DEST\n${code}/-- VVNB/ZGGG\nOUT ${out}\nOFF 06:13\nON 07:35\nIN 07:58`;
(async()=>{
 await fs.mkdir(out,{recursive:true});const {createServer}=await import('../server.js');
 const server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const [engineName,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const width of [320,390,820])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await p.route('**/api/weather**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic UI check"}'}));
    await p.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();
    await p.evaluate(async theme=>(await import('/lib/appearance.js')).setAppearance({theme}),theme);
    await p.locator('[data-tab=logbook]:visible').first().click();await pageManage(p);await p.locator('[data-action=add]:visible').click();
    const form=p.locator('#flight-form');await form.waitFor();assert.equal(await p.locator('[data-flight-log-scan]').count(),0);assert.match(await form.innerText(),/Lưu chuyến bay trước/);
    for(const [name,value]of Object.entries({flightNo:'VN9911',date:'2026-10-25',dep:'HAN',dest:'CAN',reg:'VN-A603',note:'keep saved remark'}))await form.locator(`[name=${name}]`).fill(value);
    await flightScheduled(p);for(const [name,value]of Object.entries({s_out:'06:00',s_out_date:'2026-10-25',s_in:'08:00',s_in_date:'2026-10-25'}))await form.locator(`[name=${name}]`).fill(value);
    const id=await form.getAttribute('data-id');await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});
    const open=async()=>{await p.locator(`[data-action=edit][data-id="${id}"]`).click();await form.waitFor();};
    const scan=async()=>{await p.locator('[data-flight-log-scan]').click();await p.locator('#image-date').waitFor();};
    const preview=async text=>{await p.locator('#image-text').fill(text);await p.locator('[data-action=image-parse]').click();};
    await open();assert.equal(await p.locator('[data-flight-log-scan]').getAttribute('data-id'),id);
    const action=p.locator('[data-flight-log-scan]');const box=await action.boundingBox();assert(box.height>=40);assert.equal(await action.getAttribute('type'),'button');
    if(width===390)await p.screenshot({path:path.join(out,`${engineName}-${theme}-flight.png`)});
    // Dirty edits must stay in the editor until explicitly saved, not silently vanish.
    await form.locator('[name=note]').fill('unsaved note');await action.click();assert.equal(await p.locator('#image-date').count(),0);assert.equal(await form.locator('[name=note]').inputValue(),'unsaved note');assert.match(await form.locator('[data-error]').innerText(),/lưu/i);
    await p.locator('#modal [data-action=close]').first().click();await open();assert.equal(await form.locator('[name=note]').inputValue(),'keep saved remark');
    // Upload-only evidence is a draft too and cannot be lost when starting a scan.
    await flightTab(p,'tools');await form.locator('[name=evidence]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
    await flightTab(p,'log');await action.click();assert.equal(await p.locator('#image-date').count(),0);assert.equal(await form.locator('[name=evidence]').evaluate(n=>n.files.length),1);
    await p.locator('#modal [data-action=close]').first().click();await open();
    await p.evaluate(()=>window.__scanCapture=document.querySelector('#modal')._formCapture);await scan();
    assert.equal(await p.locator('#image-date').inputValue(),'2026-10-25');assert.equal(await p.locator('[name=family]').inputValue(),'A320');assert.match(await p.locator('[data-image-flight-target]').innerText(),/VN9911/);assert.match(await p.locator('[data-image-flight-target]').innerText(),/HAN.*CAN/);
    await p.locator('[data-action=image-cancel]').last().click();assert.equal(await form.getAttribute('data-id'),id);assert(await p.evaluate(()=>window.__scanCapture===document.querySelector('#modal')._formCapture));
    await scan();await preview(raw('VN9912'));assert.equal(await p.locator('#flight-form').count(),0);assert.match(await p.locator('#modal [data-error]').innerText(),/không khớp/);
    await p.locator('#image-date').fill('2026-10-26');await preview(raw());assert.equal(await p.locator('#flight-form').count(),0);assert.match(await p.locator('#modal [data-error]').innerText(),/không khớp/);
    await p.locator('#image-date').fill('2026-10-25');await preview(raw());await form.waitFor();assert.equal(await form.getAttribute('data-id'),id);assert(await p.evaluate(()=>window.__scanCapture===document.querySelector('#modal')._formCapture));
    for(const [key,value]of Object.entries({flightNo:'VN9911',date:'2026-10-25',reg:'VN-A603',note:'keep saved remark',a_out:'06:00',a_in:'07:58',s_out:'06:00',s_in:'08:00'}))assert.equal(await form.locator(`[name=${key}]`).inputValue(),value,key);
    await p.locator('#modal [data-action=close]').first().click();await open();assert.equal(await form.locator('[name=a_out]').inputValue(),'','Preview never auto-saves');
    await scan();await preview(raw());await form.locator('[name=scanReviewed]').check();await flightTab(p,'tools');await form.locator('[name=confirmed]').check();await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});
    await open();await scan();await preview(raw('VN9911','06:01'));await form.locator('[name=scanReviewed]').check();await flightTab(p,'tools');await form.locator('[name=confirmed]').check();await p.locator('.fe-save').click();assert.equal(await form.isVisible(),true);assert.match(await form.locator('[data-error]').innerText(),/bảo vệ|cho phép/i);
    await form.locator('[name=replaceConfirmed]').check();await form.locator('[name=revisionReason]').fill('Synthetic QA correction');await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});
    await open();assert.equal(await form.locator('[name=a_out]').inputValue(),'06:01');assert.equal(await form.getAttribute('data-id'),id);await p.locator('#modal [data-action=close]').first().click();assert.equal(await p.locator(`[data-action=edit][data-id="${id}"]`).count(),1);
    // The global entry remains available; no stale per-flight target leaks into it.
    await p.locator('#app [data-action=image]:visible').first().click();await p.locator('#image-date').waitFor();assert.equal(await p.locator('[data-image-flight-target]').count(),0);await p.locator('#modal [data-action=close]').first().click();
    // Aircraft family is taken from the selected saved flight.
    await open();await form.locator('[name=aircraft]').selectOption('E190');await flightTab(p,'tools');await form.locator('[name=replaceConfirmed]').check();await form.locator('[name=revisionReason]').fill('Synthetic QA family');await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});await open();await scan();assert.equal(await p.locator('[name=family]').inputValue(),'E190');await p.locator('[data-action=image-cancel]').last().click();
    // Invalid target never falls through to a new unbound record.
    await action.evaluate(n=>n.dataset.id='deleted-synthetic-target');await action.click();assert.equal(await p.locator('#image-date').count(),0);assert.equal(await form.getAttribute('data-id'),id);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);report.checks.push(`${engineName} ${width}px ${theme}: target, draft/evidence guard, cancellation, mismatch, parser preview, FINAL, no duplication and global fallback`);
   }catch(e){await p.screenshot({path:path.join(out,`${engineName}-${width}-${theme}-failure.png`),fullPage:true}).catch(()=>{});throw e;}finally{await context.close();}
  }}finally{await browser.close();}
 }}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;}
 finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
