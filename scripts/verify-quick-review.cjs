const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
(async()=>{
 const {createServer}=await import('../server.js'),server=createServer({firebaseConfig:{enabled:false}});
 const handler=server.listeners('request')[0];let unavailable=false;
 server.removeAllListeners('request');server.on('request',(req,res)=>unavailable?req.socket.destroy():handler(req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('test-results/quick-review');await fs.mkdir(out,{recursive:true});const checks=[];
 try{
  const catalog=JSON.parse(await fs.readFile('public/atpl/catalog.json','utf8'));
  for(const [name,engine,width]of [['chromium',chromium,1440],['webkit',webkit,390]]){
   const browser=await engine.launch({headless:true}),context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   try{
    for(const bank of catalog.banks){
     await p.goto(origin+bank.url);await p.locator('[data-quick-review]').waitFor();
     const before=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/atpl_.*_state$/.test(k))));
     await p.locator('[data-quick-review]').click();await p.locator('#quick-review').waitFor();
     assert.equal(await p.locator('#view').isVisible(),false);
     assert.equal(await p.locator('.quick-review-question').count(),bank.count);
     const invalidKeys=await p.evaluate(()=>{
      const data=JSON.parse(document.getElementById('bank-data').textContent)[window.ATPL_SUBJECT];
      return data.questions.filter(q=>q.valid).filter(q=>document.querySelector(`[data-review-id="${q.id}"] strong .quick-review-letter`)?.textContent!==q.answer+'.').map(q=>q.uid);
     });assert.deepEqual(invalidKeys,[]);
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
     const uid=await p.locator('.quick-review-meta>span').first().innerText();
     await p.locator('[data-review-search]').fill(uid);assert.equal(await p.locator('.quick-review-question').count(),1);
     await p.locator('[data-review-search]').fill('no-question-xyz98765');await p.locator('[data-review-empty]').waitFor();
     await p.locator('[data-review-clear]').click();assert.equal(await p.locator('.quick-review-question').count(),bank.count);
     const topics=await p.locator('[data-review-topic] option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
     if(topics.length){await p.locator('[data-review-topic]').selectOption(topics[0]);assert(await p.locator('.quick-review-question').count()>0);await p.locator('[data-review-clear]').click();}
     if(bank.code==='COM'){
      await p.screenshot({path:path.join(out,name+'-'+width+'-dark.png')});
      await p.locator('[data-bank-manage]>summary').click();await p.locator('[data-action=theme]').click();await p.locator('[data-bank-manage]>summary').click();
      await p.screenshot({path:path.join(out,name+'-'+width+'-light.png')});
     }
     assert.deepEqual(await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/atpl_.*_state$/.test(k)))),before);
     await p.locator('[data-review-back]').click();await p.locator('#view').waitFor();
     await p.locator('[data-action=study]').first().click();await p.locator('[data-action=answer]').first().click();
     const saved=await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/atpl_.*_state$/.test(k))));
     await p.locator('[data-action=home]').click();await p.locator('[data-quick-review]').click();
     await p.locator('[data-review-search]').fill(uid);await p.locator('[data-review-back]').click();
     assert.deepEqual(await p.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/atpl_.*_state$/.test(k)))),saved);
     checks.push({browser:name,width,bank:bank.code,count:bank.count,correctKeys:true,filters:true,progressPreserved:true});
    }
    await p.goto(origin+'/atpl/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const bank=catalog.banks.find(b=>b.code==='COM');
    await p.evaluate(async()=>{const m=await import('/atpl/offline.js'),c=await m.getCatalog();await m.downloadBank(c.banks.find(b=>b.code==='COM'));});
    unavailable=true;if(name==='chromium')await context.setOffline(true);
    await p.goto(origin+bank.url);await p.locator('[data-quick-review]').click();assert.equal(await p.locator('.quick-review-question').count(),500);
    checks.push({browser:name,offline:true,count:500});unavailable=false;await context.setOffline(false);
    assert.deepEqual(errors,[]);
   }finally{unavailable=false;await browser.close();}
  }
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'QA.json'),JSON.stringify(checks,null,2));}
 console.log(JSON.stringify({checks:checks.length,passed:true,output:out}));
})().catch(e=>{console.error(e);process.exitCode=1;});
