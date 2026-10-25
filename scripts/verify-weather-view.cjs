/* Synthetic local guest records only; real app controls, no live account/provider writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {weatherManage}=require('./ui-controls.cjs');
const out=path.resolve('test-results/weather-view');
const report={scope:'Hosted Chromium/WebKit; saved-airport UI, no physical device or live cloud test',checks:[],errors:[]};
const NOW='2026-10-25T11:00:00.000Z';
(async()=>{
 await fs.mkdir(out,{recursive:true});const {createServer}=await import('../server.js');let calls=0,unavailable=false;
 const server=createServer({firebaseConfig:{enabled:false},weather:{get:async station=>{calls++;return{station,provider:'Synthetic UI fixture',fetchedAt:NOW,metar:station==='VTBS'?null:`${station==='VVTS'?'SPECI':'METAR'} ${station} 251055Z 23012KT 3000 TSRA BKN020CB 25/24 Q1010=`,taf:station==='VVCI'?null:`TAF ${station} 251000Z 2511/2611 24008KT 9999 SCT020 TEMPO 2511/2514 2000 +TSRA BKN015CB=`,sources:{metar:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,taf:`https://aviationweather.gov/api/data/taf?ids=${station}&format=raw`}};}}});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const[name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const width of [320,390,820])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await p.clock.setFixedTime(new Date(NOW));
    await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();await p.evaluate(async theme=>(await import('/lib/appearance.js')).setAppearance({theme}),theme);
    const group=label=>p.locator('[data-weather-group]').filter({has:p.locator('.weather-group-heading>span:first-of-type').filter({hasText:label})});
    const create=async label=>{await weatherManage(p);await p.getByLabel('Tên nhóm mới',{exact:true}).fill(label);await p.getByRole('button',{name:'Tạo nhóm',exact:true}).click();await group(label).waitFor();};
    const add=async(label,station)=>{await weatherManage(p);await p.getByLabel('Nhóm sân bay',{exact:true}).selectOption({label});await p.getByLabel('Thêm sân bay (ICAO hoặc IATA)',{exact:true}).fill(station);await p.getByRole('button',{name:'Thêm sân bay',exact:true}).click();await group(label).locator('[data-weather-station='+station+']').filter({hasText:station==='VTBS'?'TAF VTBS':'251055Z'}).waitFor();await p.waitForFunction(()=>!document.querySelector('[data-watch-refresh]').disabled);};
    await create('Quốc nội');for(const station of ['VVTS','VVNB','VVCI'])await add('Quốc nội',station);
    await create('Quốc tế');for(const station of ['WSSS','VTBS','VVTS'])await add('Quốc tế',station);
    const manage=p.locator('[data-weather-manage]');if(await manage.evaluate(n=>n.open))await manage.locator(':scope>summary').click();
    const dom=group('Quốc nội'),intl=group('Quốc tế'),search=p.locator('[data-weather-search]');
    const preview=(g,station)=>g.locator('[data-weather-station='+station+']>summary [data-weather-preview]');
    const select=async(g,product)=>g.locator('[data-weather-product='+product+']').click();
    const saved=()=>p.evaluate(async()=>{const db=await(await import('/lib/storage.js')).connect();return await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').getAll();r.onsuccess=()=>resolve(JSON.stringify(r.result));r.onerror=()=>reject(r.error);});});
    const before=await saved(),beforeCalls=calls;
    assert.match(await preview(dom,'VVTS').innerText(),/^SPECI/);assert.match(await preview(intl,'VTBS').innerText(),/Chưa có METAR/);assert.doesNotMatch(await preview(intl,'VTBS').innerText(),/TAF VTBS/);
    await select(intl,'taf');assert.match(await preview(intl,'VTBS').innerText(),/^TAF/);assert.match(await preview(intl,'WSSS').innerText(),/^TAF/);assert.equal(await preview(dom,'VVNB').getAttribute('data-weather-preview'),'metar');
    await select(dom,'taf');assert.match(await preview(dom,'VVCI').innerText(),/Chưa có TAF/);assert(await preview(dom,'VVTS').locator('mark').count()>0);assert.equal(await p.locator('[data-speci-open=VVTS]').count(),1);
    const toolbar=await p.evaluate(()=>{const a=document.querySelector('.weather-quick-search').getBoundingClientRect(),b=document.querySelector('[data-watch-refresh]').getBoundingClientRect();return{sameRow:Math.abs(a.y+a.height/2-b.y-b.height/2)<3,fit:Math.max(a.right,b.right)<=innerWidth+1};});assert(toolbar.sameRow&&toolbar.fit,'Search and update belong to one toolbar row');
    for(const g of [dom,intl]){const buttons=await g.locator('[data-weather-product]').evaluateAll(ns=>ns.map(n=>({height:n.getBoundingClientRect().height,pressed:n.getAttribute('aria-pressed')})));assert(buttons.every(x=>x.height>=44));assert.equal(buttons.filter(x=>x.pressed==='true').length,1);}
    if(width===390)await p.screenshot({path:path.join(out,`${name}-${theme}.png`),fullPage:true});
    await dom.locator('.weather-group-heading>span:first-of-type').click();assert.equal(await dom.locator(':scope>details').evaluate(n=>n.open),false);
    await select(dom,'metar');assert.equal(await dom.locator(':scope>details').evaluate(n=>n.open),false,'Product button must not toggle the folder');
    await search.fill('vvn');assert.equal(await dom.locator(':scope>details').evaluate(n=>n.open),true);assert.equal(await p.locator('[data-weather-station]:visible').count(),1);assert.equal(await p.locator('[data-weather-station]:visible').getAttribute('data-weather-station'),'VVNB');assert.equal(await search.evaluate(n=>document.activeElement===n),true);
    await search.fill('SGN');assert.equal(await p.locator('[data-weather-station]:visible').count(),2);assert.match(await p.locator('[data-weather-search-status]').innerText(),/^1 sân bay/);
    await search.press('Escape');assert.equal(await search.inputValue(),'');assert.equal(await dom.locator(':scope>details').evaluate(n=>n.open),false,'Clearing restores previously collapsed folder');
    await search.fill('ZZZZ');assert.equal(await p.locator('[data-weather-station]:visible').count(),0);assert.match(await p.locator('[data-weather-search-status]').innerText(),/Không tìm thấy/);assert.equal(await p.locator('[data-weather-speci]').isVisible(),true);
    await p.locator('[data-speci-open=VVTS]').click();assert.equal(await search.inputValue(),'');assert.equal(await dom.locator('[data-weather-station=VVTS]').evaluate(n=>n.open),true);assert.equal(await dom.isVisible(),true);
    assert.equal(calls,beforeCalls,'Switching and searching make no provider calls');assert.equal(await saved(),before,'View controls do not change saved user records');
    await search.fill('VVNB');await p.evaluate(()=>{window.__searchNode=document.querySelector('[data-weather-search]');document.querySelector('[data-watch-refresh]').click();window.__searchNode.focus();});await p.waitForFunction(()=>!document.querySelector('[data-watch-refresh]').disabled);
    assert.equal(await search.inputValue(),'VVNB');assert(await search.evaluate(n=>document.activeElement===n&&window.__searchNode===n),'Refresh preserves typing focus and search node');assert.equal(await intl.locator('[data-weather-product=taf]').getAttribute('aria-pressed'),'true');
    await p.locator('[data-tab=logbook]:visible').first().click();await p.locator('[data-tab=weather]:visible').first().click();await search.waitFor();assert.equal(await search.inputValue(),'VVNB');assert.equal(await intl.locator('[data-weather-product=taf]').getAttribute('aria-pressed'),'true');
    await p.locator('[data-weather-search-clear]').click();assert.equal(await search.inputValue(),'');
    await p.waitForFunction(()=>!!navigator.serviceWorker.controller);if(name==='chromium')await context.setOffline(true);else unavailable=true;
    assert(await p.evaluate(()=>fetch('/api/health',{cache:'no-store'}).then(()=>false).catch(()=>true)),'Offline probe must fail');
    const offlineCalls=calls;await select(intl,'metar');await search.fill('SIN');assert.equal(await p.locator('[data-weather-station]:visible').count(),1);assert.match(await preview(intl,'WSSS').innerText(),/^METAR/);assert.equal(calls,offlineCalls);
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'No horizontal overflow');assert.deepEqual(errors,[]);
    report.checks.push({name,width,theme,toolbar,checks:'folder independence, strict missing products, raw highlights, stable search/focus, unique result counts, collapse restore, unfiltered SPECI, no storage writes, refresh/remount and offline'});
   }catch(e){await p.screenshot({path:path.join(out,`${name}-${width}-${theme}-failure.png`),fullPage:true}).catch(()=>{});throw e;}finally{unavailable=false;await context.close();}
  }}finally{await browser.close();}
 }}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;}
 finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
