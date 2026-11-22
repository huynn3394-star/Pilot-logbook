import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {companionDestination} from '../public/ui/companion-navigation.js';
import {createServer} from '../server.js';
const origin='https://avilog.example';
test('companion destinations accept only known app tabs and public study pages',()=>{
 for(const tab of ['schedule','logbook','weather','crew','statistics','settings'])assert.deepEqual(companionDestination('/?tab='+tab,origin),{area:'app',path:'/?tab='+tab});
 assert.deepEqual(companionDestination('/?compose=flight&tab=logbook',origin),{area:'app',path:'/?tab=logbook&compose=flight'});
 assert.deepEqual(companionDestination('/atpl/index.html',origin),{area:'study',path:'/atpl/'});
 assert.deepEqual(companionDestination('/atpl/banks/POF-test.html',origin),{area:'study',path:'/atpl/banks/POF-test.html'});
});
test('untrusted messages cannot name external origins, private routes or executable schemes',()=>{
 for(const path of ['https://other.test/atpl/','//other.test/','javascript:alert(1)','data:text/html,hello','/admin/','/api/weather?station=VVPC','/__/auth/handler','/?tab=unknown','/?tab=weather&token=secret','/?compose=anything','/atpl/?anything=1','/atpl/banks/../../admin/index.html','/atpl/media/source.webp','/atpl/banks/test.html#x'])assert.equal(companionDestination(path,origin),null,path);
});
test('only same-origin app documents are frameable; API/admin and external ancestors stay blocked',async()=>{
 const server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  for(const path of ['/','/?tab=logbook','/atpl/','/atpl/index.html']){
   const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert.equal(r.headers.get('content-security-policy'),"frame-ancestors 'self'");
  }
  for(const path of ['/api/health','/atpl/firebase-config.json','/admin/'])assert.equal((await fetch(base+path)).headers.get('x-frame-options'),'DENY');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('both companion adapters and styles ship in the installed offline module graph',async()=>{
 const sw=await readFile('public/sw.js','utf8');for(const path of ['/ui/companion-navigation.js','/ui/companion-navigation.css'])assert(sw.includes('"'+path+'"'));
});
