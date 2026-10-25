/* Isolated guest/browser checks. Never uses production credentials or user records. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const root=path.resolve('test-results/shared-ui');
const report={scope:'Hosted Chromium/WebKit guest contexts; not physical iOS or live-account validation',checks:[],errors:[]};
function lum(s){const m=s.match(/[\d.]+/g);assert(m&&m.length>=3,s);return m.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
(async()=>{
 await fs.mkdir(root,{recursive:true});
 const {createServer}=await import('../server.js');
 const server=createServer();let unavailable=false;
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 async function verify(p,label,theme,cardSelector){
  await p.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim()==='avilog-shared-v1',null,{timeout:5000});
  const values=await p.evaluate(sel=>{
   const cs=n=>getComputedStyle(n),r=cs(document.documentElement),card=document.querySelector(sel);
   return {accent:r.getPropertyValue('--accent').trim(),brand:r.getPropertyValue('--dark').trim(),text:r.getPropertyValue('--ink').trim(),paper:r.getPropertyValue('--paper').trim(),muted:r.getPropertyValue('--ui-muted').trim(),font:cs(document.body).fontFamily,overflow:document.documentElement.scrollWidth>innerWidth+2,card:card&&{radius:cs(card).borderRadius,background:cs(card).backgroundColor},token:r.getPropertyValue('--ui-radius-card').trim()};
  },cardSelector);
  assert.equal(values.brand,'#142744',label+' navy preserved');
  assert.equal(values.accent,theme==='dark'?'#2dd4bf':'#0f766e',label+' one accent');
  assert(values.font.includes('DM Sans'),label+' common font');
  assert(!values.overflow,label+' horizontal overflow');
  assert(values.card,label+' representative surface exists');
  assert.equal(values.card.radius,'16px',label+' common card radius');
  const cssColor=await p.evaluate(v=>{const n=document.createElement('span');document.body.append(n);const out={};for(const[k,c]of Object.entries(v)){n.style.color=c;out[k]=getComputedStyle(n).color}n.remove();return out},{text:values.text,paper:values.paper,muted:values.muted,accent:values.accent});
  assert.equal(values.card.background,cssColor.paper,label+' common surface / no white leak');
  assert(contrast(cssColor.text,cssColor.paper)>=4.5,label+' text contrast');
  assert(contrast(cssColor.muted,cssColor.paper)>=4.5,label+' secondary contrast');
  assert(contrast(cssColor.accent,cssColor.paper)>=4.5,label+' accent contrast');
  report.checks.push({label,theme,values});
 }
 try{
  for(const[name,engine]of Object.entries({chromium,webkit})){
   const browser=await engine.launch({headless:true});
   try{
    for(const width of [320,390,820,1440]){
     const context=await browser.newContext({viewport:{width,height:1000}}),p=await context.newPage();
     p.setDefaultTimeout(12000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
     try{
      // All tests stay local. Weather requests return no live aviation information.
      await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
      await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();
      for(const theme of ['light','dark']){
       await p.evaluate(async theme=>{const m=await import('/lib/appearance.js');m.setAppearance({theme})},theme);
       for(const tab of ['schedule','logbook','crew','statistics','weather','settings']){
        await p.locator(`[data-action=tab][data-tab=${tab}]:visible`).first().click();
        const card={schedule:'.metric',logbook:'.metric',crew:'.crew-card',statistics:'.metric',weather:'.weather-group',settings:'.settings-section'}[tab];
        if(tab==='weather'&&await p.locator(card).count()===0){await p.evaluate(()=>{const n=document.createElement('div');n.className='panel';n.dataset.uiEmptyProbe='';document.querySelector('[data-weather-watch]').append(n)});}
        await verify(p,`${name} ${width} ${tab}`,theme,tab==='weather'&&await p.locator(card).count()===0?'[data-ui-empty-probe]':card);
        if(width===390)await p.screenshot({path:path.join(root,`${name}-${theme}-${tab}.png`)});
       }
       await p.locator('[data-action=tab][data-tab=logbook]:visible').first().click();
       await require('./ui-controls.cjs').pageManage(p);await p.locator('[data-action=add]:visible').click();
       await p.locator('#flight-form [name=flightNo]').fill('VN9998');
       for(const tab of ['airports','tools','log'])await require('./ui-controls.cjs').flightTab(p,tab);
       assert.equal(await p.locator('#flight-form [name=flightNo]').inputValue(),'VN9998');
       await verify(p,`${name} ${width} flight editor`,theme,'.fe-card');
       await p.locator('#modal [data-action=close]').first().click();
       await p.locator('[data-action=tab][data-tab=atpl]:visible').first().click();await p.waitForURL('**/atpl/');
       await p.locator('[data-bank]').first().waitFor();await verify(p,`${name} ${width} ATPL library`,theme,'.atpl-card');
       const h1=await p.locator('h1').evaluate(n=>getComputedStyle(n).fontSize);assert.equal(h1,width<=720?'24px':'26px');
       if(width===390)await p.screenshot({path:path.join(root,`${name}-${theme}-library.png`)});
       const banks=await p.evaluate(async()=>await(await fetch('/atpl/catalog.json')).json());
       // Every bank on phone; representative POF on narrower/tablet/desktop screens.
       for(const bank of width===390?banks.banks:banks.banks.slice(0,1)){
        await p.goto(origin+bank.url,{waitUntil:'domcontentloaded'});await p.locator('#atpl-offline-button').waitFor();
        await verify(p,`${name} ${width} bank ${bank.code}`,theme,'.hero');
        await p.locator('[data-action=study]').first().click();await p.locator('.answer-option').first().waitFor();
        await verify(p,`${name} ${width} quiz ${bank.code}`,theme,'.qcard');
        const q=await p.evaluate(()=>{const a=Object.values(JSON.parse(document.getElementById('bank-data').textContent))[0].questions;const options=[...document.querySelectorAll('[data-action=answer]')];const id=Number(options[0]?.dataset.qid);return a.find(q=>q.id===id)||a.find(q=>q.valid)});
        // Exercise actual answer controls and retain visible correctness cues; do not rewrite source engine.
        const key=p.locator(`[data-action=answer][data-key="${q.answer}"]`);
        if(await key.count())await key.first().click();else await p.locator('.answer-option').first().click();
        assert(await p.locator('.answer-option.correct,.answer-option.incorrect,.answer-option.selected').count()>0);
        if(width===390&&bank.code==='POF')await p.screenshot({path:path.join(root,`${name}-${theme}-quiz.png`)});
        await require('./ui-controls.cjs').bankManage(p);await p.locator('[data-action=settings]').click();
        await p.locator('#dialog[open]').waitFor();assert(await p.locator('#dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+2));
        await p.keyboard.press('Escape');
       }
       await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();
      }
      assert.deepEqual(errors,[],name+' '+width+' runtime errors');
     }finally{await context.close()}
    }
    const context=await browser.newContext(),p=await context.newPage();
    try{
     await p.goto(origin,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
     const state=await p.evaluate(async()=>{localStorage.setItem('shared-ui-sentinel','keep');const c=await caches.keys();const k=c.find(k=>k.includes('navy-teal-unified'));const cache=k&&await caches.open(k);return{key:k,css:!!(cache&&await cache.match('/ui/system.css')),tokens:!!(cache&&await cache.match('/ui/tokens.css'))}});
     assert(state.css&&state.tokens,'both shared sheets must be precached');
     if(name==='chromium')await context.setOffline(true);else unavailable=true;
     await p.reload({waitUntil:'domcontentloaded'});
     assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim()),'avilog-shared-v1');
     await p.goto(origin+'/atpl/',{waitUntil:'domcontentloaded'});await p.locator('[data-bank]').first().waitFor();
     assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim()),'avilog-shared-v1');
     assert.equal(await p.evaluate(()=>localStorage.getItem('shared-ui-sentinel')),'keep');
     report.checks.push({label:name+' main/library offline with shared stylesheet and retained local data'});
    }finally{unavailable=false;await context.close()}
   }finally{await browser.close()}
  }
 }catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
 finally{await new Promise(r=>server.close(r));await fs.writeFile(path.join(root,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.checks.length,errors:report.errors},null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
