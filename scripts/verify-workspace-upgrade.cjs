/* Actual v3 -> v5 lifecycle. Cached UID proves offline isolation, not OAuth. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const old=execFileSync('git',['show','6ccdb6995d29782ef5770feb828f0b767c9a5976:public/sw.js'],{cwd:root,encoding:'utf8'});
 const next=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
 const {createServer}=await import(pathToFileURL(path.join(root,'server.js')));let worker=old,originUnavailable=false;
 const server=createServer({firebaseConfig:{enabled:false}}),original=server.listeners('request')[0];
 server.removeAllListeners('request');server.on('request',(req,res)=>{
  if(originUnavailable){req.socket.destroy();return;}
  if(new URL(req.url,'http://qa').pathname==='/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(worker);}else original(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const[name,type]of Object.entries({chromium,webkit}).filter(([name])=>!process.env.WORKSPACE_QA_BROWSER||process.env.WORKSPACE_QA_BROWSER===name)){
  worker=old;originUnavailable=false;const browser=await type.launch({headless:true}),context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(origin+'/atpl/');await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   await page.locator('[data-download=MB]').click();await page.locator('[data-bank=MB] [data-ready]').filter({hasText:/^✓ Sẵn sàng offline/}).waitFor({timeout:120000});
   const url=await page.locator('[data-bank=MB] a').getAttribute('href');await page.goto(origin+url);await page.locator('[data-action=study]').first().waitFor();
   const before=await page.evaluate(async()=>{
    const identities=await fetch('/atpl/identities.json').then(r=>r.json()),{openAccountBank}=await import('/atpl/sync/store.js');
    const store=await openAccountBank({storage:localStorage,uid:'upgrade-alice',identity:identities.MB,locks:navigator.locks});
    const state=store.getEnvelope().state;state.bookmarks=[1];store.engineStorage.setItem('atpl_mb_v2_state',JSON.stringify(state));store.release();
    localStorage.setItem('atpl_active_account_v1',JSON.stringify({uid:'upgrade-alice',email:'upgrade@example.test'}));
    const old=await caches.open('avilog-shell-v3-shared-account');for(const request of await old.keys())if(new URL(request.url).pathname.startsWith('/workspace/'))await old.delete(request);
    return localStorage.getItem('atpl_account_v1:upgrade-alice:MB');
   });
   worker=next;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
   // A new cache appears before the old controller has handed over. Probe the
   // actual controller, otherwise this test cuts the network during activation.
   let controlled=false;const deadline=Date.now()+10000;
   while(Date.now()<deadline){
    controlled=await page.evaluate(()=>new Promise(resolve=>{
     if(!navigator.serviceWorker.controller){resolve(false);return;}
     const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},250);
     channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data.version==='avilog-shell-v5-weather');};
     navigator.serviceWorker.controller.postMessage({type:'avilog-shell-version'},[channel.port2]);
    }));if(controlled)break;await new Promise(resolve=>setTimeout(resolve,100));
   }assert.equal(controlled,true,'The actual controlling worker must acknowledge v5 before cutting the network');
   const names=await page.evaluate(()=>caches.keys());assert.ok(names.includes('avilog-atpl-v1'));assert.ok(names.includes('avilog-shell-v5-weather'));
   if(name==='chromium')await context.setOffline(true);else originUnavailable=true;await page.goto(origin);await page.locator('[data-workspace-account]').filter({hasText:'upgrade@example.test'}).waitFor({timeout:10000});
   assert.equal(await page.evaluate(()=>localStorage.getItem('atpl_account_v1:upgrade-alice:MB')),before);
   await page.goto(origin+url);await page.locator('[data-action=study]').first().waitFor({timeout:10000});assert.equal(await page.evaluate(()=>ATPLBankStore.uid),'upgrade-alice');assert.deepEqual(await page.evaluate(()=>ATPLBankStore.getEnvelope().state.bookmarks),[1]);
   await page.locator('[data-action=study]').first().click();await page.evaluate(()=>{const button=document.createElement('button');button.dataset.action='jump';button.dataset.qid='1';document.body.append(button);button.click();button.remove();});
   const key=await page.evaluate(()=>Object.values(JSON.parse(document.getElementById('bank-data').textContent))[0].questions.find(q=>q.id===1).answer);await page.locator(`[data-action=answer][data-key="${key}"]`).click();
   const image=page.locator('[data-action=image],[data-action=source]').first();await image.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});await image.click();await page.locator('#image-dialog img').evaluate(img=>img.decode());assert.ok(await page.locator('#image-dialog img').evaluate(img=>img.naturalWidth>500));
   assert.deepEqual(errors,[]);console.log(name+': controlling v5 verified; v3 upgrade preserves account bookmark, MB and source image; cold main opens offline with provider disabled');
  }catch(error){console.error('UPGRADE',name,page.url(),(await page.locator('body').innerText()).slice(0,1500),errors);throw error;}
  finally{await context.close();await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
