/* Synthetic guest flights in isolated browser contexts; no account or provider writes. */
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {createServer}=await import('../server.js'),out=path.resolve('test-results/flight-night');await fs.mkdir(out,{recursive:true});
 const server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,results=[];
 const read=page=>page.evaluate(async()=>(await import('/lib/storage.js')).readState());
 const value=(page,name)=>page.locator('[name='+name+']').inputValue();
 const fillTime=async(page,key,clock)=>{await page.locator('[name=a_'+key+'_date]').fill('2026-10-23');await page.locator('[name=a_'+key+']').fill(clock);await page.locator('[name=a_'+key+']').blur();};
 const recalculate=async page=>{const card=page.locator('.fe-auto-night');if(!await card.evaluate(n=>n.open))await card.locator('summary').click();await card.locator('[data-night-recalculate]').click();};
 const fits=async page=>{for(const selector of ['html','#modal','.flight-editor-form','.fe-auto-night','.nv-count-card']){const box=await page.locator(selector).evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth}));assert(box.scroll<=box.width+2,selector+' overflows '+JSON.stringify(box));}};
 try{for(const [name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const width of [320,390,820,1180]){
   // A different device timezone proves flight locations, rather than the device clock, drive the result.
   const context=await browser.newContext({viewport:{width,height:1100},timezoneId:'America/Los_Angeles'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
   try{
    await page.clock.setFixedTime(new Date('2026-10-23T10:00:00Z'));
    await page.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await page.goto(origin+'/?tab=logbook');await page.locator('[data-flight-card]').first().waitFor();
    const initial=await read(page),old=initial.flights.find(f=>f.id==='demo-605');
    await page.locator('[data-action=edit][data-id=demo-605]').first().click();
    assert.equal(await value(page,'nightMinutes'),String(old.nightMinutes));assert.equal(await value(page,'log_takeoffDay'),'');
    await page.locator('[name=note]').fill('Night regression: note only');await page.locator('.fe-save').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
    const unchanged=(await read(page)).flights.find(f=>f.id==='demo-605');
    for(const key of ['actual','nightMinutes','logbook','takeoffBy','landingBy'])assert.deepEqual(unchanged[key],old[key],key+' preserved on historical FINAL');

    const openNew=()=>page.locator('[data-action=add]:visible').first().click();
    await openNew();
    if(width>=1040){
     const columns=await page.locator('.fe-column-title').evaluateAll(nodes=>nodes.map(node=>({x:node.getBoundingClientRect().x,w:node.offsetWidth})));
     assert.equal(columns.length,4);assert(columns.every((column,i)=>column.w>0&&(!i||column.x>columns[i-1].x)));
     assert(await page.getByRole('heading',{name:'New Flight'}).isVisible());
     assert(await page.locator('.modal-footer .fe-save').isVisible());
     await page.screenshot({path:path.join(out,`${name}-${width}-new-flight.png`)});
     await page.locator('[data-new-flight-scan]').click();await page.locator('#image-date').waitFor();
     assert.equal(await page.locator('[data-image-flight-target]').count(),0);
     await page.locator('#modal [data-action=close]').first().click();await openNew();
    }
    await page.locator('[name=flightNo]').fill('VN9987');await page.locator('[name=date]').fill('2026-10-23');await page.locator('[name=dep]').fill('SGN');await page.locator('[name=dest]').fill('HAN');
    await page.locator('[name=a_in_date]').fill('2026-10-24');await page.getByRole('button',{name:'Ngày trước'}).click();
    assert.equal(await value(page,'a_out_date'),'2026-10-22');assert.equal(await value(page,'a_in_date'),'2026-10-24');
    await page.getByRole('button',{name:'Ngày sau'}).click();assert.equal(await value(page,'a_out_date'),'2026-10-23');
    assert.equal(await value(page,'nightMinutes'),'');assert.equal(await page.locator('[data-fe-total=night]').innerText(),'—');
    await fillTime(page,'out','1000');await fillTime(page,'in','1210');
    assert.equal(await value(page,'nightMinutes'),'70');assert.equal(await value(page,'log_takeoffDay'),'');assert.equal(await value(page,'log_landingNight'),'');
    await page.getByRole('switch',{name:'Tôi cất cánh'}).click();await page.getByRole('switch',{name:'Tôi hạ cánh'}).click();
    assert.equal(await value(page,'takeoffBy'),'self');assert.equal(await value(page,'landingBy'),'self');
    assert.equal(await value(page,'log_takeoffDay'),''); // OFF is still unknown.
    await fillTime(page,'off','1010');await fillTime(page,'on','1200');
    assert.equal(await value(page,'nightMinutes'),'70');assert.equal(await value(page,'log_takeoffDay'),'1');assert.equal(await value(page,'log_takeoffNight'),'0');assert.equal(await value(page,'log_landingDay'),'0');assert.equal(await value(page,'log_landingNight'),'1');
    await page.locator('[name=nightMinutes]').fill('33');await page.locator('[name=log_takeoffDay]').fill('2');await fillTime(page,'in','1220');
    assert.equal(await value(page,'nightMinutes'),'33');assert.equal(await value(page,'log_takeoffDay'),'2');
    await recalculate(page);assert.equal(await value(page,'nightMinutes'),'80');assert.equal(await value(page,'log_takeoffDay'),'1');
    await page.locator('[name=landingBy]').selectOption('captain');assert.equal(await value(page,'log_landingNight'),'0');assert.equal(await value(page,'log_landingDay'),'0');await page.locator('[name=landingBy]').selectOption('self');
    await fits(page);const columns=await page.locator('.nv-count-field').evaluateAll(fields=>fields.map(n=>({operation:n.dataset.countOperation,x:n.getBoundingClientRect().x,width:n.getBoundingClientRect().width})));assert(columns[1].x>columns[0].x);assert.equal(columns[0].x,columns[2].x);assert.equal(columns[1].x,columns[3].x);
    await page.locator('.nv-count-card').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${name}-${width}.png`)});
    await page.locator('[data-flight-tab=tools]').click();await page.locator('[name=confirmed]').check();await page.locator('.fe-save').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);
    const saved=(await read(page)).flights.find(f=>f.flightNo==='VN9987');assert.equal(saved.nightMinutes,80);assert.equal(saved.logbook.takeoffDay,1);assert.equal(saved.logbook.landingNight,1);assert.equal(saved.confirmed,true);
    await page.reload();await page.locator('[data-action=edit][data-id="'+saved.id+'"]').first().click();assert.equal(await value(page,'nightMinutes'),'80');
    await fillTime(page,'in','1230');assert.equal(await value(page,'nightMinutes'),'80'); // Saved values remain stable until explicit recalculation.
    await recalculate(page);assert.equal(await value(page,'nightMinutes'),'90');
    await page.locator('.fe-save').click();await page.locator('[data-error]:visible').waitFor();assert.match(await page.locator('[data-error]').innerText(),/được bảo vệ/);
    assert.deepEqual((await read(page)).flights.find(f=>f.id===saved.id),saved);
    page.once('dialog',dialog=>dialog.accept());await page.locator('#modal .fe-close').click();await page.locator('#modal').waitFor({state:'hidden'});
    if(width>=1040){
     await openNew();await page.locator('[name=flightNo]').fill('VN9985');await page.locator('[name=dep]').fill('SGN');await page.locator('[name=dest]').fill('HAN');
     await page.locator('[data-fe-save-mode=return]').click();await page.waitForFunction(()=>document.querySelector('[name=flightNo]')?.value==='');
     assert.equal(await value(page,'dep'),'HAN');assert.equal(await value(page,'dest'),'SGN');assert.equal(await value(page,'a_out'),'');
     await page.locator('[name=flightNo]').fill('VN9986');await page.locator('[data-fe-save-mode=next]').click();await page.waitForFunction(()=>document.querySelector('[name=flightNo]')?.value==='');
     assert.equal(await value(page,'dep'),'SGN');assert.equal(await value(page,'dest'),'');
     const continued=(await read(page)).flights.filter(f=>['VN9985','VN9986'].includes(f.flightNo));
     assert.equal(continued.length,2);assert(continued.every(f=>!f.confirmed&&Object.keys(f.actual).length===0));
     await page.locator('#modal .fe-close').click();await page.locator('#modal').waitFor({state:'hidden'});
    }
    let offline=false;
    if(name==='chromium'){
     await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await page.locator('[data-action=add]:visible').first().click();
     await page.locator('[name=dep]').fill('SGN');await page.locator('[name=dest]').fill('HAN');await fillTime(page,'out','1000');await fillTime(page,'in','1210');assert.equal(await value(page,'nightMinutes'),'70');offline=true;
    }
    assert.deepEqual(errors,[]);results.push({browser:name,width,autoNight:true,personalEvents:true,manualOverride:true,historicalFinalPreserved:true,finalGuard:true,savedReload:true,offline,overflow:false});console.log(name,width,'passed');
   }catch(error){await page.screenshot({path:path.join(out,`${name}-${width}-failure.png`)}).catch(()=>{});throw error;}finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(results,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
