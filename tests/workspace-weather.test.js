import {test} from 'node:test';import assert from 'node:assert/strict';import {createWeatherCollector} from '../public/workspace/weather.js';
const flight={date:'2026-10-20',dep:'SGN',dest:'HAN'},report=station=>({station,provider:'NOAA Aviation Weather Center',fetchedAt:'2026-10-20T03:00:00.000Z',metar:station+' 200300Z 00000KT CAVOK 30/24 Q1010',taf:'TAF '+station+' 200200Z 2006/2112 00000KT CAVOK'});
test('only dep/arrival raw text for this UTC flight day is collected once per load and airport; manual refresh remains explicit',async()=>{
 const requests=[],collector=createWeatherCollector({now:()=>new Date('2026-10-20T04:00:00Z'),isCurrent:()=>true,fetch:async url=>{const station=new URL(url,'https://qa.test').searchParams.get('station');requests.push(station);return{ok:true,json:async()=>report(station)};}});
 const [first,second]=await Promise.all([collector.collect(flight),collector.collect(flight)]);assert.deepEqual(requests.sort(),['VVNB','VVTS']);assert.equal(first.weather.reports.length,2);assert.deepEqual(first,second);assert.ok(first.weather.reports.every(r=>r.source.startsWith('https://aviationweather.gov/api/data/')));assert.equal(JSON.stringify(first).includes('data:image'),false);
 await collector.collect({...flight,dest:'SGN'});assert.equal(requests.length,2);await collector.collect(flight,{refresh:true});assert.equal(requests.length,4);
});
test('old or future flight never requests today latest and retains its saved weather text',async()=>{
 let calls=0;const collector=createWeatherCollector({now:()=>new Date('2026-10-20T04:00:00Z'),fetch:async()=>{calls++;throw Error('should not fetch');}});for(const date of['2026-10-19','2026-10-21']){const saved={day:date,reports:[]},result=await collector.collect({...flight,date,weather:saved});assert.deepEqual(result.weather,saved);assert.equal(result.status,'historical');}assert.equal(calls,0);
});
test('offline, no data and provider failure preserve previously saved report rather than erase it',async()=>{
 const saved={day:flight.date,reports:[{...report('VVTS'),source:'https://aviationweather.gov/api/data/metar?ids=VVTS&format=raw'}]};for(const fetch of[async()=>{throw Error('offline');},async()=>({ok:true,json:async()=>({...report('VVTS'),metar:null,taf:null})})]){const collector=createWeatherCollector({fetch,now:()=>new Date('2026-10-20T04:00:00Z'),isCurrent:()=>true}),result=await collector.collect({...flight,weather:saved});assert.equal(result.weather.reports[0].metar,saved.reports[0].metar);assert.ok(result.errors.length);}
});
test('account switch, midnight UTC and wrong-station/stale-day API reply cannot be attached to a flight',async()=>{
 let current=true;const switched=createWeatherCollector({now:()=>new Date('2026-10-20T04:00:00Z'),isCurrent:()=>current,fetch:async()=>{current=false;return{ok:true,json:async()=>report('VVTS')};}});await assert.rejects(()=>switched.collect(flight,{token:{uid:'alice'}}),/tài khoản|Tài khoản/);
 let date='2026-10-20T23:59:59Z';const midnight=createWeatherCollector({now:()=>new Date(date),fetch:async()=>{date='2026-10-21T00:00:01Z';return{ok:true,json:async()=>report('VVTS')};}});await assert.rejects(()=>midnight.collect(flight),/ngày|UTC/);
 const wrong=createWeatherCollector({now:()=>new Date('2026-10-20T04:00:00Z'),fetch:async()=>({ok:true,json:async()=>({...report('VTBS'),fetchedAt:'2026-10-19T03:00:00Z'})})});const result=await wrong.collect(flight);assert.equal(result.weather,null);assert.equal(result.errors.length,2);
});
