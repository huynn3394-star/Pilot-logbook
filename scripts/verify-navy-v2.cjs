/* Local synthetic/guest records only. No production writes or OAuth claims. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('playwright');
(async()=>{
 const root=path.resolve('test-results/navy-v2');await fs.mkdir(root,{recursive:true});
 const report={scope:'Local guest E2E and performance; real-account emulator tests run separately; no production or physical iOS writes',checks:[],performance:[],errors:[]};
 const {createServer}=await import('../server.js'),server=createServer({firebaseConfig:{enabled:false},weather:{get:async station=>({station,metar:null,taf:null,provider:'isolated fixture',fetchedAt:new Date().toISOString()})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let browser,current,label='start';
 async function navigate(p,width,id){if(width<=720&&!['schedule','logbook','weather'].includes(id)){await p.locator('.bottom-nav [data-action=navy-more]').click();await p.locator('#modal [data-tab="'+id+'"]').click();}else await p.locator((width<=720?'.bottom-nav':'.sidebar')+' [data-tab="'+id+'"]').click();}
 async function fits(p,selector='html'){assert(await p.locator(selector).evaluate(n=>n.scrollWidth<=n.clientWidth+2),label+' overflow '+selector);}
 const read=p=>p.evaluate(async()=>JSON.stringify(await(await import('/lib/storage.js')).readState()));
 async function start(context){const p=await context.newPage();current=p;p.setDefaultTimeout(10000);await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await p.goto(origin);await p.locator('[data-workspace-account]').waitFor();return p;}
 try{
  for(const [name,engine]of Object.entries({chromium,webkit})){
   browser=await engine.launch({headless:true});
   for(const width of [320,390,820,1440]){
    const c=await browser.newContext({viewport:{width,height:900},timezoneId:'Pacific/Honolulu'}),p=await start(c),errors=[];p.on('pageerror',e=>errors.push(e.message));
    try{
     label=name+' '+width+' account/navigation';
     assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
     await p.locator('[data-account-menu]>summary').click();assert.equal(await p.locator('[data-account-menu]>summary').innerText(),'☰');
     assert(await p.locator('[data-workspace-action=backup]').isVisible());await p.locator('[data-workspace-action=backup]').click();
     assert(await p.locator('[data-workspace-backups]').evaluate(n=>n.closest('details').open));
     assert(await p.locator('[data-action=backup]').isVisible());
     await navigate(p,width,'logbook');await p.locator('[data-flight-card]').first().waitFor();await fits(p);
     const before=await read(p),count=await p.locator('[data-flight-card]').count();assert(count>0);
     if(width===820){
      const pane=p.locator('[data-tablet-preview]');
      assert(await pane.isVisible(),'iPad right pane is visible');
      const layout=await p.evaluate(()=>{const left=document.querySelector('.nv21-tablet-list'),right=document.querySelector('.nv21-tablet-detail');const a=left.getBoundingClientRect(),b=right.getBoundingClientRect();return{separate:a.right<b.left,scrollLeft:getComputedStyle(left).overflowY,scrollRight:getComputedStyle(right).overflowY};});
      assert(layout.separate,'iPad flight list and detail are separate columns');assert.equal(layout.scrollLeft,'auto');assert.equal(layout.scrollRight,'auto');
      if(count>1){const card=p.locator('[data-flight-card]').nth(1),id=await card.getAttribute('data-flight-card');await card.locator('[data-action=tablet-preview]').click();assert.equal(await card.locator('[data-action=tablet-preview]').getAttribute('aria-pressed'),'true');assert(await pane.locator('[data-action=edit]').getAttribute('data-id')===id);}
      assert.equal(await read(p),before,'iPad selection is read-only');await fits(p);
      await pane.locator('[data-action=edit]').click();
      const inline=await p.locator('#modal').evaluate(d=>{const pane=document.querySelector('[data-tablet-preview]').getBoundingClientRect(),rect=d.getBoundingClientRect();return{open:d.open,modal:d.matches(':modal'),rightPaneAligned:Math.abs(rect.left-pane.left)<2&&Math.abs(rect.width-pane.width)<3}});
      assert.equal(inline.open,true,'iPad editor should be open');
      assert.equal(inline.modal,false,'iPad editor must not blur the list as a modal overlay');
      assert.equal(inline.rightPaneAligned,true,'editor must occupy the right pane');
      if(count>1){const other=p.locator('[data-flight-card]').first();const otherId=await other.getAttribute('data-flight-card');await other.locator('[data-action=tablet-preview]').click();assert.equal(await p.locator('#flight-form').getAttribute('data-id'),otherId,'switching iPad selection must change the native editor record');}
      await p.locator('.fe-back').click();assert.equal(await p.locator('#modal').evaluate(d=>d.open),false);
      assert.equal(await read(p),before,'iPad native editor open/switch/close must not persist until Save');
      await p.screenshot({path:path.join(root,name+'-820-tablet-split.png')});
     }
     await p.locator('[data-filter=search]').fill('VN0605');assert.equal(await p.locator('[data-flight-card]').count(),1);
     assert.match(await p.locator('.nv-list-status').innerText(),/1 chuyến/);
     await p.locator('[data-action=navy-filters]').click();await p.locator('[name=status]').selectOption('confirmed');
     assert.match(await p.locator('[data-navy-filter-apply]').innerText(),/1 chuyến/);await fits(p,'#modal');
     await p.locator('[data-navy-filter-apply]').click();assert.equal(await p.locator('[data-flight-card]').count(),1);assert.equal(await read(p),before);
     await p.locator('[data-action=navy-filters]').click();await p.locator('[name=minBlock]').fill('999');assert.match(await p.locator('[data-navy-filter-apply]').innerText(),/0 chuyến/);
     await p.locator('[data-navy-filter-clear]').click();await p.locator('[data-navy-filter-apply]').click();await p.locator('[data-filter=search]').fill('');assert.equal(await p.locator('[data-flight-card]').count(),count);
     await p.locator('[data-navy-month]').fill('2026-09');assert.equal(await p.locator('[data-flight-card]').count(),0);
     await p.locator('[data-navy-month]').fill('2026-10');assert.equal(await p.locator('[data-flight-card]').count(),count);
     await p.locator('[data-action=navy-management]').click();assert(await p.locator('#modal.nv-sheet').isVisible());
     await p.keyboard.press('Escape');assert(!await p.locator('#modal').evaluate(n=>n.open));
     await p.locator('[data-action=navy-management]').click();const handle=p.locator('[data-sheet-handle]');
     await handle.dispatchEvent('pointerdown',{pointerId:1,clientY:100});await handle.dispatchEvent('pointerup',{pointerId:1,clientY:190});assert(!await p.locator('#modal').evaluate(n=>n.open));
     label=name+' '+width+' editor/data';
     await p.locator('[data-action=edit][data-id=demo-605]').click();await p.locator('[name=note]').fill('Navy V2 verified note');
     p.once('dialog',d=>d.dismiss());await p.locator('.fe-back').click();assert(await p.locator('#modal').evaluate(n=>n.open),'unsaved warning must retain form when cancelled');
     await p.locator('.fe-save').click();await p.waitForFunction(()=>!document.querySelector('#modal').open);
     const after=JSON.parse(await read(p)),old=JSON.parse(before),a=after.flights.find(f=>f.id==='demo-605'),b=old.flights.find(f=>f.id==='demo-605');
     assert.equal(a.note,'Navy V2 verified note');assert.deepEqual(a.actual,b.actual);assert.deepEqual(a.scheduled,b.scheduled);assert.equal(a.id,b.id);assert.equal(after.flights.length,old.flights.length);
     await p.reload();await p.locator('[data-workspace-account]').waitFor();await navigate(p,width,'logbook');assert.equal(JSON.parse(await read(p)).flights.find(f=>f.id==='demo-605').note,a.note);
     await p.locator(width<=720?'.nv-floating-add':'.nv-collection-actions [data-action=add]').click();assert(await p.locator('.fe-save').isDisabled());
     await p.locator('[name=flightNo]').fill('VN9988');await p.locator('[name=date]').fill('2026-10-31');await p.locator('[name=dep]').fill('SGN');await p.locator('[name=dest]').fill('HAN');
     for(const [key,date,clock]of [['out','2026-10-31','2350'],['off','2026-11-01','0000'],['on','2026-11-01','0100'],['in','2026-11-01','0110']]){await p.locator('[name=a_'+key+'_date]').fill(date);await p.locator('[name=a_'+key+']').fill(clock);await p.locator('[name=a_'+key+']').blur();}
     assert.equal(await p.locator('[data-fe-total=block]').innerText(),'01:20');assert.equal(await p.locator('[data-fe-total=airborne]').innerText(),'01:00');
     await p.locator('[data-v14-times]>summary').click();await p.locator('[name=log_instrumentMinutes]').fill('25');await p.locator('[name=log_sicMinutes]').fill('80');
     const plus=p.getByRole('button',{name:'Tăng Takeoff ngày · số lần',exact:true});await plus.click();assert.equal(await p.locator('[name=log_takeoffDay]').inputValue(),'1');await fits(p,'#modal');
     await p.locator('[data-flight-tab=tools]').click();await p.locator('[name=confirmed]').check();await p.locator('#flight-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});await p.waitForFunction(()=>!document.querySelector('#modal').open);
     const saved=JSON.parse(await read(p)).flights.filter(f=>f.flightNo==='VN9988');assert.equal(saved.length,1);assert.equal(saved[0].actual.out,'2026-10-31T23:50:00.000Z');assert.equal(saved[0].actual.in,'2026-11-01T01:10:00.000Z');assert.equal(saved[0].logbook.instrumentMinutes,25);assert.equal(saved[0].logbook.takeoffDay,1);
     await p.screenshot({path:path.join(root,name+'-'+width+'-logbook.png'),fullPage:true});
     await p.locator('[data-action=edit][data-id="'+saved[0].id+'"]').click();await p.screenshot({path:path.join(root,name+'-'+width+'-editor.png')});
     if(width===390){
      await p.locator('.nv-count-card').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(root,name+'-390-editor-counters.png')});
      await p.locator('[data-v14-times]>summary').click();await p.locator('[data-v14-times]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(root,name+'-390-editor-allocations.png')});
      await p.locator('.fe-summary-card').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(root,name+'-390-editor-summary.png')});
      await p.locator('[data-flight-tab=airports]').click();await p.screenshot({path:path.join(root,name+'-390-editor-airports.png')});
      await p.locator('[data-flight-tab=log]').click();
     }
     await p.locator('.fe-back').click();
     await p.locator('[data-action=navy-filters]').click();await p.screenshot({path:path.join(root,name+'-'+width+'-filters.png')});await p.keyboard.press('Escape');
     await p.locator('[data-action=navy-management]').click();await p.screenshot({path:path.join(root,name+'-'+width+'-management.png')});await p.keyboard.press('Escape');
     assert.deepEqual(errors,[]);report.checks.push({browser:name,width,search:true,filters:true,month:true,accountBackup:true,sheetKeyboardAndSwipe:true,saveReloadPreservesActual:true,midnightUTC:true,counters:true,overflow:false,errors});
    }finally{await c.close();}
   }
   if(name==='chromium')for(const size of [100,1000,10000]){
    label='scale '+size;const c=await browser.newContext({viewport:{width:390,height:844}}),p=await start(c);
    try{
     await p.evaluate(async size=>{const storage=await import('/lib/storage.js'),s=await storage.readState(),f=s.flights.find(f=>f.id==='demo-605');s.flights=Array.from({length:size},(_,i)=>({...structuredClone(f),id:'scale-'+i,flightNo:'VN'+String(i+100000)}));await storage.writeState(s);},size);
     await p.reload();await p.locator('[data-workspace-account]').waitFor();const started=Date.now();await navigate(p,390,'logbook');await p.locator('[data-flight-card]').first().waitFor();const loadMs=Date.now()-started;
     assert.equal(await p.locator('[data-flight-card]').count(),Math.min(80,size));if(size>80){await p.locator('[data-action=navy-more-records]').click();assert.equal(await p.locator('[data-flight-card]').count(),Math.min(160,size));}
     const searchStart=Date.now();await p.locator('[data-filter=search]').fill('VN100001');assert.equal(await p.locator('[data-flight-card]').count(),1);const searchMs=Date.now()-searchStart;
     await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await fits(p);report.performance.push({records:size,initialCards:Math.min(80,size),loadMs,searchMs});
    }finally{await c.close();}
   }
   await browser.close();browser=null;
  }
 }catch(error){report.errors.push({label,error:error.stack||String(error)});await current?.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
 finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await fs.writeFile(path.join(root,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
