import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {airportLocation,calculateFlightNight,isLocalNight,routePosition} from '../public/lib/flight-night.js';

const instant=clock=>'2026-11-07T'+clock+':00Z';
const flight=(out,end,extra={})=>({dep:'SGN',dest:'HAN',takeoffBy:'self',landingBy:'self',actual:{out:instant(out),in:instant(end)},...extra});
test('fixed local night includes 18:00 and excludes 06:00, independent of device timezone',()=>{
 for(const [utc,night]of [['10:59',false],['11:00',true],['22:59',true],['23:00',false]])assert.equal(isLocalNight(instant(utc),'Asia/Ho_Chi_Minh'),night,utc);
 assert.equal(isLocalNight(instant('12:30'),'Asia/Kolkata'),true);
 assert.equal(isLocalNight(instant('12:29'),'Asia/Kolkata'),false);
 assert.equal(isLocalNight(instant('09:00'),'Asia/Seoul'),true);
 assert.equal(isLocalNight(instant('10:00'),'Asia/Shanghai'),true);
});
test('airport aliases resolve offline; unknown or ambiguous codes never guess',()=>{
 assert.deepEqual(airportLocation(' sgn '),airportLocation('VVTS'));
 assert.equal(airportLocation('DEL').timeZone,'Asia/Kolkata');
 assert.equal(airportLocation('JFK').timeZone,'America/New_York');
 assert.equal(airportLocation('ZZZZ'),null);assert.equal(airportLocation(''),null);
});
test('IANA clocks apply seasonal offsets and DST transitions',()=>{
 assert.equal(isLocalNight('2026-07-01T21:30:00Z','America/New_York'),false);
 assert.equal(isLocalNight('2026-12-01T21:30:00Z','America/New_York'),false);
 assert.equal(isLocalNight('2026-07-01T22:30:00Z','America/New_York'),true);
 assert.equal(isLocalNight('2026-12-01T22:30:00Z','America/New_York'),false);
 const spring=calculateFlightNight(flight('00:00','01:00',{dep:'JFK',dest:'JFK',actual:{out:'2026-03-08T06:00:00Z',in:'2026-03-08T11:00:00Z'}}));
 assert.equal(spring.nightMinutes,240); // Local 01:00 -> 07:00, one hour skipped, night ends 06:00.
 const autumn=calculateFlightNight(flight('00:00','01:00',{dep:'JFK',dest:'JFK',actual:{out:'2026-11-01T05:00:00Z',in:'2026-11-01T12:00:00Z'}}));
 assert.equal(autumn.nightMinutes,360); // Local 01:00 repeats once.
});
test('night time is the portion of OUT to IN, including taxi after night begins',()=>{
 const f=flight('10:00','12:10');f.actual.off=instant('10:10');f.actual.on=instant('12:00');
 const before=structuredClone(f),result=calculateFlightNight(f);
 assert.equal(result.nightMinutes,70);assert.equal(result.routeEstimated,false);
 assert.deepEqual(result.takeoff,{day:1,night:0});assert.deepEqual(result.landing,{day:0,night:1});assert.deepEqual(f,before);
});
test('all day, all night, both clock boundaries, local midnight and UTC midnight',()=>{
 for(const [out,end,night]of [['01:00','04:00',0],['11:00','14:00',180],['10:30','11:30',30],['22:30','23:30',30],['16:30','18:30',120]])assert.equal(calculateFlightNight(flight(out,end)).nightMinutes,night,out);
 assert.equal(calculateFlightNight({...flight('00:00','00:00'),actual:{out:'2026-11-07T23:30:00Z',in:'2026-11-08T00:30:00Z'}}).nightMinutes,0);
 assert.equal(calculateFlightNight({...flight('00:00','00:00'),actual:{out:instant('00:00'),in:'2026-11-08T00:00:00Z'}}).nightMinutes,720);
});
test('missing event clocks do not invent takeoffs or landings from block clocks',()=>{
 const result=calculateFlightNight(flight('10:00','12:10'));
 assert.equal(result.nightMinutes,70);assert.equal(result.routeEstimated,true);
 assert.equal(result.takeoff,null);assert.equal(result.landing,null);
 const f=flight('10:00','12:10');f.actual.off=instant('11:00');
 assert.deepEqual(calculateFlightNight(f).takeoff,{day:0,night:1});assert.equal(calculateFlightNight(f).landing,null);
});
test('only my events are counted; PF never implies event ownership',()=>{
 const f=flight('10:00','12:00',{role:'PF',takeoffBy:'',landingBy:'other'});f.actual.off=instant('10:30');f.actual.on=instant('11:30');
 assert.equal(calculateFlightNight(f).takeoff,null);assert.deepEqual(calculateFlightNight(f).landing,{day:0,night:0});
});
test('takeoff and landing use each airport timezone at the exact OFF/ON instant',()=>{
 const f=flight('09:30','11:00',{dep:'SGN',dest:'ICN'});f.actual.off=instant('09:50');f.actual.on=instant('10:50');
 const result=calculateFlightNight(f);assert.deepEqual(result.takeoff,{day:1,night:0});assert.deepEqual(result.landing,{day:0,night:1});
 assert(result.nightMinutes>0&&result.nightMinutes<90);
});
test('fractional minutes round once and never exceed rounded block',()=>{
 assert.equal(calculateFlightNight({...flight('11:00','11:00'),actual:{out:'2026-11-07T11:00:00.100Z',in:'2026-11-07T11:00:30.100Z'}}).nightMinutes,1);
 assert.equal(calculateFlightNight(flight('11:00','11:00')).nightMinutes,0);
});
test('unknown airports keep night unknown while an independently known event can be counted',()=>{
 const f=flight('10:00','12:00',{dest:'ZZZZ'});f.actual.off=instant('10:30');f.actual.on=instant('11:30');
 const result=calculateFlightNight(f);assert.equal(result.nightMinutes,null);assert.equal(result.status,'unknown-airport');assert.deepEqual(result.takeoff,{day:1,night:0});assert.equal(result.landing,null);
});
test('invalid dates, non-UTC clocks, inverted sequence and blocks over 24h return unknown',()=>{
 for(const actual of [
  {out:instant('12:00'),in:instant('10:00')},
  {out:instant('10:00'),off:instant('09:00'),in:instant('12:00')},
  {out:'2026-11-07T10:00:00+07:00',in:instant('12:00')},
  {out:'2026-02-30T10:00:00Z',in:'2026-03-02T12:00:00Z'},
  {out:instant('10:00'),in:'2026-11-08T10:01:00Z'}
 ]){const r=calculateFlightNight({...flight('10:00','12:00'),actual});assert.equal(r.nightMinutes,null);assert.equal(r.status,'invalid-times');assert.equal(r.takeoff,null);}
 assert.equal(calculateFlightNight({actual:{}}).status,'missing-block');
});
test('great-circle routes cross the date line and handle identical points without NaN',()=>{
 const a={latitude:0,longitude:179},b={latitude:0,longitude:-179},mid=routePosition(a,b,.5);
 assert.equal(Math.abs(mid.longitude),180);assert.equal(mid.latitude,0);
 assert.deepEqual(routePosition(a,a,.5),a);assert.equal(routePosition(a,{latitude:0,longitude:-1},.5),null);
 const r=calculateFlightNight(flight('01:00','12:00',{dep:'NRT',dest:'LAX'}));assert.equal(r.status,'estimated');assert(Number.isInteger(r.nightMinutes));assert(r.nightMinutes>=0&&r.nightMinutes<=660);
});
test('night modules and geographic lookup are cached for offline entry',()=>{
 const sw=readFileSync('public/sw.js','utf8');for(const path of ['/lib/flight-night.js','/lib/flight-night-ui.js','/lib/vendor/tz-lookup.js','/ui/airport-map-data.js'])assert(sw.includes('"'+path+'"'));
});
