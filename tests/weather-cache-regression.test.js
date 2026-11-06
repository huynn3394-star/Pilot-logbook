import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportTiming,savedReportTiming,mergeWeatherProducts,noaaSource} from '../public/workspace/weather-report.js';
import {weatherProductState} from '../public/workspace/weather-watch-ui.js';
import {createWeatherWatch} from '../public/workspace/weather-watch.js';
import {WeatherService} from '../lib/weather.js';
const bulletin=(day='06',fetchedAt='2026-11-06T06:40:00Z')=>({station:'VVPC',provider:'Fixture',fetchedAt,metar:`METAR VVPC ${day}0630Z 02004KT 9999 FEW027 29/24 Q1012=`,taf:`TAF VVPC ${day}0500Z ${day}06/${day}24 07008KT 9999 FEW020=`,sources:{metar:noaaSource('VVPC','metar'),taf:noaaSource('VVPC','taf')}});
const response=data=>({ok:true,json:async()=>structuredClone(data)});

test('day 30 fetched mid-month is previous month, never a future issue that beats day 06',()=>{
 const old=bulletin('30','2026-11-16T06:40:00Z'),latest=bulletin();
 assert.equal(reportTiming(old.metar,'metar',new Date(old.fetchedAt)).issuedAt,'2026-10-30T06:30:00.000Z');
 assert.equal(mergeWeatherProducts(latest,old).metar,latest.metar);
 assert.equal(reportTiming('METAR VVPC 010000Z 9999=','metar',new Date('2026-12-31T23:59:00Z')).issuedAt,'2027-01-01T00:00:00.000Z');
 assert.equal(reportTiming('METAR VVPC 310000Z 9999=','metar',new Date('2026-03-01T00:10:00Z')),null);
});
test('re-fetching identical day-30 text cannot move its issue date into another month',()=>{
 const old=bulletin('30','2026-10-30T06:40:00Z'),again={...old,fetchedAt:'2026-11-30T06:40:00Z'};
 const merged=mergeWeatherProducts(old,again);
 assert.equal(savedReportTiming(merged,'metar').issuedAt,'2026-10-30T06:30:00.000Z');
 assert.equal(savedReportTiming(mergeWeatherProducts(merged,{...again,fetchedAt:'2026-12-30T06:40:00Z'}),'taf').issuedAt,'2026-10-30T05:00:00.000Z');
});
test('equal-time original cannot undo COR and missing products keep their own dates and sources',()=>{
 const old=bulletin(),corrected={...old,metar:old.metar.replace('METAR ','METAR COR ')};
 const r=mergeWeatherProducts(corrected,{...old,taf:null,fetchedAt:'2026-11-06T07:00:00Z'});
 assert.equal(r.metar,corrected.metar);assert.equal(r.taf,old.taf);
 assert.equal(r.productFetchedAt.taf,old.fetchedAt);assert.equal(r.staleProducts.taf,true);
});
test('refresh day 30 -> day 06 -> older partial -> failure -> offline reopen keeps newest products',async()=>{
 let stored={reports:{VVPC:bulletin('30','2026-10-30T06:40:00Z')}},next=bulletin();
 const options={uid:'regression',airports:['VVPC'],now:()=>new Date('2026-11-06T07:00:00Z'),readCache:async()=>structuredClone(stored),writeCache:async(key,value)=>{stored=structuredClone(value);},fetchImpl:async()=>{if(next instanceof Error)throw next;return response(next);}};
 const w=createWeatherWatch(options);await w.refresh({force:true});next={...bulletin('30','2026-11-06T07:00:00Z'),taf:null};await w.refresh({force:true});
 assert.equal(w.snapshot().reports.VVPC.metar,bulletin().metar);assert.equal(w.snapshot().reports.VVPC.taf,bulletin().taf);
 next=Error('offline');await w.refresh({force:true});assert.ok(w.snapshot().errors.VVPC);w.dispose();
 const reopened=createWeatherWatch(options);await reopened.ready;assert.equal(reopened.snapshot().reports.VVPC.metar,bulletin().metar);assert.equal(savedReportTiming(reopened.snapshot().reports.VVPC,'taf').issuedAt,'2026-11-06T05:00:00.000Z');reopened.dispose();
});
test('wrong-station raw text cannot replace the selected station despite matching envelope',async()=>{
 const w=createWeatherWatch({airports:['VVPC'],readCache:async()=>({reports:{VVPC:bulletin()}}),writeCache:async()=>{},fetchImpl:async()=>response({...bulletin(),metar:'METAR VVTS 060700Z 9999=',taf:null})});
 await w.refresh({force:true});assert.equal(w.snapshot().reports.VVPC.metar,bulletin().metar);assert.ok(w.snapshot().errors.VVPC);w.dispose();
});
test('server cache cannot regress or re-date retained TAF on older replies, empty replies or restart',async()=>{
 let next=bulletin();const provider={name:'Fixture',fetch:async()=>{if(next instanceof Error)throw next;return next;}},service=new WeatherService(provider,-1);
 const first=await service.get('VVPC');next={...bulletin('30',new Date().toISOString()),taf:null};const older=await service.get('VVPC');assert.equal(older.metar,first.metar);assert.equal(older.taf,first.taf);assert.equal(older.productFetchedAt.taf,first.productFetchedAt.taf);
 next={metar:null,taf:null};const empty=await service.get('VVPC');assert.equal(empty.metar,first.metar);assert.equal(empty.stale,true);
 // A cold server has no durable reports and must not invent a successful empty cache.
 const restarted=new WeatherService(provider);await assert.rejects(()=>restarted.get('VVPC'),error=>error.status===502);
});

test('saved status only changes the label, preserving day-06 text, and flags invalid/future/expired timing',()=>{
 const r=bulletin(),time=Date.parse('2026-11-06T06:42:00Z'),copy=JSON.stringify(r);
 assert.equal(weatherProductState(r,'metar',{now:time}).saved,false);
 assert.equal(weatherProductState(r,'metar',{now:time,offline:true}).saved,true);
 assert.equal(weatherProductState(r,'metar',{now:time,error:'timeout'}).saved,true);
 assert.equal(JSON.stringify(r),copy);
 assert.equal(weatherProductState(r,'metar',{now:Date.parse('2026-11-06T09:00:00Z')}).old,true);
 assert.equal(weatherProductState(r,'taf',{now:Date.parse('2026-11-07T00:00:00Z')}).expired,true);
 assert.equal(weatherProductState({...r,productIssuedAt:{metar:'2026-12-06T06:30:00Z'}},'metar',{now:time}).invalid,true);
});

test('v1 cache migrates once into v2 and later writes from pre-upgrade tabs cannot roll it back',async()=>{
 const rows=new Map([['weather-watch:v1:account:migration',{reports:{VVPC:bulletin('30','2026-10-30T06:40:00Z')}}]]);
 const options={uid:'migration',airports:['VVPC'],readCache:async key=>structuredClone(rows.get(key)),writeCache:async(key,value)=>{rows.set(key,structuredClone(value));},fetchImpl:async()=>response(bulletin())};
 const w=createWeatherWatch(options);await w.ready;assert.match(rows.get('weather-watch:v2:account:migration').reports.VVPC.metar,/300630Z/);await w.refresh({force:true});w.dispose();
 rows.set('weather-watch:v1:account:migration',{reports:{VVPC:bulletin('30','2026-10-30T06:40:00Z')}});
 const reopened=createWeatherWatch(options);await reopened.ready;assert.match(reopened.snapshot().reports.VVPC.metar,/060630Z/);reopened.dispose();
});

test('UTC month/year rollover, leap day and TAF validity remain anchored to the bulletin',()=>{
 assert.equal(reportTiming('METAR VVPC 312330Z 9999=','metar',new Date('2027-01-01T00:10:00Z')).issuedAt,'2026-12-31T23:30:00.000Z');
 assert.equal(reportTiming('METAR VVPC 292330Z 9999=','metar',new Date('2028-03-01T00:10:00Z')).issuedAt,'2028-02-29T23:30:00.000Z');
 const t=reportTiming('TAF VVPC 312300Z 0100/0206 00000KT CAVOK=','taf',new Date('2026-12-31T23:10:00Z'));assert.equal(t.validFrom,'2027-01-01T00:00:00.000Z');assert.equal(t.validTo,'2027-01-02T06:00:00.000Z');
 assert.equal(savedReportTiming({...bulletin(),productIssuedAt:{metar:'2026-11-05T06:30:00Z'}},'metar'),null);
});
test('dual providers select newer issue and equal-time correction with correct product provenance',async()=>{
 const {PriorityWeatherProvider}=await import('../lib/weather.js');
 const latest=bulletin(),cor=latest.metar.replace('METAR ','METAR COR '),primary={name:'Primary',fetch:async()=>({...latest,sources:undefined})},fallback={name:'Fallback',fetch:async()=>({...latest,metar:cor,taf:null,sources:undefined})};
 const p=new PriorityWeatherProvider({primary,fallback,now:()=>new Date('2026-11-06T06:40:00Z')});const result=await p.fetch('VVPC');assert.equal(result.metar,cor);assert.equal(result.provenance.metar.provider,'Fallback');assert.equal(result.taf,latest.taf);assert.equal(result.provenance.taf.provider,'Primary');
 primary.fetch=async()=>bulletin('30','2026-10-30T06:40:00Z');assert.equal((await p.fetch('VVPC')).metar,cor);
});
