import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {gunzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {createServer} from '../server.js';
import {createStaticResponder} from '../lib/static-response.js';

const request=(base,path,headers={},method='GET')=>new Promise((resolve,reject)=>{
 const req=http.request(base+path,{method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});
 req.on('error',reject);req.end();
});
test('compressed bank delivery preserves original bytes and cached GET/HEAD semantics',async()=>{
 const server=createServer({firebaseConfig:{enabled:false}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base='http://127.0.0.1:'+server.address().port,bank=JSON.parse(await readFile('public/atpl/catalog.json')).banks.find(b=>b.code==='MET'),source=await readFile('public'+bank.url);
  const zipped=await request(base,bank.url,{'Accept-Encoding':'gzip, br'});
  assert.equal(zipped.status,200);assert.equal(zipped.headers['content-encoding'],'gzip');assert.equal(zipped.headers.vary,'Accept-Encoding');
  assert.match(zipped.headers['cache-control'],/max-age=31536000, immutable/);assert.equal(zipped.headers['x-frame-options'],'SAMEORIGIN');
  assert(zipped.body.length<source.length/4,'large question banks must not send their full multi-MB payload');assert.deepEqual(gunzipSync(zipped.body),source);
  const identity=await request(base,bank.url,{'Accept-Encoding':'gzip;q=0, *;q=1'});
  assert.equal(identity.headers['content-encoding'],undefined);assert.deepEqual(identity.body,source);assert.equal(identity.headers.etag,zipped.headers.etag);
  const head=await request(base,bank.url,{'Accept-Encoding':'gzip'},'HEAD');
  assert.equal(head.body.length,0);assert.equal(head.headers['content-length'],String(zipped.body.length));assert.equal(head.headers['content-encoding'],'gzip');
  const unchanged=await request(base,bank.url,{'If-None-Match':'"other", '+zipped.headers.etag,'Accept-Encoding':'gzip'});
  assert.equal(unchanged.status,304);assert.equal(unchanged.body.length,0);assert.equal(unchanged.headers.etag,zipped.headers.etag);assert.equal(unchanged.headers.vary,'Accept-Encoding');
  const shell=await request(base,'/atpl/catalog-ui.js',{'Accept-Encoding':'gzip'});
  assert.match(shell.headers['cache-control'],/must-revalidate/);assert.doesNotMatch(shell.headers['cache-control'],/immutable/);
  const worker=await request(base,'/sw.js');assert.equal(worker.headers['cache-control'],'no-cache');
  for(const path of ['/admin/','/api/health','/atpl/firebase-config.json']){
   const r=await request(base,path,{'Accept-Encoding':'gzip','If-None-Match':'*'});
   assert.equal(r.status,200);assert.match(r.headers['cache-control'],/no-store/);assert.equal(r.headers.etag,undefined);assert.equal(r.headers['x-frame-options'],'DENY');
  }
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('a changed public file cannot return a stale compressed representation or a false 304',async()=>{
 const respond=createStaticResponder({maxBytes:1024}),req={method:'GET',headers:{'accept-encoding':'gzip'}};
 const first=await respond(req,Buffer.from('first'.repeat(2000)),{compress:true});
 const second=await respond({...req,headers:{...req.headers,'if-none-match':first.headers.ETag}},Buffer.from('second'.repeat(2000)),{compress:true});
 assert.equal(second.status,200);assert.notEqual(second.headers.ETag,first.headers.ETag);assert.equal(gunzipSync(second.body).toString(),'second'.repeat(2000));
 for(const encoding of ['gzip;q=0','identity','br','gzip;q=invalid']){
  const plain=await respond({method:'GET',headers:{'accept-encoding':encoding}},Buffer.from('plain'.repeat(1000)),{compress:true});
  assert.equal(plain.headers['Content-Encoding'],undefined);assert.equal(plain.body.toString(),'plain'.repeat(1000));
 }
});
