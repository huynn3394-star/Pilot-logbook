import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextWeatherIssueAt,weatherProductFreshness,weatherRefreshAt,noaaSource,savedReportTiming} from '../public/workspace/weather-report.js';
import {createWeatherWatch,mergeWeatherCache} from '../public/workspace/weather-watch.js';
import {createWeatherCollector} from '../public/workspace/weather.js';
import {WeatherService,MetOfficeProvider} from '../lib/weather.js';
import {renderWeatherStationIdentity} from '../public/workspace/weather-attention.js';

const at=value=>Date.parse('2026-11-22T'+value+'Z');
const bulletin=(issue='1000',fetched='10:01:00')=>({station:'VVPC',provider:'Fixture',fetchedAt:new Date(at(fetched)).toISOString(),metar:`METAR VVPC 22${issue}Z 02004KT 9999 FEW027 29/24 Q1012=`,taf:'TAF VVPC 220800Z 2209/2309 07008KT 9999 FEW020=',sources:{metar:noaaSource('VVPC','metar'),taf:noaaSource('VVPC','taf')}});
const response=value=>({ok:true,json:async()=>structuredClone(value)});
function harness(initial){
 let time=at('10:10:00'),stored=initial?{reports:{VVPC:initial}}:null,next=bulletin(),calls=0,writes=0;
 const options={airports:['VVPC'],now:()=>new Date(time),readCache:async()=>structuredClone(stored),writeCache:async(key,value)=>{writes++;stored=mergeWeatherCache(stored,value);return structuredClone(stored);},fetchImpl:async()=>{calls++;if(next instanceof Error)throw next;return response(next);}};
 return {options,set time(value){time=at(value);},get time(){return time;},set next(value){next=value;},get stored(){return stored;},get calls(){return calls;},get writes(){return writes;}};
}

test('a 10:00 METAR remains current until 10:30 regardless of receipt age or offline state',()=>{
 const r=bulletin(),before=JSON.stringify(r);
 assert.equal(nextWeatherIssueAt(r,'metar'),at('10:30:00'));
 for(const time of ['10:06:00','10:29:59'])assert.equal(weatherProductFreshness(r,'metar',{now:at(time)}).saved,false);
 assert.equal(weatherProductFreshness(r,'metar',{now:at('10:30:00')}).saved,true);
 assert.equal(JSON.stringify(r),before);
 assert.match(renderWeatherStationIdentity('VVPC',{current:true}),/>Current<\/span>/);
 assert.doesNotMatch(renderWeatherStationIdentity('VVPC',{current:true,saved:true}),/Current/);
});
test('a fresh receipt of an overdue bulletin never resets its deadline',()=>{
 const r=bulletin('1000','10:31:00');
 assert.equal(weatherProductFreshness(r,'metar',{now:at('10:31:00')}).saved,true);
 assert.equal(nextWeatherIssueAt(r,'metar'),at('10:30:00'));
});
test('SPECI does not shift the next VV routine report; international routine offsets survive',()=>{
 const r={...bulletin(),metar:bulletin('1018').metar.replace('METAR','SPECI'),fetchedAt:new Date(at('10:19:00')).toISOString()};
 assert.equal(nextWeatherIssueAt(r,'metar'),at('10:30:00'));
 const uk={...r,station:'EGLL',metar:'METAR EGLL 221020Z 9999=',fetchedAt:new Date(at('10:21:00')).toISOString()};
 assert.equal(nextWeatherIssueAt(uk,'metar'),at('10:50:00'));
});
test('METAR and TAF deadlines are independent; amendments retain their validity cycle',()=>{
 const r=bulletin();
 assert.equal(nextWeatherIssueAt(r,'taf'),at('14:00:00'));
 assert.equal(weatherProductFreshness(r,'metar',{now:at('13:59:59')}).saved,true);
 assert.equal(weatherProductFreshness(r,'taf',{now:at('13:59:59')}).saved,false);
 assert.equal(weatherProductFreshness(r,'taf',{now:at('14:00:00')}).saved,true);
 const amd={...r,fetchedAt:new Date(at('12:05:00')).toISOString(),taf:r.taf.replace('TAF VVPC 220800Z','TAF AMD VVPC 221200Z')};
 assert.equal(nextWeatherIssueAt(amd,'taf'),at('14:00:00'));
 const short={...r,taf:'TAF VVPC 220800Z 2209/2218 00000KT CAVOK='};
 assert.equal(nextWeatherIssueAt(short,'taf'),at('11:00:00'));
});
test('midnight/month/year rollover and cancelled TAF cannot extend current status',()=>{
 const r={...bulletin(),metar:'METAR VVPC 312330Z 9999=',fetchedAt:'2026-12-31T23:31:00Z'};
 assert.equal(nextWeatherIssueAt(r,'metar'),Date.parse('2027-01-01T00:00:00Z'));
 const cancelled={...bulletin(),taf:'TAF VVPC 221000Z CNL='};
 assert.equal(weatherProductFreshness(cancelled,'taf',{now:at('10:10:00')}).saved,true);
});
test('opening and reopening a fresh IndexedDB snapshot performs no network call or cache write',async()=>{
 const h=harness(bulletin());
 for(const time of ['10:10:00','10:20:00','10:29:59']){
  h.time=time;const watch=createWeatherWatch(h.options);await watch.refresh();
  assert.equal(watch.nextRefreshAt(),at('10:30:00'));watch.dispose();
 }
 assert.equal(h.calls,0);assert.equal(h.writes,0);
});
test('only due airports refresh, and a bulletin fetched seconds before the boundary still refreshes on time',async()=>{
 let time=at('10:29:59');const calls=[],old=bulletin(),fresh=bulletin('1030','10:30:00');
 const second={...fresh,station:'VVTS',metar:fresh.metar.replace('VVPC','VVTS'),taf:fresh.taf.replace('VVPC','VVTS'),sources:{metar:noaaSource('VVTS','metar'),taf:noaaSource('VVTS','taf')}};
 const watch=createWeatherWatch({airports:['VVPC','VVTS'],now:()=>new Date(time),readCache:async()=>({reports:{VVPC:old,VVTS:second},attempts:{VVPC:new Date(time).toISOString()}}),writeCache:async()=>{},fetchImpl:async url=>{calls.push(url);return response(fresh);}});
 await watch.refresh();assert.equal(calls.length,0);time=at('10:30:00');await watch.refresh();
 assert.equal(calls.length,1);assert.match(calls[0],/station=VVPC/);watch.dispose();
 // A retry from the previous cycle cannot hide a newly crossed METAR boundary,
 // including when an independently overdue TAF has an earlier deadline.
 const staleTAF={...old,taf:'TAF VVPC 220200Z 2203/2303 00000KT CAVOK='};
 assert.equal(weatherRefreshAt(staleTAF,new Date(at('10:29:59')).toISOString(),at('10:30:00')),at('10:30:00'));
});
test('unchanged/older replies stay saved; retry survives reload without changing issue dates',async()=>{
 const h=harness(bulletin()),watch=createWeatherWatch(h.options);await watch.ready;
 h.time='10:30:00';await watch.refresh();assert.equal(h.calls,1);
 let r=watch.snapshot().reports.VVPC;assert.equal(weatherProductFreshness(r,'metar',{now:h.time}).saved,true);
 assert.equal(watch.nextRefreshAt(),at('10:31:00'));watch.dispose();
 const reopened=createWeatherWatch(h.options);h.time='10:30:30';await reopened.refresh();assert.equal(h.calls,1);
 h.time='10:31:00';h.next=bulletin('0930','10:31:00');await reopened.refresh();assert.equal(h.calls,2);
 r=reopened.snapshot().reports.VVPC;assert.match(r.metar,/221000Z/);assert.equal(savedReportTiming(r,'metar').issuedAt,new Date(at('10:00:00')).toISOString());
 h.time='10:32:00';h.next=bulletin('1030','10:32:00');await reopened.refresh();
 assert.equal(weatherProductFreshness(reopened.snapshot().reports.VVPC,'metar',{now:h.time}).saved,false);
 assert.equal(reopened.nextRefreshAt(),at('11:00:00'));reopened.dispose();
});
test('failed refresh retries once per minute across reload and never destroys the last report',async()=>{
 const h=harness(bulletin());h.time='10:30:00';h.next=Error('unavailable');
 let watch=createWeatherWatch(h.options);await watch.refresh();assert.equal(h.calls,1);assert.ok(watch.snapshot().errors.VVPC);watch.dispose();
 h.time='10:30:40';watch=createWeatherWatch(h.options);await watch.refresh();assert.equal(h.calls,1);assert.match(watch.snapshot().reports.VVPC.metar,/221000Z/);
 h.time='10:31:00';await watch.refresh();assert.equal(h.calls,2);watch.dispose();
});
test('manual refresh bypasses a current bulletin and retry wait without automatic forced calls',async()=>{
 const h=harness(bulletin()),watch=createWeatherWatch(h.options);await watch.refresh();assert.equal(h.calls,0);
 await watch.refresh({force:true});assert.equal(h.calls,1);await watch.refresh();assert.equal(h.calls,1);watch.dispose();
});
test('server reuses current reports and checks exactly at the next publication, deduplicating callers',async()=>{
 let time=at('10:29:59'),calls=0,next=bulletin();
 const service=new WeatherService({name:'Fixture',fetch:async()=>{calls++;return next;}},60000,{now:()=>new Date(time)});
 await service.get('VVPC');time=at('10:30:00');await Promise.all([service.get('VVPC'),service.get('VVPC')]);assert.equal(calls,2);
 assert.equal(weatherProductFreshness(await service.get('VVPC'),'metar',{now:time}).saved,true);assert.equal(calls,2);
 time=at('10:31:00');next=bulletin('1030','10:31:00');await service.get('VVPC');assert.equal(calls,3);
 time=at('10:50:00');assert.equal((await service.get('VVPC')).cached,true);assert.equal(calls,3);
 await service.get('VVPC',{force:true});assert.equal(calls,4);
});
test('a failed server refresh cannot be disguised as a fresh bulletin by its retry cache',async()=>{
 let time=at('10:10:00'),calls=0,fail=false;
 const service=new WeatherService({name:'Fixture',fetch:async()=>{calls++;if(fail)throw Error('offline');return bulletin();}},60000,{now:()=>new Date(time)});
 await service.get('VVPC');time=at('10:30:00');fail=true;const failed=await service.get('VVPC');
 assert.equal(failed.stale,true);assert.equal(weatherProductFreshness(failed,'metar',{now:time}).saved,true);
 await service.get('VVPC');assert.equal(calls,2);time=at('10:31:00');await service.get('VVPC');assert.equal(calls,3);
});
test('MET Office feed cache cannot straddle a half-hour boundary',async()=>{
 let time=at('10:29:59'),pages=0;
 const provider=new MetOfficeProvider({username:'fixture',password:'fixture',now:()=>new Date(time),fetchImpl:async(url,options)=>{
  if(options.method==='POST')return new Response('Logout',{headers:{'Set-Cookie':'PHPSESSID=fixture'}});
  pages++;return new Response('Logout <pre>'+(new URL(url).searchParams.get('cat')==='1'?bulletin().metar:bulletin().taf)+'</pre>');
 }});
 await provider.fetch('VVPC');assert.equal(pages,2);await provider.fetch('VVPC');assert.equal(pages,2);
 time=at('10:30:00');await provider.fetch('VVPC');assert.equal(pages,4);
 await provider.fetch('VVPC',{force:true});assert.equal(pages,6);
});
test('flight weather already saved for the current cycle is reused after a collector restart',async()=>{
 let time=at('10:10:00'),calls=0;
 const flight={date:'2026-11-22',dep:'VVPC',dest:'VVPC',weather:{day:'2026-11-22',reports:[{...bulletin(),source:noaaSource('VVPC','metar')}]}};
 const collector=createWeatherCollector({now:()=>new Date(time),fetch:async()=>{calls++;return response(bulletin('1030','10:30:00'));}});
 assert.deepEqual((await collector.collect(flight)).weather,flight.weather);assert.equal(calls,0);
 const legacy=structuredClone(flight);delete legacy.weather.reports[0].sources;
 assert.deepEqual((await collector.collect(legacy)).weather,legacy.weather);assert.equal(calls,0);
 time=at('10:30:00');await collector.collect(flight);assert.equal(calls,1);
});
