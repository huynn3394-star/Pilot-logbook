/* Additive Word-bank QA: mobile/desktop rendering, reveal, images, progress and grading. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
const jump=(p,n)=>p.evaluate(n=>{const b=document.createElement('button');b.dataset.action='jump';b.dataset.qid=n;document.body.append(b);b.click();b.remove()},n);
(async()=>{
 const out=path.resolve('test-results/atpl-additions');await fs.mkdir(out,{recursive:true});const {createServer}=await import('../server.js'),server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,checks=[];
 try{for(const [name,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});try{for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    await p.goto(origin+'/atpl/');await p.locator('[data-bank=GNAV]').waitFor();assert.equal(await p.locator('[data-bank]').count(),13);await p.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));
    await p.evaluate(()=>localStorage.setItem('unrelated-progress-proof','keep'));const states={};
    for(const [code,count] of [['FPL',503],['GNAV',600]]){
     await p.locator(`[data-bank=${code}] a`).click();await p.locator('[data-action=study]').first().waitFor();await p.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));
     const data=await p.evaluate(()=>Object.values(JSON.parse(document.querySelector('#bank-data').textContent))[0]);assert.equal(data.questions.length,count);
     // All source keys grade, including questions excluded from a default mock exam.
     assert.equal(await p.evaluate(()=>{const E=ATPLQuizEngine,qs=Object.values(JSON.parse(document.querySelector('#bank-data').textContent))[0].questions;let s=E.startExam(E.defaultState(),qs.map(q=>q.id));for(const q of qs)s=E.answerExam(s,q.id,q.answer);return E.submitExam(s,qs).exam.report.correct}),count);
     await p.locator('[data-action=study]').first().click();await jump(p,1);await p.locator('[data-action=answer][data-key='+data.questions[0].answer+']').click();await p.locator('.explanation').waitFor();assert(await p.locator('.book-sources').isVisible());assert.match(await p.locator('.book-source').first().innerText(),/CAE Oxford/);assert(await p.locator('.book-source blockquote').count());assert.match(await p.locator('.explanation').innerText(),/giải thích tiếng Việt/i);await p.locator('[data-action=bookmark]').click();assert.equal(await p.locator('[data-action=bookmark]').innerText(),'★');
     // Actual source cards must stay readable in both existing themes at phone/desktop widths.
     const initialTheme=await p.locator('html').getAttribute('data-theme');
     for(const theme of ['light','dark']){
      await p.evaluate(async t=>(await import('/lib/appearance.js')).setAppearance({theme:t}),theme);
      assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
      assert(await p.locator('.book-source blockquote').first().isVisible());
      assert(await p.locator('.book-source').first().evaluate(el=>el.scrollWidth<=el.clientWidth+2));
      const pageImage=p.locator('.book-page img').first();await pageImage.scrollIntoViewIfNeeded();await pageImage.evaluate(img=>img.decode());assert.equal(await pageImage.evaluate(img=>img.naturalHeight),2400);
      assert(await pageImage.evaluate(img=>getComputedStyle(img).objectFit==='contain'&&img.closest('button').clientHeight>=img.clientHeight),'full page preview must not clip formulas or printed footer');
      await p.locator('.book-source').first().screenshot({path:path.join(out,`${name}-${width}-${code}-source-${theme}.png`)});
     }
     await p.locator('[data-book-page]').first().click();await p.locator('#image-dialog img').evaluate(img=>img.decode());assert.equal(await p.locator('#image-dialog img').evaluate(img=>img.naturalHeight),2400);await p.locator('[data-action=image-zoom]').click();assert(await p.locator('#image-dialog .image-stage').evaluate(el=>el.classList.contains('zoomed')));await p.keyboard.press('Escape');assert.equal(await p.locator('#image-dialog').evaluate(d=>d.open),false);
     await p.evaluate(async t=>(await import('/lib/appearance.js')).setAppearance({theme:t||'light'}),initialTheme);
     const illustrated=data.questions.find(q=>q.importedFigures.length);assert(illustrated);await jump(p,illustrated.id);
     assert.equal(await p.locator('.explanation').count(),0,'full screenshot/key is hidden before answering');assert(await p.locator('.qcard .figure').count()||await p.locator('.qcard [data-action=image]').count());
     const crop=p.locator('.qcard [data-action=image]').first();await crop.click();await p.locator('#image-dialog img').evaluate(img=>img.decode());assert(await p.locator('#image-dialog img').evaluate(img=>img.naturalWidth>400));await p.locator('[data-action=image-close]').click();
     await p.locator('[data-action=answer][data-key='+illustrated.answer+']').click();await p.locator('.sourcebox').evaluate(n=>n.open=true);const full=p.locator('.sourcebox [data-action=image]').first();await full.click();await p.locator('#image-dialog img').evaluate(img=>img.decode());assert.equal(await p.locator('#image-dialog img').evaluate(img=>img.naturalWidth),1920);await p.locator('[data-action=image-close]').click();
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.screenshot({path:path.join(out,`${name}-${width}-${code}.png`),fullPage:true});
     await p.reload();await p.locator('[data-action=resume]').first().click();await jump(p,1);assert.equal(await p.locator('[data-action=bookmark]').innerText(),'★');await p.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));
     states[code]=await p.evaluate(code=>localStorage.getItem('atpl_'+code.toLowerCase()+'_v2_state'),code);await p.locator('#choose-subject').click();await p.locator('[data-bank=GNAV]').waitFor();await p.waitForFunction(()=>!!document.querySelector('[data-account-content] button'));
    }
    for(const code of Object.keys(states))assert.equal(await p.evaluate(code=>localStorage.getItem('atpl_'+code.toLowerCase()+'_v2_state'),code),states[code]);assert.equal(await p.evaluate(()=>localStorage.getItem('unrelated-progress-proof')),'keep');assert.deepEqual(errors,[]);checks.push({browser:name,width,sourceKeyGrading:1103,figureAndSourceDecode:true,progressIsolatedAndRetained:true,overflow:false});
   }finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify({checks},null,2));}
 console.log(JSON.stringify(checks,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
