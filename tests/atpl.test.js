import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { createHash } from 'node:crypto';
const counts={POF:487,COM:500,INS:601,MET:900,RNAV:700,LAW:453,MB:300,MBR:300,AGK:782,PERF:399,OPS:501,HUM:503};
const digest=x=>createHash('sha256').update(x).digest('hex');
async function server(run){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));try{await run('http://127.0.0.1:'+s.address().port)}finally{s.close()}}
// Break caught: a missing/incomplete catalog silently drops one of the user's banks.
test('ATPL is reachable inside logbook and exposes every original bank plus separate MB reference',()=>server(async base=>{
 const page=await fetch(base+'/atpl/');assert.equal(page.status,200,'ATPL landing must be served');
 const res=await fetch(base+'/atpl/catalog.json');assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/application\/json/);
 const catalog=await res.json();assert.equal(catalog.sourceSHA256,'28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f');
 assert.deepEqual(Object.fromEntries(catalog.banks.map(b=>[b.code,b.count])),counts);
 assert.equal(catalog.banks.find(b=>b.code==='MBR').reference,true);
}));
// Break caught: route packaging drops a key, explanation or original scoring engine.
test('served banks retain full original question payloads and scoring engine',()=>server(async base=>{
 const response=await fetch(base+'/atpl/catalog.json');assert.equal(response.status,200);const catalog=await response.json();
 for(const b of catalog.banks){
  const res=await fetch(base+b.url);assert.equal(res.status,200,b.code);const html=await res.text();
  const raw=html.match(/<script[^>]*id="bank-data"[^>]*>(.*?)<\/script>/s)?.[1];assert.ok(raw,b.code);
  const payload=JSON.parse(raw);assert.deepEqual(Object.keys(payload),[b.code]);assert.equal(digest(raw),b.bankSHA256,b.code+' unchanged original data');
  assert.equal(payload[b.code].questions.filter(q=>q.valid).length,counts[b.code]);
  const engine=html.match(/\/\* ATPL state engine.*?<\/script>/s)?.[0];assert.equal(digest(engine),catalog.engineSHA256,b.code+' original scoring engine');
  if(b.code==='INS'){const q=payload.INS.questions.find(q=>q.uid==='INS-03-U001');assert.equal(q.answer,'F');assert.deepEqual(Object.keys(q.options),['E','F','G','H'])}
 }
}));
// Break caught: a downloadable bank omits source imagery, corrupts an asset or returns HTML as an image.
test('each offline manifest includes its bank, source assets and valid immutable bytes',()=>server(async base=>{
 const response=await fetch(base+'/atpl/catalog.json');assert.equal(response.status,200);const catalog=await response.json();
 for(const b of catalog.banks){const manifest=await(await fetch(base+b.manifest)).json();assert.equal(manifest.code,b.code);assert.ok(manifest.assets.some(a=>a.url===b.url));assert.ok(manifest.assets.some(a=>a.url.endsWith('.webp')));assert.equal(manifest.assets.reduce((n,a)=>n+a.bytes,0),b.offlineBytes);
  const first=manifest.assets.find(a=>a.url.endsWith('.webp'));const res=await fetch(base+first.url);assert.match(res.headers.get('content-type'),/image\/webp/);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(bytes.length,first.bytes);assert.equal(digest(bytes),first.sha256);
 }
}));
