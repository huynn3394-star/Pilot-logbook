import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {minutes,duration,clock} from '../public/lib/domain.js';
import {renderFlightEditor} from '../public/lib/flight-editor.js';
const source=readFileSync('public/app.js','utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const flights=[{id:'record-a',flightNo:'VN9911',date:'2026-10-26',dep:'HAN',dest:'CAN',aircraft:'A321',actual:{},scheduled:{out:'2026-10-26T06:00:00Z',in:'2026-10-26T08:00:00Z'},confirmed:false},{id:'record-b',flightNo:'VN9912',date:'2026-10-26',dep:'CAN',dest:'HAN',aircraft:'A321',scheduled:{},actual:{out:'2026-10-26T10:00:00Z',off:'2026-10-26T10:10:00Z',on:'2026-10-26T11:20:00Z',in:'2026-10-26T11:30:00Z'},confirmed:true}];
function render(name,records=flights,filter='all'){
 const end=name==='dayPanel'?'function flightTable(':'function logbook(';
 const text=source.slice(source.indexOf('function '+name+'('),source.indexOf(end));
 assert(text.startsWith('function '+name));
 const context={state:{flights:records,duties:[]},day:'2026-10-26',query:'',logFilter:filter,minutes,duration,clock,e:escape,shortDate:x=>x,fullDate:x=>x,statusPill:f=>f.confirmed?'FINAL':'DRAFT',icon:()=>'<svg aria-hidden="true"></svg>',btn:()=>'',records};
 return vm.runInNewContext(text+'\n'+name+'(records)',context);
}
test('Schedule gives every saved flight a visible labelled target-bound scan shortcut',()=>{
 const html=render('dayPanel');
 assert.equal((html.match(/data-flight-scan-shortcut="schedule"/g)||[]).length,2);
 for(const flight of flights)assert(html.includes('data-id="'+flight.id+'" data-flight-scan-shortcut="schedule"'));
 assert.equal((html.match(/Scan Flight Log/g)||[]).length,4,'Each button has an accessible name and visible label');
 assert.equal((html.match(/data-action="weather"/g)||[]).length,2);
});
test('Logbook keeps scan visible in the first flight column instead of off-screen actions',()=>{
 const html=render('flightTable');
 const rows=[...html.matchAll(/<tr><td>(.*?)<\/td>/g)].map(m=>m[1]);
 assert.equal(rows.length,2);
 for(let index=0;index<rows.length;index++){
  assert(rows[index].includes('data-id="'+flights[index].id+'" data-flight-scan-shortcut="list"'));
  assert(rows[index].includes('Scan Flight Log'));
  assert(rows[index].includes('type="button"'));
 }
 assert.equal((html.match(/data-action="edit"/g)||[]).length,2);
});
test('Shortcuts respect filters, empty states and escaped record identifiers',()=>{
 assert.equal((render('flightTable',flights,'confirmed').match(/data-flight-scan-shortcut=/g)||[]).length,1);
 for(const name of ['dayPanel','flightTable'])assert(!render(name,[]).includes('data-flight-scan-shortcut'));
 const hostile={...flights[0],id:'x" onclick="bad',flightNo:'<img src=x>'};
 const html=render('flightTable',[hostile]);
 assert(html.includes('data-id="x&quot; onclick=&quot;bad" data-flight-scan-shortcut="list"'));
 assert(!html.includes('<img src=x>'));
});
test('Existing detail-page scanner and FINAL review remain available',()=>{
 const html=renderFlightEditor(flights[1],{original:flights[1]});
 assert.match(html,/data-flight-log-scan/);assert.match(html,/name="replaceConfirmed"/);assert.match(html,/name="revisionReason"/);
});
