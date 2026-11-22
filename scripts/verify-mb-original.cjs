/* Synthetic progress only. The user's Word source was compared to all 300 MB
 * questions/options/keys before retaining the existing immutable MB identity. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {createServer}=await import('../server.js');const server=createServer({firebaseConfig:{enabled:false}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('test-results/mb-original');await fs.mkdir(out,{recursive:true});const checks=[];
 try{for(const [engine,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,1440])for(const mode of ['guest','account']){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(origin+'/atpl/');await page.locator('[data-bank=MB]').waitFor();
    const seeded=await page.evaluate(async mode=>{
     const {openAccountBank,blankState}=await import('/atpl/sync/store.js'),ids=await(await fetch('/atpl/identities.json')).json();
     for(const code of ['MB','MBR']){
      const state=blankState(),qid=code==='MB'?63:290;state.progress[qid]={attempts:code==='MB'?3:9,correct:2,lastSelected:ids[code].questions[qid].answer,lastAt:100};state.bookmarks=[qid];
      localStorage.setItem(`atpl_${code.toLowerCase()}_v2_state`,JSON.stringify(state));
      const bank=await openAccountBank({storage:localStorage,uid:'mb-original-qa',identity:ids[code],locks:navigator.locks});bank.engineStorage.getItem(`atpl_${code.toLowerCase()}_v2_state`);bank.engineStorage.setItem(`atpl_${code.toLowerCase()}_v2_state`,JSON.stringify(state));bank.release();
     }
     localStorage.setItem('atpl_active_account_v1',JSON.stringify(mode==='account'?{uid:'mb-original-qa'}:{mode:'guest'}));
     return Object.fromEntries(['atpl_mb_v2_state','atpl_mbr_v2_state','atpl_account_v1:mb-original-qa:MB','atpl_account_v1:mb-original-qa:MBR'].map(k=>[k,localStorage.getItem(k)]));
    },mode);
    await page.reload();await page.locator('[data-bank=MB]').waitFor();
    assert.equal(await page.locator('.atpl-grid>.atpl-card').count(),11);
    assert.equal(await page.locator('[data-bank=MB]').count(),1);assert.equal(await page.locator('[data-bank=MBR]').count(),0);
    assert.equal(await page.getByRole('heading',{name:'Mass & Balance',exact:true}).count(),1);
    assert.doesNotMatch(await page.locator('.atpl-library').innerText(),/hiệu chỉnh|Bản tham khảo riêng/);
    for(const theme of ['light','dark']){
     await page.evaluate(async theme=>(await import('/lib/appearance.js')).setAppearance({theme}),theme);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
     await page.locator('[data-bank=MB]').screenshot({path:path.join(out,`${engine}-${width}-${mode}-${theme}.png`)});
    }
    await page.locator('[data-bank=MB] a').click();await page.locator('#atpl-offline-button').waitFor({state:'attached'});
    assert.equal(await page.evaluate(()=>ATPLBankStore.uid),mode==='account'?'mb-original-qa':null);
    assert.equal(await page.locator('.mb-edition,.bank-edition,.mb-mode-link').count(),0);
    const actual=await page.evaluate(()=>{
     const data=JSON.parse(document.getElementById('bank-data').textContent).MB;
     return {count:data.questions.filter(q=>q.valid).length,keys:[63,290].map(id=>data.questions.find(q=>q.id===id).answer),state:JSON.parse(ATPLBankStore.engineStorage.getItem('atpl_mb_v2_state'))};
    });
    assert.equal(actual.count,300);assert.deepEqual(actual.keys,['C','C']);assert.equal(actual.state.progress[63].attempts,3);assert(actual.state.bookmarks.includes(63));
    const read=()=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(seeded));
    assert.deepEqual(await read(),seeded,'opening the retained bank preserves existing guest/account progress bytes');
    await page.locator('[data-action=study]').first().click();await page.locator('[data-action=answer]').first().click();await page.locator('[data-action=bookmark]').click();
    const saved=await read(),activeKey=mode==='account'?'atpl_account_v1:mb-original-qa:MB':'atpl_mb_v2_state';
    assert.notEqual(saved[activeKey],seeded[activeKey]);
    for(const key of Object.keys(seeded).filter(k=>k!==activeKey))assert.equal(saved[key],seeded[key],key+' remains isolated');
    await page.reload();await page.locator('#atpl-offline-button').waitFor({state:'attached'});assert.deepEqual(await read(),saved);
    await page.locator('#choose-subject').click();await page.locator('[data-bank=MB]').waitFor();assert.equal(await page.locator('.atpl-grid>.atpl-card').count(),11);assert.deepEqual(await read(),saved);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    // Existing MB offline files retain their original URL/hash and still reopen.
    await page.evaluate(async()=>{const m=await import('/atpl/offline.js'),c=await m.getCatalog();await m.downloadBank(c.banks.find(b=>b.code==='MB'));});
    if(engine==='chromium')await context.setOffline(true);
    await page.reload();await page.locator('[data-bank=MB] [data-ready]').filter({hasText:'✓'}).waitFor();
    await page.locator('[data-bank=MB] a').click();await page.locator('#atpl-offline-button').waitFor({state:'attached'});assert.deepEqual(await read(),saved);assert.deepEqual(errors,[]);
    checks.push({engine,width,mode,oneMassBalanceCard:true,original300Questions:true,keys63and290:'C/C',progressPreserved:true,otherProgressUntouched:true,offlineReopen:true});
   }finally{await context.close();}
  }}finally{await browser.close();}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(checks,null,2));}
 assert.equal(checks.length,8);console.log(JSON.stringify(checks,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
