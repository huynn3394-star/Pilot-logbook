/* Native IndexedDB, two tabs, installed worker upgrade and offline reopening.
 * Synthetic weather only. No production credentials or account writes. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const {createServer}=await import('../server.js');
 const old=await fs.readFile('tests/fixtures/workers/pre-weather-cache-sw.js','utf8'),next=await fs.readFile('public/sw.js','utf8'),module=await fs.readFile('public/workspace/weather-report.js','utf8');
 let worker=old,legacy=true,unavailable=false;
 const server=createServer({firebaseConfig:{enabled:false}}),handler=server.listeners('request')[0];server.removeAllListeners('request');
 server.on('request',(req,res)=>{
  if(unavailable){req.socket.destroy();return;}
  const url=new URL(req.url,'http://qa');
  const body=url.pathname==='/sw.js'?worker:url.pathname==='/workspace/weather-report.js'?(legacy?'// LEGACY_INSTALLED_WEATHER\n':'')+module:['/','/index.html'].includes(url.pathname)?'<html><head><meta charset="utf-8"></head><body><div id="weather"></div></body></html>':null;
  if(body!==null){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'application/javascript':'text/html','Cache-Control':'no-store'});res.end(body);}else handler(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const out=path.resolve('test-results/weather-cache');await fs.mkdir(out,{recursive:true});
 const results=[];
 try{for(const [name,type]of Object.entries({chromium,webkit})){
  worker=old;legacy=true;unavailable=false;
  const browser=await type.launch({headless:true}),context=await browser.newContext(),a=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));a.on('pageerror',e=>errors.push(e.message));
  try{
   await a.goto(origin);await a.evaluate(()=>navigator.serviceWorker.register('/sw.js'));await a.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
   assert.match(await a.evaluate(()=>fetch('/workspace/weather-report.js').then(r=>r.text())),/LEGACY_INSTALLED_WEATHER/);
   legacy=false;worker=next;
   assert.doesNotMatch(await(await a.request.get(origin+'/workspace/weather-report.js')).text(),/LEGACY_INSTALLED_WEATHER/);
   assert.match(await a.evaluate(()=>fetch('/workspace/weather-report.js').then(r=>r.text())),/LEGACY_INSTALLED_WEATHER/,'old controller still serves installed bytes despite new network source');
   await a.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
   let controlled=false;const deadline=Date.now()+15000;
   while(Date.now()<deadline){
    controlled=await a.evaluate(()=>new Promise(resolve=>{
     const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},500);
     channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.version.includes('weather-cache-20261106'));};
     navigator.serviceWorker.controller.postMessage({type:'avilog-shell-version'},[channel.port2]);
    }));if(controlled)break;await new Promise(r=>setTimeout(r,100));
   }
   assert.equal(controlled,true,'actual controller must acknowledge new version after installation');
   assert.doesNotMatch(await a.evaluate(()=>fetch('/workspace/weather-report.js').then(r=>r.text())),/LEGACY_INSTALLED_WEATHER/);
   const setup=async(page,initial)=>page.evaluate(async initial=>{
    const {createWeatherWatch}=await import('/workspace/weather-watch.js');
    window.make=(station,day)=>({station,provider:'Synthetic cache QA',fetchedAt:day==='30'?'2026-10-30T06:40:00Z':'2026-11-06T06:40:00Z',metar:`METAR ${station} ${day}0630Z 02004KT 9999 FEW027 29/24 Q1012=`,taf:`TAF ${station} ${day}0500Z ${day}06/${day}24 07008KT 9999 FEW020=`,sources:{metar:`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`,taf:`https://aviationweather.gov/api/data/taf?ids=${station}&format=raw`}});
    window.day='30';window.watch=createWeatherWatch({uid:'native-cache-qa',airports:initial?['VVPC','WSSS']:['VVPC'],now:()=>new Date('2026-11-06T07:00:00Z'),fetchImpl:async url=>({ok:true,json:async()=>make(new URL(url,location).searchParams.get('station'),day)})});await watch.ready;
    if(initial)await watch.refresh({force:true});
   },initial);
   await setup(a,true);const b=await context.newPage();await b.goto(origin);await setup(b,false);
   // Both tabs read day 30. A saves day 06, then B writes its older snapshot.
   await a.evaluate(async()=>{day='06';await watch.refresh({force:true});});
   await b.evaluate(()=>watch.refresh({force:true}));
   assert.match(await b.evaluate(()=>watch.snapshot().reports.VVPC.metar),/060630Z/);
   const persisted=await b.evaluate(async()=>{const{connect}=await import('/lib/storage.js'),db=await connect();return new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('weather-watch:v2:account:native-cache-qa');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});});
   assert.match(persisted.reports.VVPC.metar,/060630Z/);assert.match(persisted.reports.VVPC.taf,/060500Z/);assert.match(persisted.reports.WSSS.metar,/060630Z/);assert.equal(persisted.reports.VVPC.productIssuedAt.metar,'2026-11-06T06:30:00.000Z');
   // A pre-upgrade tab still writing v1 cannot touch v2's newest reports.
   await b.evaluate(async()=>{const{connect}=await import('/lib/storage.js'),db=await connect();await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put({reports:{VVPC:make('VVPC','30')}},'weather-watch:v1:account:native-cache-qa');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});});
   await b.evaluate(async()=>{watch.dispose();const{createWeatherWatch}=await import('/workspace/weather-watch.js');const other=createWeatherWatch({uid:'other-user',airports:['VVPC']});await other.ready;if(other.snapshot().reports.VVPC)throw Error('UID leak');other.dispose();});
   if(name==='chromium')await context.setOffline(true);else unavailable=true;
   assert.equal(await a.evaluate(()=>fetch('/api/health',{cache:'no-store'}).then(()=>false,()=>true)),true);
   await a.reload();
   await a.evaluate(async()=>{
    const{createWeatherWatch}=await import('/workspace/weather-watch.js'),{mountWeatherWatch}=await import('/workspace/weather-watch-ui.js');
    window.watch=createWeatherWatch({uid:'native-cache-qa',airports:['VVPC'],fetchImpl:async()=>{throw Error('offline');}});await watch.ready;await watch.refresh({force:true});
    window.ui=mountWeatherWatch({element:document.getElementById('weather'),watch,getGroups:()=>[{id:'qa',name:'QA',airports:['VVPC']}],onGroups:async()=>{}});
   });
   assert.match(await a.locator('[data-weather-station=VVPC]>summary').innerText(),/060630Z/);assert.match(await a.locator('[data-weather-station=VVPC]>summary').innerText(),/Bản lưu/);assert.doesNotMatch(await a.locator('[data-weather-station=VVPC]').innerText(),/300630Z/);
   await a.locator('[data-weather-product=taf]').click();assert.match(await a.locator('[data-weather-station=VVPC]>summary').innerText(),/060500Z/);assert.match(await a.locator('[data-weather-station=VVPC]>summary').innerText(),/Bản lưu/);
   await a.screenshot({path:path.join(out,name+'-offline.png'),fullPage:true});assert.deepEqual(errors,[]);
   const result={browser:name,workerUpgrade:true,twoTabAtomicMerge:true,otherStationPreserved:true,uidIsolation:true,nativeOfflineReopen:true,metar:'060630Z',taf:'060500Z'};results.push(result);console.log(JSON.stringify(result));
  }finally{unavailable=false;await context.close();await browser.close();}
 }}finally{await new Promise(r=>server.close(r));}
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
