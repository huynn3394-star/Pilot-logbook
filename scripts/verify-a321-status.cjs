/* Synthetic local records and OCR text only. No user photo or cloud writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {pageManage,flightTab}=require('./ui-controls.cjs');
const out=path.resolve('test-results/a321-status');
const fixture=`AOC 0001 STATUS 1/3\nFLIGHT ID ORIG/DEST\nVN9911 VVTS/VVCI\nRETURN UTC DATE\n----Z 1355 25OCT26\nOUT OFF\n11512 12042\nIN < ON\n13522 1342Z\nBLOCK FLIGHT\n0201 0138\nRETURN TO\n<AOC MENU PRINT*`;
(async()=>{
 await fs.mkdir(out,{recursive:true});const report={scope:'Synthetic guest records and OCR text; not camera, real-image recognition or live cloud verification',checks:[],errors:[]};
 const {createServer}=await import('../server.js');const server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const [name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width:390,height:1000}}),p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await p.route('**/api/weather**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"synthetic test"}'}));
    await p.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();
    await p.evaluate(async t=>(await import('/lib/appearance.js')).setAppearance({theme:t}),theme);
    await p.locator('[data-tab=logbook]:visible').first().click();await pageManage(p);await p.locator('[data-action=add]:visible').click();
    const form=p.locator('#flight-form');await form.waitFor();
    for(const [key,value]of Object.entries({flightNo:'VN9911',date:'2026-10-25',dep:'SGN',dest:'HPH',reg:'VN-A999'}))await form.locator(`[name=${key}]`).fill(value);
    await form.locator('[name=aircraft]').selectOption('A321');const id=await form.getAttribute('data-id');
    await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});
    const open=async()=>{await p.locator(`[data-action=edit][data-id="${id}"]`).click();await form.waitFor();};
    const scan=async()=>{await p.locator('[data-flight-log-scan]').click();await p.locator('#image-text').waitFor();assert.equal(await p.locator('[name=family]').inputValue(),'A320');};
    const preview=async text=>{await p.locator('#image-text').fill(text);await p.locator('[data-action=image-parse]').click();};
    await open();await scan();await preview(fixture.replace('VN9911','VN9916'));
    assert.equal(await form.count(),0);assert.match(await p.locator('#modal [data-error]').innerText(),/không khớp/);
    await preview(fixture);await form.waitFor();assert.equal(await form.getAttribute('data-id'),id);
    for(const [key,value]of Object.entries({a_out:'11:51',a_off:'12:04',a_on:'13:42',a_in:'13:52',dep:'SGN',dest:'HPH',date:'2026-10-25',flightNo:'VN9911'}))assert.equal(await form.locator(`[name=${key}]`).inputValue(),value,key);
    assert.match(await form.textContent(),/2.*Z/);
    await p.screenshot({path:path.join(out,`${name}-${theme}.png`)});
    await p.locator('#modal [data-action=close]').first().click();await open();assert.equal(await form.locator('[name=a_out]').inputValue(),'','Scan preview never auto-saves');
    await scan();await preview(fixture);await form.locator('[name=scanReviewed]').check();await flightTab(p,'tools');assert.equal(await form.locator('[name=confirmed]').isChecked(),false);
    await p.locator('.fe-save').click();await p.locator('#modal').waitFor({state:'hidden'});await open();assert.equal(await form.locator('[name=a_out]').inputValue(),'11:51');assert.equal(await form.locator('[name=a_in]').inputValue(),'13:52');assert.equal(await form.getAttribute('data-id'),id);
    assert.deepEqual(errors,[]);report.checks.push(`${name} ${theme}: A320 family, STATUS pairing, repairs visible, wrong flight blocked, UTC ignored, draft-only preview and target-only save`);
   }finally{await context.close();}
  }}finally{await browser.close();}
 }}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;}
 finally{await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await new Promise(r=>{server.close(r);server.closeAllConnections();});}
})();
