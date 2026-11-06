/* Shared frame E2E with synthetic guest progress. No live account writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
(async()=>{
 const out=path.resolve('test-results/study-shell');await fs.mkdir(out,{recursive:true});const report={checks:[],errors:[],scope:'Local guest UI/quiz/offline; source-bank integrity checked by unit and existing all-bank suite'};
 const {createServer}=await import('../server.js'),server=createServer({firebaseConfig:{enabled:false}});let unavailable=false;const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let label;
 try{for(const [name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const width of [320,390,820,1440]){
   label=name+' '+width;const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await p.goto(origin+'/?tab=logbook');await p.locator('[data-navy-logbook]').waitFor();
    if(width<=720){await p.locator('[data-action=navy-more]').click();await p.locator('#modal [data-tab=atpl]').click();}else await p.locator('.sidebar [data-tab=atpl]').click();
    await p.waitForURL('**/atpl/');await p.locator('.study-shell [data-bank=MB]').waitFor();
    assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
    const navigation=width<=720?'.bottom-nav':'.study-sidebar';
    if(width>720){const rail=await p.locator('.study-sidebar').evaluate(n=>({width:n.getBoundingClientRect().width,radius:getComputedStyle(n).borderRadius}));assert.equal(rail.width,88);assert.equal(rail.radius,'28px');}
    assert.equal(await p.locator('.study-library-summary strong').first().innerText(),'11');assert(await p.locator(navigation).isVisible());
    if(width>720)assert.equal(await p.locator('.study-sidebar [aria-current=page]').innerText(),'Ôn thi');
    await p.locator('[data-appearance-toggle]').click();assert.equal(await p.locator('html').getAttribute('data-theme'),'light');
    const color=await p.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor);assert.equal(color,'rgb(241, 243, 246)');const accountStyle=await p.locator('[data-account-menu]>summary').evaluate(n=>({color:getComputedStyle(n).color,radius:getComputedStyle(n).borderRadius}));assert.equal(accountStyle.radius,'50%');assert.equal(accountStyle.color,'rgb(39, 52, 70)');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    if(width===390)await p.screenshot({path:path.join(out,name+'-library-light.png')});
    await p.locator('[data-appearance-toggle]').click();
    if(width===390)await p.screenshot({path:path.join(out,name+'-library-dark.png')});if(width===1440)await p.screenshot({path:path.join(out,name+'-1440-library-dark.png')});
    await p.locator('[data-bank=MB] a').click();await p.locator('[data-study-subject]').filter({hasText:'Mass'}).waitFor();await p.locator('#atpl-offline-button').waitFor({state:'attached'});
    assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');assert.match(await p.locator('.topbar .brand').innerText(),/AviLog · Ôn thi/);assert(!await p.locator('.topbar .brand').innerText().then(s=>s.includes('ATPL TRAINER')));
    assert(await p.locator(navigation).isVisible());await p.locator('[data-account-menu]>summary').click();assert(await p.locator('[data-account-content]').isVisible());await p.keyboard.press('Escape');
    const settingsIcon=await p.locator('[data-bank-manage]>summary svg').boundingBox();assert(settingsIcon.width>=18&&settingsIcon.height>=18);
    await p.locator('[data-action=study]').first().click();await p.locator('.answer-option').first().waitFor();
    if(width<=720)assert(!await p.locator('.bottom-nav').isVisible(),'quiz actions have room on mobile');else assert(await p.locator('.study-sidebar').isVisible());
    const correct=await p.evaluate(()=>{const qid=Number(document.querySelector('[data-question-id]').dataset.questionId);return JSON.parse(document.getElementById('bank-data').textContent)[window.ATPL_SUBJECT].questions.find(q=>q.id===qid).answer;});
    const incorrect=await p.locator('[data-action=answer]').evaluateAll((buttons,correct)=>buttons.find(b=>b.dataset.key!==correct).dataset.key,correct);await p.locator('[data-action=answer][data-key="'+incorrect+'"]').click();assert.equal(await p.locator('.answer-option.incorrect').count(),1);
    await p.locator('[data-action=next]').click();await p.locator('.answer-option').first().waitFor();const nextCorrect=await p.evaluate(()=>{const qid=Number(document.querySelector('[data-question-id]').dataset.questionId);return JSON.parse(document.getElementById('bank-data').textContent)[window.ATPL_SUBJECT].questions.find(q=>q.id===qid).answer;});
    await p.locator('[data-action=answer][data-key="'+nextCorrect+'"]').click();assert(await p.locator('.answer-option.correct').count());
    await p.locator('[data-action=bookmark]').click();assert.equal(await p.locator('[data-action=bookmark]').innerText(),'★');
    let progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('atpl_mb_v2_state')));assert(Object.keys(progress.progress).length>0);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    if(width===390){await p.screenshot({path:path.join(out,name+'-quiz-dark.png')});await p.locator('.lang-switch [data-lang=en]').click();assert.equal(await p.locator('.lang-switch [data-lang=en]').getAttribute('aria-pressed'),'true');await p.locator('.lang-switch [data-lang=vi]').click();await require('./ui-controls.cjs').bankManage(p);await p.locator('[data-action=settings]').click();await p.locator('#dialog[open]').waitFor();await p.screenshot({path:path.join(out,name+'-settings-dark.png')});await p.keyboard.press('Escape');}if(width===1440)await p.screenshot({path:path.join(out,name+'-1440-quiz-dark.png')});
    progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('atpl_mb_v2_state')));
    await p.locator('#choose-subject').click();await p.waitForURL('**/atpl/');await p.locator('[data-bank=MB]').waitFor();assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('atpl_mb_v2_state'))),progress);
    if(width<=720){await p.locator('[data-study-more]').click();await p.locator('.study-more-sheet [data-tab=logbook]').click();}else await p.locator('.study-sidebar [data-tab=logbook]').click();
    await p.locator('[data-navy-logbook]').waitFor();assert.equal(new URL(p.url()).searchParams.get('tab'),'logbook');assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
    await p.reload();await p.locator('[data-navy-logbook]').waitFor();assert.deepEqual(errors,[]);report.checks.push({browser:name,width,sharedNavigation:true,themeRoundTrip:true,correctAnswerAndProgressRetained:true,overflow:false});
    if(width===390){
     const beforeAdd=await p.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState()));
     await p.goto(origin+'/atpl/');await p.locator('.nv-floating-add').click();await p.locator('#modal[open] #flight-form').waitFor();
     assert.equal(new URL(p.url()).searchParams.has('compose'),false);
     await p.locator('#modal .modal-head [data-action=close]').click();
     assert.equal(await p.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState())),beforeAdd,'Add only opens an unsaved flight draft');
     await p.goto(origin+'/atpl/');await p.locator('[data-bank=MB]').waitFor();await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
     const url=await p.locator('[data-bank=MB] a').getAttribute('href');await p.evaluate(async()=>{const m=await import('/atpl/offline.js'),c=await m.getCatalog();await m.downloadBank(c.banks.find(b=>b.code==='MB'));});
     unavailable=true;if(name==='chromium')await context.setOffline(true);
     assert(await p.evaluate(()=>fetch('/api/health?offline=1',{cache:'no-store'}).then(()=>false).catch(()=>true)));
     await p.reload();await p.locator('.study-shell [data-bank=MB]').waitFor();await p.goto(origin+url);await p.locator('.study-shell [data-study-subject]').waitFor();
     assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('atpl_mb_v2_state'))),progress);
     await p.goto(origin+'/?tab=logbook');await p.locator('[data-navy-logbook]').waitFor();report.checks.push({browser:name,offlineStudyAndReturnToLogbook:true,progressRetained:true});
     unavailable=false;await context.setOffline(false);await p.goto(origin+'/atpl/');await p.locator('[data-bank=INS] a').click();await p.locator('#atpl-offline-button').waitFor({state:'attached'});await p.locator('[data-action=study]').first().click();await p.locator('#dock [data-action=picker]').click();await p.locator('[data-action=range][data-range="1"]').click();await p.locator('[data-action=jump][data-qid="148"]').click();
     assert.deepEqual(await p.locator('.answer-option .letter').allTextContents(),['E','F','G','H']);const insKey=await p.evaluate(()=>JSON.parse(document.getElementById('bank-data').textContent).INS.questions.find(q=>q.id===148).answer);await p.locator('[data-action=answer][data-key="'+insKey+'"]').click();assert.equal(await p.locator('.answer-option.correct').count(),1);
     const source=p.locator('[data-action=source],[data-action=image]').first();await source.evaluate(el=>{for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;});await source.click();await p.locator('#image-dialog img').evaluate(img=>img.decode());assert(await p.locator('#image-dialog img').evaluate(img=>img.naturalWidth>500));assert.equal(await p.locator('#image-dialog .image-stage').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');await p.screenshot({path:path.join(out,name+'-source-image.png')});await p.locator('[data-action=image-close]').click();
     assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('atpl_mb_v2_state'))),progress);report.checks.push({browser:name,originalEFGHLetters:true,sourceImageDecoded:true,sourceBackgroundWhite:true,otherBankProgressUnchanged:true});

    }
   }catch(e){await p.screenshot({path:path.join(out,name+'-'+width+'-failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{unavailable=false;await context.close();}
  }}finally{await browser.close();}
 }}catch(e){report.errors.push({label,error:e.stack||String(e)});process.exitCode=1;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
