import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultFilters,selectFlights,flightGroups,renderLogbook,renderFlightCard,monthLabel} from '../public/ui/navy-v2.js';
const flight={id:'f-1',date:'2026-10-31',flightNo:'VN0991',dep:'SGN',dest:'HAN',reg:'VN-A603',aircraft:'A321',role:'PM',captainId:'p-1',confirmed:true,scheduled:{out:'2026-10-31T23:40:00Z',in:'2026-11-01T01:10:00Z'},actual:{out:'2026-10-31T23:50:15.123Z',off:'2026-11-01T00:00:15.123Z',on:'2026-11-01T01:00:15.123Z',in:'2026-11-01T01:10:15.123Z'},picMinutes:0,nightMinutes:30,note:'preserve',logbook:{version:1,sicMinutes:80,ifrMinutes:70,instrumentMinutes:25}};
const other={...structuredClone(flight),id:'f-2',date:'2026-11-01',flightNo:'VN0992',confirmed:false,aircraft:'E190',actual:{},logbook:undefined};
const options=patch=>({month:'2026-10',filters:{...defaultFilters(),...patch},people:[{id:'p-1',name:'Nguyễn Văn A',rank:'Captain'}]});

test('Navy month grouping uses the stored UTC flight date and existing confirmed block totals',()=>{
 const groups=flightGroups([flight,other]);assert.deepEqual(groups.map(g=>g.month),['2026-10','2026-11']);
 assert.equal(groups[0].totals.block,80);assert.equal(groups[0].totals.airborne,60);assert.equal(groups[1].totals.block,0);
 assert.equal(monthLabel('2026-10'),'October 2026');
});
test('Navy combined filters use real UTC ranges, ICAO/IATA, crew and explicit minute allocations',()=>{
 const opts=options({period:'range',from:'2026-10-31',to:'2026-11-01',airport:'vvts',pilot:'p-1',role:'PM',allocation:'sic',rules:'ifr',conditions:'instrument',minBlock:'80',maxBlock:'80'});
 assert.deepEqual(selectFlights([flight,other],{...opts,query:'nguyen van'}).map(f=>f.id),['f-1']);
 assert.equal(selectFlights([flight],options({allocation:'pic'})).length,0,'PM never implies PIC');
 assert.equal(selectFlights([other],options({period:'all',conditions:'instrument'})).length,0,'unknown instrument never becomes block');
 assert.equal(selectFlights([flight],options({minBlock:'81'})).length,0);
 assert.equal(selectFlights([flight],options({maxBlock:'79'})).length,0);
});
test('Navy incomplete and unconfirmed filters remain separate and Clear has no data effects',()=>{
 const completeDraft={...flight,id:'draft',confirmed:false};
 assert.deepEqual(selectFlights([flight,other,completeDraft],options({period:'all',status:'incomplete'})).map(f=>f.id),['f-2']);
 assert.equal(selectFlights([flight,completeDraft],options({status:'pending'})).length,1);
 assert.equal(selectFlights([flight,other],options({period:'all'})).length,2);
 assert.notEqual(defaultFilters(),defaultFilters());
});
test('Navy filter and card rendering never mutate records or original timestamp precision',()=>{
 const source=[structuredClone(flight),structuredClone(other)],before=structuredClone(source);
 selectFlights(source,options({period:'all'}));renderFlightCard(source[0]);renderLogbook({flights:source,people:[],month:'2026-10',query:'',filters:defaultFilters()});
 assert.deepEqual(source,before);assert.equal(source[0].actual.out,'2026-10-31T23:50:15.123Z');
});
test('Navy cards distinguish flight and block, next-day IN, FINAL and draft values',()=>{
 const html=renderFlightCard(flight);assert.match(html,/FLIGHT/);assert.match(html,/01:00/);assert.match(html,/BLOCK/);assert.match(html,/01:20/);assert.match(html,/IN 2026-11-01/);assert.match(html,/FINAL/);
 assert.match(renderFlightCard({...flight,confirmed:false}),/Chưa tính vào tổng Actual/);
 assert.match(renderFlightCard({...flight,actual:{}}),/BLOCK<\/small><b class="mono">—/);
});
test('Navy card text and IDs cannot inject markup or nested interactive controls',()=>{
 const html=renderFlightCard({...flight,id:'"><img src=x onerror=bad()>',flightNo:'<script>bad()</script>',reg:'" onclick="bad'});
 assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.equal((html.match(/<button/g)||[]).length,3);
 let depth=0,maxDepth=0;for(const tag of html.match(/<\/?button\b[^>]*>/g)||[]){depth+=tag.startsWith('</')?-1:1;maxDepth=Math.max(maxDepth,depth);assert(depth>=0);}assert.equal(depth,0);assert.equal(maxDepth,1,'Interactive buttons must be siblings, not nested');
});
test('Navy 10,000-record results bound the initial DOM and totals include unloaded matching records',()=>{
 const flights=Array.from({length:10000},(_,i)=>({...flight,id:'scale-'+String(i).padStart(5,'0')}));
 const start=performance.now(),selected=selectFlights(flights,options({}));
 const html=renderLogbook({flights,people:[],month:'2026-10',query:'',filters:defaultFilters(),limit:80});
 assert.equal(selected.length,10000);assert.equal((html.match(/data-flight-card=/g)||[]).length,80);
 assert.match(html,/10000 chuyến/);assert.match(html,/13333:20/);assert.match(html,/navy-more-records/);
 console.log(JSON.stringify({records:10000,initialCards:80,filterAndRenderMs:Math.round(performance.now()-start)}));
});
