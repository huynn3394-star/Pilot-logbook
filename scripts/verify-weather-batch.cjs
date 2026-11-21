/* Synthetic delayed replies only; verify a single visual update on phone-sized views. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {createServer}=await import('../server.js');
 const server=createServer({firebaseConfig:{enabled:false}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{for(const [name,type]of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
   await page.clock.setFixedTime(new Date('2026-10-21T04:10:00Z'));
   await page.route(origin+'/weather-batch-qa',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="weather"></div>'}));
   await page.goto(origin+'/weather-batch-qa');
   const proof=await page.evaluate(async()=>{
    const {createWeatherWatch}=await import('/workspace/weather-watch.js');
    const {mountWeatherWatch}=await import('/workspace/weather-watch-ui.js');
    const {noaaSource}=await import('/workspace/weather-report.js');
    const airports=['VVTS','VVNB','VVDN','VVPC','VTBS','WSSS'],groups=[{id:'test',name:'Test',airports}];
    const report=(station,fresh=false)=>({station,provider:'Fixture',fetchedAt:'2026-10-21T04:10:00Z',metar:`METAR ${station} 210400Z 00000KT CAVOK 30/24 Q${fresh?'1013':'1010'}=`,taf:`TAF ${station} 210200Z 2103/2124 00000KT ${fresh?'9999 SCT020':'CAVOK'}=`,sources:{metar:noaaSource(station,'metar'),taf:noaaSource(station,'taf')}});
    const gates=new Map(airports.map(station=>[station,Promise.withResolvers()])),started=[];
    const watch=createWeatherWatch({airports,readCache:async()=>({reports:Object.fromEntries(airports.map(station=>[station,report(station)]))}),writeCache:async()=>{},fetchImpl:async url=>{
     const station=new URL(url,location.origin).searchParams.get('station');started.push(station);await gates.get(station).promise;
     return{ok:true,json:async()=>report(station,true)};
    }});
    await watch.ready;
    const host=document.getElementById('weather'),dispose=mountWeatherWatch({element:host,watch,getGroups:()=>structuredClone(groups),onGroups:async()=>{}});
    host.querySelector('[data-weather-product=taf]').click();
    const search=host.querySelector('[data-weather-search]');search.value='SIN';search.dispatchEvent(new Event('input',{bubbles:true}));
    host.querySelector('[data-weather-station=WSSS]').open=true;
    const cards=host.querySelector('[data-weather-cards]');let replacements=0;
    const observer=new MutationObserver(records=>{replacements+=records.filter(record=>record.target===cards).length;});observer.observe(cards,{childList:true});
    const initial=cards.firstChild,refresh=watch.refresh({force:true}),tick=()=>new Promise(resolve=>setTimeout(resolve,0));await tick();
    gates.get('VVTS').resolve();await tick();gates.get('VVNB').resolve();await tick();
    const during={replacements,stable:cards.firstChild===initial,reports:Object.values(watch.snapshot().reports).every(value=>value.metar.includes('Q1010')),loading:watch.snapshot().loading.length,started:started.length,disabled:host.querySelector('[data-watch-refresh]').disabled};
    for(const gate of gates.values())gate.resolve();await refresh;await tick();
    const after={replacements,reports:Object.values(watch.snapshot().reports).every(value=>value.metar.includes('Q1013')),search:search.value,open:host.querySelector('[data-weather-station=WSSS]').open,product:host.querySelector('[data-weather-product=taf]').getAttribute('aria-pressed'),visible:[...host.querySelectorAll('[data-weather-station]')].filter(row=>!row.hidden).map(row=>row.dataset.weatherStation),disabled:host.querySelector('[data-watch-refresh]').disabled};
    observer.disconnect();dispose.dispose();watch.dispose();return{during,after};
   });
   assert.deepEqual(proof.during,{replacements:0,stable:true,reports:true,loading:6,started:6,disabled:true});
   assert.deepEqual(proof.after,{replacements:1,reports:true,search:'SIN',open:true,product:'true',visible:['WSSS'],disabled:false});
   console.log(name+': 6 airports, no partial repaint, one final replacement; search, TAF and open row preserved');
   await context.close();
  }finally{await browser.close();}
 }}finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
