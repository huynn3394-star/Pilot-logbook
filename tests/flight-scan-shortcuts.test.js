import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderFlightEditor} from '../public/lib/flight-editor.js';
let shortcuts={};
try { shortcuts=await import('../public/ui/flight-scan-shortcuts.js'); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const flight={id:'record-a',flightNo:'VN9911',date:'2026-10-26',dep:'HAN',dest:'CAN',aircraft:'A321',actual:{},scheduled:{},confirmed:false};

test('saved flights receive a labelled target-bound shortcut for each supported placement',()=>{
 assert.equal(typeof shortcuts.renderFlightScanShortcut,'function');
 for(const placement of ['schedule','list']){
  const html=shortcuts.renderFlightScanShortcut(flight.id,flight.flightNo,placement);
  assert.match(html,/type="button"/);assert.match(html,/data-action="image"/);
  assert(html.includes('data-id="record-a"'));assert(html.includes('data-flight-scan-shortcut="'+placement+'"'));
  assert(html.includes('<span>Scan Flight Log</span>'));assert(html.includes('aria-label="Scan Flight Log · VN9911"'));
 }
});
test('shortcut text and identifiers are escaped and missing identities are never unbound scans',()=>{
 assert.equal(typeof shortcuts.renderFlightScanShortcut,'function');
 const html=shortcuts.renderFlightScanShortcut('x" onclick="bad','<img src=x>','list');
 assert(html.includes('data-id="x&quot; onclick=&quot;bad"'));
 assert(!html.includes('<img src=x>'));assert(!html.includes(' onclick="bad"'));
 for(const id of ['',null,undefined])assert.equal(shortcuts.renderFlightScanShortcut(id,'VN9911','list'),'');
 assert.throws(()=>shortcuts.renderFlightScanShortcut('id','VN9911','unknown'),/placement/i);
});
test('shortcut adapter and styling are loaded and included in the versioned offline shell',()=>{
 const html=readFileSync('public/index.html','utf8'),sw=readFileSync('public/sw.js','utf8');
 for(const asset of ['/ui/flight-scan-shortcuts.js','/ui/flight-scan-shortcuts.css']){
  assert(html.includes(asset),asset+' must be loaded');assert(sw.includes('"'+asset+'"'),asset+' must be cached');
 }
 assert(sw.includes('scan-shortcuts'));
});
test('existing detail scanner, FINAL replacement permission and reason remain available',()=>{
 const original={...flight,confirmed:true};const html=renderFlightEditor(original,{original});
 assert.match(html,/data-flight-log-scan/);assert.match(html,/name="replaceConfirmed"/);assert.match(html,/name="revisionReason"/);
});
