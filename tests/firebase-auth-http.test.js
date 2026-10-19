import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server.js';
import {readFirebaseConfig} from '../lib/firebase-auth.js';
const project='demo-atpl-sync';
async function withServer(config,fn,fetchImpl=async()=>new Response('helper',{headers:{'Content-Type':'text/html','X-Frame-Options':'DENY'}})){
 const server=createServer({firebaseConfig:config,firebaseFetch:fetchImpl});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{server.close();}
}
const config=()=>readFirebaseConfig({ATPL_ACCOUNTS_ENABLED:'true',ATPL_APP_ORIGIN:'https://example.up.railway.app',FIREBASE_PROJECT_ID:project,FIREBASE_API_KEY:'public-test-key',FIREBASE_APP_ID:'1:123:web:abc'});
test('runtime config defaults disabled, rejects malformed origin/project and cannot expose arbitrary secrets',async()=>{
 assert.deepEqual(readFirebaseConfig({}),{enabled:false});
 for(const env of [{ATPL_APP_ORIGIN:'https://example.com/path'}, {FIREBASE_PROJECT_ID:'evil.test/path'},{ATPL_APP_ORIGIN:'http://public.example.com'}])assert.throws(()=>readFirebaseConfig({ATPL_ACCOUNTS_ENABLED:'true',ATPL_APP_ORIGIN:'https://example.up.railway.app',FIREBASE_PROJECT_ID:project,FIREBASE_API_KEY:'x',FIREBASE_APP_ID:'x',...env}));
 await withServer({enabled:false},async base=>{const r=await fetch(base+'/atpl/firebase-config.json');assert.equal(r.status,200);assert.deepEqual(await r.json(),{enabled:false});assert.equal((await fetch(base+'/__/auth/handler')).status,503);assert.equal((await fetch(base+'/')).headers.get('x-frame-options'),'DENY');});
});
test('auth GET/POST proxy is fixed, no-store and same-origin framed while ordinary routes stay DENY',async()=>{
 const calls=[];await withServer(config(),async base=>{
  const r=await fetch(base+'/__/auth/iframe?target=https%3A%2F%2Fevil.example');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'self'/);assert.equal(await r.text(),'helper');
  const post=await fetch(base+'/__/auth/handler',{method:'POST',body:'callback-data',headers:{'Content-Type':'application/x-www-form-urlencoded'}});assert.equal(post.status,200);assert.equal(calls[1].body.toString(),'callback-data');
  assert.equal((await fetch(base+'/__/auth/handler',{method:'DELETE'})).status,405);
  assert.equal(calls[0].url.startsWith('https://demo-atpl-sync.firebaseapp.com/__/auth/iframe?'),true);assert.equal(calls[0].redirect,'manual');
  const publicConfig=await (await fetch(base+'/atpl/firebase-config.json')).json();assert.equal(publicConfig.authDomain,'example.up.railway.app');assert.equal((await fetch(base+'/')).headers.get('x-frame-options'),'DENY');
 },async(url,options)=>{calls.push({url,...options});return new Response('helper',{headers:{'Content-Type':'text/html','X-Frame-Options':'DENY'}});});
});
test('oversized callback bodies/upstream responses, bad redirects and timeout are bounded',async()=>{
 await withServer(config(),async base=>assert.equal((await fetch(base+'/__/auth/handler',{method:'POST',body:'x'.repeat(1024*1024+1)})).status,413));
 await withServer(config(),async base=>assert.equal((await fetch(base+'/__/auth/iframe')).status,502),async()=>new Response('x'.repeat(5*1024*1024+1)));
 await withServer(config(),async base=>{const r=await fetch(base+'/__/auth/handler',{redirect:'manual'});assert.equal(r.status,502);},async()=>new Response(null,{status:302,headers:{Location:'http://evil.example'}}));
 await withServer(config(),async base=>assert.equal((await fetch(base+'/__/auth/handler')).status,502),async()=>{throw new DOMException('timeout','TimeoutError');});
});
