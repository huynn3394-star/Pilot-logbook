import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const url=new URL('../public/lib/flight-editor.js',import.meta.url);
async function editor(){
 assert.ok(existsSync(url),'The flight editor presentation module must be implemented');
 return import(url);
}
const flight={id:'test',date:'2026-10-22',flightNo:'VN0506',dep:'HAN',dest:'CAN',aircraft:'A321',reg:'VN-A603',scheduled:{},actual:{out:'2026-10-22T06:00:00Z',off:'2026-10-22T06:13:00Z',on:'2026-10-22T07:35:00Z',in:'2026-10-22T07:58:00Z'},role:'PM',picMinutes:0,nightMinutes:20,confirmed:true};
test('editor summary uses block, not airborne, for existing PIC/SIC and day/night fields',async()=>{
 const {flightEditorSummary}=await editor();
 assert.deepEqual(flightEditorSummary(flight.actual,0,20),{block:118,airborne:82,pic:0,sic:118,day:98,night:20});
});
test('editor summary requires dates for midnight crossings and never turns missing times into zero totals',async()=>{
 const {flightEditorSummary}=await editor();
 assert.deepEqual(flightEditorSummary({}),{block:null,airborne:null,pic:null,sic:null,day:null,night:null});
 assert.equal(flightEditorSummary({out:'2026-10-22T23:50:00Z',in:'2026-10-23T01:10:00Z'}).block,80);
 assert.equal(flightEditorSummary({out:'2026-10-22T23:50:00Z',in:'2026-10-22T01:10:00Z'}).block,null);
 assert.equal(flightEditorSummary({...flight.actual,off:'2026-10-22T09:00:00Z'}).airborne,null);
 assert.equal(flightEditorSummary(flight.actual,119,0).sic,null);
 assert.equal(flightEditorSummary(flight.actual,0,119).day,null);
});
test('editor renders one input for each existing field and three accessible tabs without changing the flight',async()=>{
 const {renderFlightEditor}=await editor(),before=structuredClone(flight),html=renderFlightEditor(flight,{original:flight});
 assert.deepEqual(flight,before);
 for(const field of ['date','flightNo','dep','dest','aircraft','reg','s_dep','s_dest','s_out','s_in','a_out','a_off','a_on','a_in','role','landingMode','takeoffBy','landingBy','picMinutes','nightMinutes','source','confidence','note','evidence','confirmed','replaceConfirmed']){
  assert.equal([...html.matchAll(new RegExp('name="'+field+'"','g'))].length,1,field);
 }
 for(const panel of ['log','airports','tools']){assert.match(html,new RegExp('role="tab"[^>]+data-flight-tab="'+panel+'"'));assert.match(html,new RegExp('role="tabpanel"[^>]+data-flight-panel="'+panel+'"'));}
 for(const role of ['captain','fo','crew'])assert.ok(html.includes(`data-crew-field="${role}"`));
 assert.equal([...html.matchAll(/data-utc-clock /g)].length,6);
 for(const field of ['runway','sid','star','ifrMinutes','fuel','passengers','distance'])assert.ok(!html.includes(`name="${field}"`),field+' must not become an unsaved/fake field');
 assert.ok(!html.includes('data-action="sync-myaves"'));
});
test('editor escapes notes, OCR warnings, identities and evidence, and never confirms a scan automatically',async()=>{
 const {renderFlightEditor}=await editor();
 const html=renderFlightEditor({...flight,id:'\"><script>bad()</script>',confirmed:false,note:'<script>alert(1)</script>'},{imported:{attachment:'javascript:bad()'},warning:'<img src=x onerror=bad()>'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.match(html,/&lt;script&gt;/);
 assert.match(html,/data-ocr-review/);assert.doesNotMatch(html,/name="confirmed" checked/);assert.doesNotMatch(html,/name="replaceConfirmed"/);
});
test('new editor module is included in the offline shell while private cache bypasses remain',async()=>{
 await editor();const sw=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.match(sw,/"\/lib\/flight-editor\.js"/);assert.match(sw,/avilog-shell-v14-fast-entry/);
});
