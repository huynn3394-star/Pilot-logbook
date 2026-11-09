import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeMapModel,renderRouteMap,renderDashboardOverview} from '../public/ui/wader-v5.js';
const flight={id:'w5',date:'2026-11-06',dep:'SGN',dest:'BKK',aircraft:'A321',confirmed:true,role:'PF',picMinutes:0,nightMinutes:0,actual:{out:'2026-11-06T04:29:15.123Z',off:'2026-11-06T04:39:15.123Z',on:'2026-11-06T05:50:15.123Z',in:'2026-11-06T06:00:15.123Z'}};
test('route map deduplicates reciprocal routes, resolves supported aliases, and omits unknown coordinates',()=>{
 const source=[flight,{...flight,dep:'VVTS',dest:'VTBS'},{...flight,dep:'BKK',dest:'SGN'},{...flight,dep:'ZZZZ'}],before=structuredClone(source),r=routeMapModel(source);
 assert.equal(r.routes.length,1);assert.equal(r.omitted,1);assert(r.stations.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert.deepEqual(source,before);assert.doesNotMatch(renderRouteMap([{...flight,dep:'<script>'}]),/<script>/);
});
test('dashboard only totals confirmed actuals and never interprets PF as PIC or regulatory recency',()=>{
 const source=[flight,{...flight,confirmed:false}],before=structuredClone(source),html=renderDashboardOverview(source,{name:'<img onerror=x>',base:'SGN'},source,new Date('2026-11-06T10:00:00Z'));
 assert.match(html,/01:31/);assert.doesNotMatch(html,/03:02|<img|CURRENT UNTIL|3\/3/);assert.match(html,/&lt;img onerror=x&gt;/);assert.deepEqual(source,before);
});
test('empty and dateline route views remain valid without manufacturing a flight',()=>{
 assert.match(renderRouteMap([]),/Chưa có tuyến bay/);
 const html=renderRouteMap([{...flight,dep:'RJTT',dest:'KSFO'}]);assert.doesNotMatch(html,/NaN|Infinity|undefined/);assert.match(html,/transform="translate/);
 assert.match(renderRouteMap([{...flight,dep:'ZZZZ'}]),/1 chuyến chưa có tọa độ/);
});
