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
