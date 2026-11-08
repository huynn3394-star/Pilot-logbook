import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import * as buildCache from '../scripts/stamp-bundle.mjs';
function version(source){let message;vm.runInNewContext(source,{self:{addEventListener:(type,fn)=>{if(type==='message')message=fn;},location:{origin:'https://qa.example'}},URL});let value;message({data:{type:'avilog-shell-version'},ports:[{postMessage:r=>value=r.version}]});return value;}
test('each rebuilt SDK receives a separate shell cache and preserves the asset graph',async()=>{
 assert.equal(typeof buildCache.stampBundle,'function');const source=await readFile('public/sw.js','utf8');
 const first=buildCache.stampBundle(source,'a'.repeat(64)),second=buildCache.stampBundle(first,'b'.repeat(64));
 assert.equal(version(first),'avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention-sf-ui-flight-scan-weather-view-scan-shortcuts-report-rows-aligned-private-admin-navy-v2-reference-layout-native-fonts-study-shell-r4-navy-v3-compact-counters-20261105-weather-cache-20261106-wader-v5-20261106-study-20261107-auto-night-20261107-flight-entry-20261108-sdk-aaaaaaaaaaaa');
 assert.equal(version(second),'avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention-sf-ui-flight-scan-weather-view-scan-shortcuts-report-rows-aligned-private-admin-navy-v2-reference-layout-native-fonts-study-shell-r4-navy-v3-compact-counters-20261105-weather-cache-20261106-wader-v5-20261106-study-20261107-auto-night-20261107-flight-entry-20261108-sdk-bbbbbbbbbbbb');
 assert.notEqual(version(source),version(first));assert.match(second,/"\/workspace\/flight-conflict.js"/);
});
test('stamping fails on an invalid digest or a worker without the expected build marker',()=>{
 assert.equal(typeof buildCache.stampBundle,'function');assert.throws(()=>buildCache.stampBundle('worker without marker','a'.repeat(64)));assert.throws(()=>buildCache.stampBundle('const BUNDLE_BUILD = "source-unbuilt";','invalid'));
});
