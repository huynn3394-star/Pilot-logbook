/* Synthetic local pilot records. No external account or provider writes. */
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {navigate,flightCrew}=require('./ui-controls.cjs');
(async()=>{
 const {createServer}=await import('../server.js'),out=path.resolve('test-results/wader-v5');await fs.mkdir(out,{recursive:true});
 const server=createServer({firebaseConfig:{enabled:false},weather:{get:async station=>({station,provider:'UI fixture',fetchedAt:'2026-10-23T10:05:00Z',metar:`METAR ${station} 231000Z 02004KT 9999 FEW027 29/24 Q1012=`,taf:`TAF ${station} 230500Z 2306/2406 07008KT 9999 FEW020 TEMPO 2322/2401 4000 SHRA BKN013=`,sources:{metar:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,taf:`https://aviationweather.gov/api/data/taf?ids=${station}&format=raw`}})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,results=[];
 const fits=async(page,selector='html')=>{const bad=await page.locator(selector).evaluate(n=>({scroll:n.scrollWidth,width:n.clientWidth}));assert(bad.scroll<=bad.width+2,selector+' overflows: '+JSON.stringify(bad));};
 const read=page=>page.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState()));
 try{for(const[name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [320,390,820,1180]){
   const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Ho_Chi_Minh'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
   try{
    await page.clock.setFixedTime(new Date('2026-10-23T10:10:00Z'));
    await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await page.goto(origin+'/?tab=logbook');await page.locator('[data-flight-card]').first().waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.nv-flight-card')).borderRadius==='22px');await fits(page);
    const original=await read(page);assert.equal(await page.locator('[data-flight-card]').count(),JSON.parse(original).flights.filter(f=>f.date.startsWith('2026-10')).length);

    if(width<=720){
     const dock=page.locator('[data-mobile-dock]');
     assert(await dock.isVisible());assert(!await page.locator('.sidebar').isVisible());
     const layout=await dock.evaluate(node=>({width:node.getBoundingClientRect().width,bottom:innerHeight-node.getBoundingClientRect().bottom,items:[...node.children].map(child=>({width:child.getBoundingClientRect().width,height:child.getBoundingClientRect().height}))}));
     assert.equal(layout.width,width);assert(Math.abs(layout.bottom)<=1);
     assert.equal(layout.items.length,5);assert(layout.items.every(item=>item.width>=44&&item.height>=44));
     assert.equal(await dock.locator('[aria-current=page]').getAttribute('data-tab'),'logbook');
     await dock.locator('[data-tab=weather]').click();
     assert.equal(await dock.locator('[aria-current=page]').getAttribute('data-tab'),'weather');
     await dock.locator('[data-tab=logbook]').click();
    }
    else{assert(await page.locator('.w5-detail-pane').isVisible());assert(await page.locator('.sidebar').isVisible());}
    await page.screenshot({path:path.join(out,`${name}-${width}-logbook.png`),fullPage:true});
    await page.locator('[data-filter=search]').fill('VN0605');assert.equal(await page.locator('[data-flight-card]').count(),1);await page.locator('[data-filter=search]').fill('');
    await page.locator('[data-action=navy-filters]').click();await page.locator('[name=status]').selectOption('confirmed');await fits(page,'#modal');await page.screenshot({path:path.join(out,`${name}-${width}-filters.png`)});await page.locator('[data-navy-filter-apply]').click();assert.equal(await read(page),original);
    await page.locator('[data-action=navy-filters]').click();await page.locator('[data-navy-filter-clear]').click();await page.locator('[data-navy-filter-apply]').click();
    await page.locator('[data-action=edit][data-id=demo-605]').first().click();await page.locator('[name=note]').fill('Wader V5 verified');
    await fits(page,'#modal');assert(await page.locator('.fe-save').isVisible());
    await page.locator('.flight-editor-form').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(out,`${name}-${width}-editor.png`)});
    await page.locator('[data-flight-tab=airports]').click();await page.locator('[data-flight-tab=log]').click();assert.equal(await page.locator('[name=note]').inputValue(),'Wader V5 verified');
    await page.locator('.nv-count-card').scrollIntoViewIfNeeded();await fits(page,'#modal');if(width===390)await page.screenshot({path:path.join(out,`${name}-${width}-counters.png`)});
    await page.locator('.fe-save').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
    const changed=JSON.parse(await read(page)),before=JSON.parse(original),saved=changed.flights.find(f=>f.id==='demo-605'),old=before.flights.find(f=>f.id==='demo-605');assert.equal(saved.note,'Wader V5 verified');assert.deepEqual(saved.actual,old.actual);assert.equal(changed.flights.length,before.flights.length);
    if(width===390){
     await page.locator('.nv-floating-add').click();await page.locator('[name=flightNo]').fill('VN9988');await page.locator('[name=date]').fill('2026-10-31');await page.locator('[name=dep]').fill('SGN');await page.locator('[name=dest]').fill('HAN');
     assert.equal(await page.locator('#flight-form > .fe-tabs').evaluate(node=>node===node.parentElement.firstElementChild&&getComputedStyle(node).position==='sticky'),true);
     assert.deepEqual(await page.locator('.fe-actual-grid .fe-web-label:visible').allTextContents(),['OUT','ON','OFF','IN']);
     for(const [key,date,time]of [['out','2026-10-31','2350'],['off','2026-11-01','0000'],['on','2026-11-01','0100'],['in','2026-11-01','0110']]){await page.locator('[name=a_'+key+'_date]').fill(date);await page.locator('[name=a_'+key+']').fill(time);await page.locator('[name=a_'+key+']').blur();}
     await page.getByRole('button',{name:'Tăng Takeoff ngày · số lần',exact:true}).click();assert.equal(await page.locator('[name=log_takeoffDay]').inputValue(),'1');await fits(page,'#modal');
     assert.equal(await page.locator('[data-fe-total=block]').innerText(),'01:20');assert.equal(await page.locator('[data-fe-total=airborne]').innerText(),'01:00');
     await page.locator('.fe-save').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);const added=JSON.parse(await read(page)).flights.find(f=>f.flightNo==='VN9988');assert.equal(added.actual.out,'2026-10-31T23:50:00.000Z');assert.equal(added.actual.in,'2026-11-01T01:10:00.000Z');assert.equal(added.logbook.takeoffDay,1);assert.equal(added.confirmed,false);
    }
    await page.locator('[data-action=navy-management]').click();await page.getByRole('heading',{name:'Quản lý Logbook',exact:true}).waitFor();await page.keyboard.press('Escape');
    for(const tab of ['weather','statistics','crew','schedule','settings']){await navigate(page,tab);await fits(page);if(tab==='statistics'){assert(await page.locator('.w5-dashboard').isVisible());assert(await page.locator('.w5-route-map').isVisible());}if(tab==='schedule'){assert(await page.locator('.w5-briefing').isVisible());await page.locator('[data-action=w5-map]').click();await page.getByRole('heading',{name:'Route map',exact:true}).waitFor();await page.keyboard.press('Escape');}if(width===390||width===1180)await page.screenshot({path:path.join(out,`${name}-${width}-${tab}.png`),fullPage:true});}
    await navigate(page,'logbook');await page.locator('[data-flight-card]').first().waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    if(name==='chromium'){await context.setOffline(true);assert.equal(await page.evaluate(()=>fetch('/api/health',{cache:'no-store'}).then(()=>false,()=>true)),true);await page.reload();await page.locator('[data-flight-card]').first().waitFor();assert.equal(JSON.parse(await read(page)).flights.find(f=>f.id==='demo-605').note,'Wader V5 verified');}
    if(width===390||width===1180){if(name==='chromium')await context.setOffline(false);await page.evaluate(async()=>{(await import('/lib/appearance.js')).setAppearance({theme:'light'});});await fits(page);await page.screenshot({path:path.join(out,`${name}-${width}-light.png`),fullPage:true});}
    assert.deepEqual(errors,[]);results.push({browser:name,width,search:true,filterNoDataMutation:true,editorSave:true,timePrecisionPreserved:true,navigation:true,overflow:false,offlineReload:name==='chromium'});console.log(name,width,'passed');
   }catch(error){await page.screenshot({path:path.join(out,`${name}-${width}-failure.png`),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
