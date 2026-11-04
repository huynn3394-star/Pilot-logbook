import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderFlightEditor} from '../public/lib/flight-editor.js';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('AVL brand is used in main application and study shell',()=>{
 const app=file('public/app.js'),study=file('public/ui/study-shell.js'),library=file('public/atpl/index.html');
 for(const source of [app,study,library])assert.match(source,/\/brand\/avl-logo\.svg/);
 assert.match(file('public/index.html'),/navy-v2-1-review\.css/);
 assert.match(library,/study-navy-v2-1-review\.css/);
});
test('ATPL source banks and scoring remain outside V2.1 presentation changes',()=>{
 const study=file('public/ui/study-navy-v2-1-review.css');
 assert.doesNotMatch(study,/(answerKey|questionBank|localStorage|indexedDB)/i);
 const themes=file('public/atpl/avilog-theme.css');
 assert.match(themes,/study-navy-v2-1-review\.css/);
});
test('Native continuous editor retains a single copy of each original input',()=>{
 const record={id:'ui',date:'2026-11-01',flightNo:'HVN435',dep:'PUS',dest:'CXR',
  actual:{out:'2026-11-01T23:43:00Z',off:'2026-11-01T23:58:00Z',on:'2026-11-02T04:15:00Z',in:'2026-11-02T04:26:00Z'},scheduled:{},role:'PM',picMinutes:0,nightMinutes:0};
 const before=structuredClone(record),html=renderFlightEditor(record,{original:record});
 assert.deepEqual(record,before);
 for(const name of ['flightNo','date','dep','dest','a_out','a_off','a_on','a_in','note']){
  assert.equal((html.match(new RegExp('name="'+name+'"','g'))||[]).length,1,name);
 }
 assert.match(file('public/lib/flight-editor.js'),/classList\.add\('nv21-continuous'\)/);
 assert.match(file('public/lib/flight-editor.js'),/panel\.hidden=false/);
});
test('New PWA shell caches Navy V2.1 visuals, not user data',()=>{
 const sw=file('public/sw.js');
 for(const asset of ['/brand/avl-logo.svg','/ui/navy-v2-1-review.css','/ui/study-navy-v2-1-review.css'])assert.ok(sw.includes('"'+asset+'"'),asset);
 assert.match(sw,/study-shell-r3-navy-v21-review/);
});

test('Compact white logo is applied in main and ATPL shells',()=>{
 const main=file('public/ui/navy-v2-1-review.css');
 const study=file('public/ui/study-navy-v2-1-review.css');
 for(const css of [main,study])assert.match(css,/filter:brightness\(0\) invert\(1\)/);
 assert.match(main,/\.mobile-brand \.nv21-brand-img\{width:86px/);
 assert.match(study,/\.nv21-library-logo\{width:87px/);
});
test('More groups use real Avilog destination routes and existing operations',()=>{
 const app=file('public/app.js');
 for(const heading of ['Account & Settings','Logbook Management','Tools'])assert.ok(app.includes(heading),heading);
 for(const action of ['csv','import','navy-backup'])assert.ok(app.includes("btn('"+action+"'"),action);
 const nav=file('public/ui/navigation.js');
 assert.match(nav,/\['atpl','book','Ôn thi'\]/);
 assert.match(nav,/\['weather','cloud','Thời tiết'\]/);
});
