import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const path=new URL('../lib/v14-bundle.js',import.meta.url);
async function api(){assert.ok(existsSync(path),'Source/bundle consistency guard is required');return import(path);}
const hash=s=>createHash('sha256').update(s).digest('hex');
test('V14 capability cannot start with a stale compiled workspace validator',async()=>{const {assertV14Bundle}=await api();assert.doesNotThrow(()=>assertV14Bundle('/nonexistent',{enabled:false}));assert.throws(()=>assertV14Bundle('/nonexistent',{enabled:true,logbookV14Enabled:true}),/build|bundle/i);});
test('source and built SDK hashes must match; editing source invalidates the deployment',async()=>{const {assertV14Bundle}=await api();const root=mkdtempSync(join(tmpdir(),'avilog-bundle-'));try{mkdirSync(join(root,'public/atpl/vendor'),{recursive:true});mkdirSync(join(root,'public/workspace'),{recursive:true});const body='// compiled test fixture',source='// schema test fixture';writeFileSync(join(root,'public/atpl/vendor/firebase-client.js'),body);writeFileSync(join(root,'public/workspace/schema.js'),source);const manifest={version:1,workspaceContract:14,appSourceHashes:[{path:'public/workspace/schema.js',sha256:hash(source)}],assets:[{url:'/atpl/vendor/firebase-client.js',sha256:hash(body),bytes:body.length}]};writeFileSync(join(root,'public/atpl/vendor/manifest.json'),JSON.stringify(manifest));assert.doesNotThrow(()=>assertV14Bundle(root,{enabled:true,logbookV14Enabled:true}));writeFileSync(join(root,'public/workspace/schema.js'),source+' changed');assert.throws(()=>assertV14Bundle(root,{enabled:true,logbookV14Enabled:true}),/build|bundle/i);}finally{rmSync(root,{recursive:true,force:true});}});
