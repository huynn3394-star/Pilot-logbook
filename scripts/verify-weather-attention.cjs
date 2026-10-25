/* Synthetic weather on a local server only; no user records, provider login or cloud writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const {weatherManage}=require('./ui-controls.cjs');
const NOW='2026-10-25T03:00:00Z',out=path.resolve('test-results/weather-attention');
const report={scope:'Local guest app with synthetic weather, Chromium/WebKit; not physical iOS or live provider validation',checks:[],errors:[],diagnostics:[]};
let mode='speci',unavailable=false;
function observation(station){return (mode==='regular'||station==='VVNB'?'METAR ':'SPECI ')+station+' 250255Z '+(station==='VVTS'?'23012KT 3000 +TSRA BKN020CB 25/24 Q1010=':'00000KT 9999 SCT020 25/24 Q1010=');}
function forecast(station){return `TAF ${station} 250230Z 2503/2603 23008KT 9999 SCT020 TEMPO 2503/2505 3000 -TSRA FEW015CB=`;}
function fixture(station){return{station,provider:'SYNTHETIC QA DATA',fetchedAt:'2026-10-25T02:59:00Z',metar:observation(station),taf:forecast(station),sources:{metar:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,taf:`https://aviationweather.gov/api/data/taf?ids=${station}&format=raw`}};}
function contrast(a,b){const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function savedLabelGeometry(row){
 const result=await row.evaluate(n=>{const s=n.querySelector('summary'),identity=s.querySelector('.weather-station-identity'),saved=s.querySelector('.weather-row-saved'),name=identity?.querySelector('strong'),brief=s.querySelector('.weather-row-brief');if(!identity||!saved||!name||!brief)return {ok:false,reason:'missing identity/saved label'};const a=name.getBoundingClientRect(),b=saved.getBoundingClientRect(),c=brief.getBoundingClientRect();return{ok:saved.parentElement===identity&&b.top>=a.bottom-1&&Math.abs(b.left-a.left)<1&&b.right<=c.left&&Math.abs(a.top-c.top)<2,airport:{x:a.x,y:a.y},saved:{x:b.x,y:b.y},brief:{x:c.x,y:c.y},label:saved.textContent};});
 assert(result.ok,JSON.stringify(result));assert.equal(result.label,'Bản lưu');return result;
}
(async()=>{
 await fs.mkdir(out,{recursive:true});const{createServer}=await import('../server.js');
 const server=createServer({firebaseConfig:{enabled:false},weather:{get:async station=>{if(mode==='error')throw Error('Synthetic unavailable');return fixture(station);}}});
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const[name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const width of [320,390,820])for(const theme of ['light','dark']){
   mode='speci';unavailable=false;const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await p.clock.setFixedTime(new Date(NOW));
    await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();await p.evaluate(async theme=>(await import('/lib/appearance.js')).setAppearance({theme}),theme);
    const add=async(station,group)=>{await weatherManage(p);if(group)await p.getByLabel('Nhóm sân bay',{exact:true}).selectOption({label:group});await p.getByLabel('Thêm sân bay (ICAO hoặc IATA)').fill(station);await p.getByRole('button',{name:'Thêm sân bay',exact:true}).click();await p.locator(`[data-weather-station=${station}]`).filter({hasText:'Q1010='}).first().waitFor({state:'attached'});};
    await add('VVTS');await add('VVNB');await weatherManage(p);await p.getByLabel('Tên nhóm mới',{exact:true}).fill('Quốc tế');await p.getByRole('button',{name:'Tạo nhóm',exact:true}).click();await p.locator('.weather-group-heading').filter({hasText:'Quốc tế'}).waitFor();await add('WSSS','Quốc tế');await add('VVTS','Quốc tế');
    await p.waitForFunction(()=>document.querySelectorAll('[data-weather-station=VVTS]').length===2);await p.waitForFunction(()=>!document.querySelector('[data-watch-refresh]').disabled);
    const menu=p.locator('[data-weather-manage]');if(await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();
    const banner=p.locator('[data-weather-speci]');assert.equal(await banner.isVisible(),true);assert.equal(await banner.locator('[data-speci-open]').count(),2);assert.equal(await banner.locator('[data-speci-open=VVNB]').count(),0);
    assert.equal(await p.locator('.weather-row-saved').count(),0,'Fresh fixtures need no saved label');
    for(const summary of await p.locator('.weather-group-heading').all())if(await summary.evaluate(n=>n.parentElement.open))await summary.click();
    assert.equal(await banner.isVisible(),true,'Collapsed folders must not hide SPECI');assert(await p.evaluate(()=>document.querySelector('[data-weather-speci]').getBoundingClientRect().top<document.querySelector('.weather-watch-toolbar').getBoundingClientRect().top));
    await p.locator('[data-speci-open=VVTS]').click();const row=p.locator('[data-weather-station=VVTS]').first();assert(await row.evaluate(n=>n.open&&n.closest('[data-weather-group]').querySelector(':scope>details').open));assert(await row.getAttribute('class').then(v=>v.includes('weather-has-speci')));assert.equal(await row.locator('.weather-product h3').first().innerText(),'SPECI');
    assert.equal(await row.locator('pre.weather-report').nth(0).textContent(),observation('VVTS'));assert.equal(await row.locator('pre.weather-report').nth(1).textContent(),forecast('VVTS'));
    assert.deepEqual(await row.locator('pre.weather-report').nth(0).locator('mark').allTextContents(),['+TSRA','CB']);assert.deepEqual(await row.locator('pre.weather-report').nth(1).locator('mark').allTextContents(),['-TSRA','CB']);
    assert.equal(await row.locator('.weather-row-brief mark').count(),2);assert.equal(await p.locator('[data-weather-station=VVNB]').getAttribute('class').then(v=>v.includes('weather-has-speci')),false);
    const colors=await row.locator('mark').first().evaluate(n=>({fg:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor}));assert(contrast(colors.fg,colors.bg)>=4.5);assert.equal(colors.fg,theme==='dark'?'rgb(253, 164, 175)':'rgb(180, 35, 58)');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    const raw='METAR VVTS 250255Z +TSRA BKN020CB\n<img src=x onerror="window.__weatherXSS=1"> & CB=';
    await p.evaluate(raw=>{const d=document.querySelector('#modal'),pre=document.createElement('pre');pre.className='weather-report';pre.textContent=raw;d.replaceChildren(pre);d.showModal();},raw);
    await p.waitForFunction(()=>document.querySelectorAll('#modal .weather-attention-word').length===3);assert.equal(await p.locator('#modal pre').textContent(),raw);assert.equal(await p.locator('#modal img').count(),0);assert.equal(await p.evaluate(()=>window.__weatherXSS),undefined);await p.evaluate(()=>document.querySelector('#modal').close());
    const refresh=async()=>{await p.getByRole('button',{name:'Cập nhật tất cả',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('[data-watch-refresh]').disabled);};
    mode='error';await refresh();await banner.filter({hasText:'CHƯA CẬP NHẬT ĐƯỢC'}).waitFor();assert.equal(await banner.locator('[data-speci-open]').count(),2);
    await savedLabelGeometry(row);await savedLabelGeometry(p.locator('[data-weather-station=VVNB]'));
    if(width===390){await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(out,`${name}-${theme}.png`),fullPage:true});}
    mode='regular';await refresh();await banner.waitFor({state:'hidden'});assert.equal(await p.locator('.weather-has-speci').count(),0);assert(await row.locator('mark').count()>0,'TSRA/CB still highlight without SPECI');assert.equal(await p.locator('.weather-row-saved').count(),0);
    mode='speci';await refresh();await banner.waitFor();await p.waitForFunction(()=>!!navigator.serviceWorker.controller);const shell=await p.evaluate(async()=>{const keys=await caches.keys(),k=keys.find(x=>x.includes('unified-weather-attention'));const c=k&&await caches.open(k);return !!c&&!!await c.match('/ui/weather-attention.css')&&!!await c.match('/workspace/weather-attention.js')&&!!await c.match('/ui/weather-report-highlights.js');});assert(shell);
    await p.locator('[data-action=tab][data-tab=logbook]:visible').first().click();assert.equal(await p.locator('[data-weather-speci]').count(),0,'The SPECI panel is restricted to Weather');await p.locator('[data-action=tab][data-tab=weather]:visible').first().click();await banner.waitFor();
    // Refuse real origin connections for both engines so cached reload cannot pass online.
    unavailable=true;
    if(name==='chromium'){await context.setOffline(true);await banner.filter({hasText:'OFFLINE'}).waitFor();}
    report.diagnostics.push({name,width,theme,phase:'before-offline-reload',online:await p.evaluate(()=>navigator.onLine),flags:await banner.innerText()});
    await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-weather-speci]').waitFor();
    const onlineAfterReload=await p.evaluate(()=>navigator.onLine);
    report.diagnostics.push({name,width,theme,phase:'after-offline-reload',online:onlineAfterReload,flags:await p.locator('[data-weather-speci]').innerText()});
    assert.equal(await p.locator('[data-weather-speci] [data-speci-open]').count(),2);
    // Runner evidence: Chromium 151 restores navigator.onLine on SW reload. Reapply
    // the browser emulation, not an application/mock override; origin stays stopped.
    if(name==='chromium'){
     if(onlineAfterReload){await context.setOffline(false);await context.setOffline(true);}
     await p.waitForFunction(()=>navigator.onLine===false,undefined,{timeout:10000});
     await p.locator('[data-weather-speci]').filter({hasText:'OFFLINE'}).waitFor();
    }else {await p.getByRole('button',{name:'Cập nhật tất cả',exact:true}).click();await p.locator('[data-weather-speci]').filter({hasText:'CHƯA CẬP NHẬT ĐƯỢC'}).waitFor();}
    assert(await p.evaluate(async()=>{try{await fetch('/api/health?offline-probe='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(4000)});return false;}catch{return true;}}),'An uncached API must be unreachable');
    await p.locator('[data-speci-open=VVTS]').click();await savedLabelGeometry(p.locator('[data-weather-station=VVTS]').first());
    assert(await p.locator('.weather-row-brief mark').count()>0);assert.deepEqual(errors,[]);report.checks.push(`${name} ${width}px ${theme}: groups, deduplication, top-only SPECI, saved-label geometry, raw text, modal XSS, replacement/error and offline`);
   }finally{unavailable=false;await context.close();}
  }}finally{await browser.close();}
 }}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;}
 finally{await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
