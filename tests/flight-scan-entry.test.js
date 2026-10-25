import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderFlightEditor} from '../public/lib/flight-editor.js';
import {prepareScanDraft} from '../public/lib/flight-assist.js';
const flight={id:'saved-flight-1',flightNo:'VN9911',date:'2026-10-25',dep:'HAN',dest:'CAN',aircraft:'A321',reg:'VN-A603',scheduled:{out:'2026-10-25T06:00:00.000Z',in:'2026-10-25T08:00:00.000Z'},actual:{},role:'PM',picMinutes:0,nightMinutes:0,note:'keep remark'};
test('saved flight has one targeted scan button in Log next to Actual times',()=>{
 const html=renderFlightEditor(flight,{original:flight});
 const log=html.slice(html.indexOf('id="fe-panel-log"'),html.indexOf('id="fe-panel-airports"'));
 assert.equal((log.match(/data-flight-log-scan/g)||[]).length,1);
 assert.match(log,/<button[^>]*type="button"[^>]*data-action="image"[^>]*data-id="saved-flight-1"[^>]*data-flight-log-scan/);
 assert(log.includes('Nhập ảnh Flight Log'));
 assert(log.indexOf('data-flight-log-scan')<log.indexOf('Actual times'));
});
test('unpersisted flight explains saving first instead of starting a new unbound scan',()=>{
 const html=renderFlightEditor(flight);
 assert.doesNotMatch(html,/data-flight-log-scan/);
 assert.match(html,/Lưu chuyến bay trước khi nhập ảnh Flight Log/);
});
test('per-flight action escapes record identifiers and preserves FINAL confirmation controls',()=>{
 const old={...flight,id:'x" onclick="unsafe',confirmed:true};
 const html=renderFlightEditor(old,{original:old});
 assert.match(html,/data-id="x&quot; onclick=&quot;unsafe"[^>]*data-flight-log-scan/);
 assert.match(html,/name="replaceConfirmed"/);
 assert.match(html,/name="revisionReason"/);
 assert(!html.includes('dùng Nhập từ ảnh trong Logbook'));
});
test('targeted review cannot switch flight/date and retains schedule, crew and registration',()=>{
 const original={...flight,captainId:'captain',foId:'fo',crewIds:['crew']};
 const scan={flightNo:'HVN09911',date:flight.date,dep:'HAN',dest:'CAN',actual:{out:'2026-10-25T06:10:00.000Z',off:'2026-10-25T06:20:00.000Z',on:'2026-10-25T07:20:00.000Z',in:'2026-10-25T07:30:00.000Z'}};
 const result=prepareScanDraft(original,scan);
 assert.equal(result.id,original.id);assert.equal(result.flightNo,original.flightNo);
 assert.equal(result.confirmed,false);assert.deepEqual(result.scheduled,original.scheduled);
 for(const key of ['reg','aircraft','role','captainId','foId','note'])assert.equal(result[key],original[key]);
 assert.deepEqual(result.crewIds,original.crewIds);
 assert.throws(()=>prepareScanDraft(original,{...scan,flightNo:'VN9912'}),/không khớp/);
 assert.throws(()=>prepareScanDraft(original,{...scan,date:'2026-10-26'}),/không khớp/);
});
