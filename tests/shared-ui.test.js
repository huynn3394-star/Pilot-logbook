import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('all application entrypoints consume the same shared presentation system',async()=>{
 for(const file of ['public/index.html','public/atpl/index.html','public/atpl/avilog-theme.css']){
  assert.match(await readFile(file,'utf8'),/\/ui\/system\.css/,file+' must consume the shared UI, including quiz banks through the external theme');
 }
});
test('shared styles and tokens are precached for offline entrypoints',async()=>{
 const sw=await readFile('public/sw.js','utf8');
 for(const url of ['/ui/system.css','/ui/tokens.css'])assert.ok(sw.includes('"'+url+'"'),url+' must be available offline');
 assert.match(sw,/navy-teal-unified/,'a distinct presentation revision must not overwrite the previous installed shell');
});
