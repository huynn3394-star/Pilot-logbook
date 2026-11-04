import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderTabletFlightPreview} from '../public/ui/tablet-v2-1.js';
import {renderFlightCard} from '../public/ui/navy-v2.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const flight={
 id:'tablet-safe-01',date:'2026-11-02',flightNo:'HVN435',dep:'PUS',dest:'CXR',aircraft:'A321',reg:'VN-A625',role:'PM',confirmed:true,picMinutes:0,nightMinutes:0,
 scheduled:{},actual:{out:'2026-11-01T23:43:00Z',off:'2026-11-01T23:58:00Z',on:'2026-11-02T04:15:00Z',in:'2026-11-02T04:26:00Z'}
};
test('iPad flight preview renders source record read-only without mutation',()=>{
 const before=structuredClone(flight);
 const html=renderTabletFlightPreview(flight);
 assert.deepEqual(flight,before);
 for(const key of ['HVN435','PUS','CXR','04:43','04:17','Sửa chuyến bay'])assert.ok(html.includes(key),key);
 assert.match(html,/data-action="edit" data-id="tablet-safe-01"/);
 assert.doesNotMatch(html,/<input|<form|fetch\(|localStorage/);
});
test('iPad preview escapes unsafe source text',()=>{
 const unsafe={...flight,flightNo:'<img src=x onerror=alert(1)>'};
 const html=renderTabletFlightPreview(unsafe);
 assert.ok(html.includes('&lt;img'));
 assert.ok(!html.includes('<img'));
});
test('iPad selector is a separate accessible button; original edit remains',()=>{
 const html=renderFlightCard(flight);
 assert.match(html,/data-action="tablet-preview" data-id="tablet-safe-01"/);
 assert.match(html,/data-action="edit" data-id="tablet-safe-01"/);
 assert.ok(html.indexOf('</button><button')!==-1,'No nested button');
});
test('tablet split view only appears on tablet and uses current filtered flights',()=>{
 const css=read('public/ui/navy-v2-1-review.css');
 assert.match(css,/@media\(min-width:768px\) and \(max-width:1199px\)/);
 const app=read('public/app.js');
 assert.match(app,/renderTabletFlightPreview\(currentTabletFlight\(\)\)/);
 assert.match(app,/selectFlights\(state.flights,\{month,query,filters:navyFilters,people:state.people\}\)\.slice\(0,navyLimit\)/);
 assert.match(app,/tabletSelectedFlightId=null/);
});
