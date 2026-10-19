import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile('public/sw.js','utf8');
function worker(){const handlers={},shell=[],puts=[],deleted=[];const cache={addAll:async urls=>{shell.push(...urls);if(urls.some(u=>u.includes('firebase-config')))throw new Error('provider config offline');},put:async(...args)=>puts.push(args),match:async()=>undefined};const context={self:{location:{origin:'https://avilog.example'},addEventListener:(k,fn)=>handlers[k]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}},clients:{},caches:{open:async()=>cache,keys:async()=>['avilog-shell-obsolete','avilog-atpl-v1','unrelated-app-cache'],delete:async key=>deleted.push(key),match:async()=>undefined},fetch:async()=>new Response('unavailable',{status:503}),URL,Response,Request,Promise,AbortSignal,console};vm.runInNewContext(source,context);return {handlers,shell,puts,deleted};}
test('OAuth helper requests always bypass the worker and private callbacks cannot enter its caches',()=>{
 const w=worker();for(const route of ['/__/auth/handler?code=sensitive','/__/auth/iframe','/api/health']){let intercepted=false;w.handlers.fetch({request:new Request('https://avilog.example'+route),respondWith:()=>{intercepted=true;},waitUntil(){}});assert.equal(intercepted,false,route);}
});
test('all local account modules precache without needing a reachable provider config',async()=>{
 const w=worker();let installation;w.handlers.install({waitUntil:p=>installation=p});await installation;
 for(const url of ['/atpl/account-bootstrap.js','/atpl/account.js','/atpl/account-ui.js','/atpl/sync/model.js','/atpl/sync/common.js','/atpl/sync/store.js','/atpl/sync/import.js','/atpl/sync/controller.js','/atpl/vendor/firebase-client.js','/atpl/identities.json','/atpl/privacy.html'])assert.ok(w.shell.includes(url),url);
 assert.ok(!w.shell.includes('/atpl/firebase-config.json'));let activation;w.handlers.activate({waitUntil:p=>activation=p});await activation;assert.deepEqual(w.deleted,['avilog-shell-obsolete']);
});
