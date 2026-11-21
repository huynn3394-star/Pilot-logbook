import {test} from 'node:test';import assert from 'node:assert/strict';
import * as weather from '../public/workspace/weather.js';
const now=()=>new Date('2026-10-21T04:10:00Z');
const data=station=>({station,provider:'Tan Son Nhat MET Office',fetchedAt:now().toISOString(),metar:`METAR ${station} 210400Z VRB03KT 9999 SCT037 34/26 Q1013 NOSIG=`,taf:`TAF AMD ${station} 210200Z 2103/2209 05007KT 9999 SCT017 TEMPO 2106/2109 4000 TSRA SCT015 FEW017CB TEMPO 2109/2112 04015G26KT 2500 +TSRA BKN013 SCT015CB=`,sources:{metar:'http://118.69.213.84/index.php?cat=1&sub=6',taf:'http://118.69.213.84/index.php?cat=2&sub=0'}});
const backend=()=>{const rows=new Map();return{readCache:async key=>structuredClone(rows.get(key)),writeCache:async(key,value)=>rows.set(key,structuredClone(value))};};
const fetchImpl=async url=>({ok:true,json:async()=>data(new URL(url,'https://qa.test').searchParams.get('station'))});
test('watchlist normalizes supported IATA, rejects bad input and duplicate airports without mutating caller',()=>{
 assert.equal(typeof weather.normalizeAirports,'function');const list=['sgn',' VVNB ','SGN'];assert.deepEqual(weather.normalizeAirports(list),['VVTS','VVNB']);assert.deepEqual(list,['sgn',' VVNB ','SGN']);assert.throws(()=>weather.normalizeAirports(['<script>']));
});
test('cached full reports reopen offline for the same UID while another UID starts empty',async()=>{
 assert.equal(typeof weather.createWeatherWatch,'function');const store=backend();
 const a=weather.createWeatherWatch({uid:'alice',airports:['SGN','HAN'],...store,fetchImpl,now});await a.refresh();assert.match(a.snapshot().reports.VVTS.taf,/04015G26KT 2500 \+TSRA BKN013 SCT015CB=/);a.dispose();
 const offline=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,fetchImpl:async()=>{throw Error('offline');},now});await offline.ready;assert.equal(offline.snapshot().reports.VVTS.metar,data('VVTS').metar);await offline.refresh({force:true});assert.equal(offline.snapshot().reports.VVTS.metar,data('VVTS').metar);assert.ok(offline.snapshot().errors.VVTS);
 const b=weather.createWeatherWatch({uid:'bob',airports:['VVTS'],...store,fetchImpl,now});await b.ready;assert.equal(b.snapshot().reports.VVTS,undefined);offline.dispose();b.dispose();
});
test('late replies for a removed airport or switched account cannot return it to the screen or write the new account cache',async()=>{
 assert.equal(typeof weather.createWeatherWatch,'function');let release,current=true;const held=new Promise(r=>release=r),store=backend();
 const a=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,now,isCurrent:()=>current,fetchImpl:async url=>{await held;return fetchImpl(url);}});const p=a.refresh();await a.ready;a.setAirports([]);current=false;release();await p;assert.equal(a.snapshot().reports.VVTS,undefined);a.dispose();
 const b=weather.createWeatherWatch({uid:'bob',airports:['VVTS'],...store,fetchImpl,now});await b.ready;assert.deepEqual(b.snapshot().reports,{});b.dispose();
});
test('cache quota failure never reports a newly fetched report as durable offline',async()=>{
 assert.equal(typeof weather.createWeatherWatch,'function');const a=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],readCache:async()=>null,writeCache:async()=>{throw Error('QuotaExceededError');},fetchImpl,now});await a.refresh();assert.ok(a.snapshot().reports.VVTS);assert.ok(a.snapshot().cacheError);a.dispose();
});
test('partial refresh retains each saved product with its own source, retrieval time and stale label',async()=>{
 let partial=false;const store=backend(),watch=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,now,fetchImpl:async()=>({ok:true,json:async()=>partial?{...data('VVTS'),fetchedAt:'2026-10-21T05:00:00Z',metar:'METAR VVTS 210500Z 00000KT CAVOK 30/24 Q1013=',taf:null,sources:{metar:'https://aviationweather.gov/api/data/metar?ids=VVTS&format=raw'}}:data('VVTS')})});
 await watch.refresh();partial=true;await watch.refresh({force:true});const r=watch.snapshot().reports.VVTS;assert.equal(r.taf,data('VVTS').taf);assert.equal(r.sources.taf,data('VVTS').sources.taf);assert.equal(r.productFetchedAt.taf,now().toISOString());assert.equal(r.staleProducts.taf,true);assert.equal(r.productFetchedAt.metar,'2026-10-21T05:00:00Z');watch.dispose();
 const offline=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,now});await offline.ready;assert.equal(offline.snapshot().reports.VVTS.taf,data('VVTS').taf);assert.equal(offline.snapshot().reports.VVTS.staleProducts.taf,true);offline.dispose();
});
test('cached bulletin dates remain anchored to original retrieval after an offline month',async()=>{
 const {savedReportTiming}=await import('../public/workspace/weather-report.js');const store=backend(),watch=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,now,fetchImpl});await watch.refresh();watch.dispose();
 const later=weather.createWeatherWatch({uid:'alice',airports:['VVTS'],...store,now:()=>new Date('2026-11-21T04:10:00Z')});await later.ready;const r=later.snapshot().reports.VVTS,t=savedReportTiming(r,'metar');assert.equal(t.issuedAt,'2026-10-21T04:00:00.000Z');assert.ok(new Date('2026-11-21T04:10:00Z')-Date.parse(t.issuedAt)>30*86400000);assert.equal(savedReportTiming(r,'taf').validTo,'2026-10-22T09:00:00.000Z');later.dispose();
});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('all airports publish together after concurrent requests, with one cache write',async()=>{
 const airports=['VVTS','VVNB','VVDN','VVPC','VTBS','WSSS'];
 const held=new Map(airports.map(station=>[station,Promise.withResolvers()])),started=[],events=[],writes=[];
 const watch=weather.createWeatherWatch({airports,now,readCache:async()=>null,
  writeCache:async(key,value)=>{writes.push(structuredClone(value));},
  fetchImpl:async url=>{const station=new URL(url,'https://qa.test').searchParams.get('station');started.push(station);await held.get(station).promise;return fetchImpl(url);},
 });
 await watch.ready;watch.subscribe(value=>events.push(value));const refresh=watch.refresh();await tick();
 assert.deepEqual(started,airports.slice(0,4));assert.deepEqual(events.at(-1).loading,airports);
 held.get('VVTS').resolve();await tick();held.get('VVNB').resolve();await tick();
 assert.deepEqual(started,airports);assert.deepEqual(watch.snapshot().reports,{});
 assert.equal(events.length,2);assert.equal(writes.length,0);
 for(const gate of held.values())gate.resolve();await refresh;
 assert.deepEqual(Object.keys(watch.snapshot().reports).sort(),[...airports].sort());
 assert.deepEqual(events.at(-1).loading,[]);assert.equal(events.length,3);assert.equal(writes.length,1);
 const eventCount=events.length;await watch.refresh();assert.equal(events.length,eventCount,'fresh cache needs no repaint');watch.dispose();
});
test('a failed airport keeps its cached bulletin while the rest of the batch updates',async()=>{
 const old={...data('VVNB'),fetchedAt:'2026-10-21T03:10:00Z',metar:'METAR VVNB 210300Z 00000KT CAVOK 30/24 Q1013=',taf:null};
 const held=Promise.withResolvers(),events=[];
 const watch=weather.createWeatherWatch({airports:['VVTS','VVNB'],now,readCache:async()=>({reports:{VVNB:old}}),writeCache:async()=>{},fetchImpl:async url=>{
  if(url.includes('VVNB')){await held.promise;throw Error('provider unavailable');}return fetchImpl(url);
 }});
 await watch.ready;watch.subscribe(value=>events.push(value));const refresh=watch.refresh({force:true});await tick();
 assert.equal(watch.snapshot().reports.VVTS,undefined);assert.equal(watch.snapshot().reports.VVNB.metar,old.metar);
 held.resolve();await refresh;
 assert.ok(watch.snapshot().reports.VVTS);assert.equal(watch.snapshot().reports.VVNB.metar,old.metar);
 assert.equal(watch.snapshot().errors.VVNB,'provider unavailable');assert.equal(events.length,3);watch.dispose();
});
test('changing the list mid-batch excludes removed results and refreshes added airports',async()=>{
 const held=Promise.withResolvers(),writes=[];
 const watch=weather.createWeatherWatch({airports:['VVTS','VVNB'],now,readCache:async()=>null,
  writeCache:async(key,value)=>{writes.push(value);},fetchImpl:async url=>{if(url.includes('VVNB'))await held.promise;return fetchImpl(url);},
 });
 const first=watch.refresh();await tick();watch.setAirports(['VVNB','VVDN']);const second=watch.refresh();held.resolve();await Promise.all([first,second]);
 assert.deepEqual(Object.keys(watch.snapshot().reports).sort(),['VVDN','VVNB']);
 assert.ok(writes.every(value=>!value.reports.VVTS));assert.deepEqual(watch.snapshot().loading,[]);watch.dispose();
});
test('disposing mid-batch cannot publish or save staged replies',async()=>{
 const held=Promise.withResolvers(),events=[],writes=[];
 const watch=weather.createWeatherWatch({airports:['VVTS','VVNB'],now,readCache:async()=>null,writeCache:async(key,value)=>writes.push(value),fetchImpl:async url=>{if(url.includes('VVNB'))await held.promise;return fetchImpl(url);}});
 await watch.ready;watch.subscribe(value=>events.push(value));const refresh=watch.refresh();await tick();watch.dispose();held.resolve();await refresh;
 assert.deepEqual(watch.snapshot().reports,{});assert.equal(writes.length,0);assert.equal(events.length,2);
});
