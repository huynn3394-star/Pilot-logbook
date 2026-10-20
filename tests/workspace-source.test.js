import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const BASE='9f8e20b91a047477e04e9be080aed8f3136a08ab';
test('all source questions keys options UIDs explanations and scoring bytes retain fixed published baseline',()=>{
 const before=JSON.parse(execFileSync('git',['show',BASE+':public/atpl/catalog.json'],{maxBuffer:10*1024*1024}));
 const now=JSON.parse(readFileSync('public/atpl/catalog.json'));assert.equal(now.sourceSHA256,'28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f');assert.equal(now.engineSHA256,'d2500d598ca2c997459d1c2f10b6ce72e78eee7a2ea5b93e137dc1d540625872');
 let count=0;
 for(const bank of before.banks){const current=now.banks.find(b=>b.code===bank.code);assert.ok(current);const html=readFileSync('public'+current.url,'utf8'),raw=html.match(/<script[^>]*id="bank-data"[^>]*>(.*?)<\/script>/s)[1],engine=html.match(/\/\* ATPL state engine.*?<\/script>/s)[0];
  assert.equal(createHash('sha256').update(raw).digest('hex'),bank.bankSHA256);assert.equal(createHash('sha256').update(engine).digest('hex'),before.engineSHA256);const qs=JSON.parse(raw)[bank.code].questions.filter(q=>q.valid);assert.equal(qs.length,bank.count);count+=qs.length;
  if(bank.code==='INS'){const q=qs.find(q=>q.uid==='INS-03-U001');assert.equal(q.answer,'F');assert.deepEqual(Object.keys(q.options),['E','F','G','H']);}
 }assert.equal(count,6426);assert.equal(now.banks.find(b=>b.code==='MB').reference,false);assert.equal(now.banks.find(b=>b.code==='MBR').reference,true);
});
