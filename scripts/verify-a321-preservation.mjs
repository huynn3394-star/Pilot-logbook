// Verify the narrow source change and its generated integrity manifest.
// The account SDK bytes, schemas and every other protected file stay unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const base='929152a101405f8d2093faacb068b8a6d98a9f38';
const manifestPath='public/atpl/vendor/manifest.json';
const protectedPaths=['public/app.js','public/lib/importers.js','public/lib/parsers.js','public/lib/domain.js','public/lib/flight-assist.js','public/lib/flight-editor.js','public/workspace','public/account','public/atpl','public/ui','public/style.css','public/navy-teal.css','data','lib','server.js','firestore.rules','storage.rules','package.json','package-lock.json'];
execFileSync('git',['diff','--exit-code',base,'--',...protectedPaths,':(exclude)'+manifestPath],{stdio:'inherit'});
const original=JSON.parse(execFileSync('git',['show',base+':'+manifestPath],{encoding:'utf8'}));
const expected=structuredClone(original),entries=expected.appSourceHashes.filter(e=>e.path==='public/lib/a320-scan.js');
assert.equal(entries.length,1,'The manifest must contain exactly one scanner hash');
const digest=createHash('sha256').update(readFileSync('public/lib/a320-scan.js')).digest('hex');
assert.notEqual(digest,entries[0].sha256,'This release must actually contain the updated scanner');
entries[0].sha256=digest;
const built=JSON.parse(readFileSync(manifestPath,'utf8'));
const committed=JSON.parse(execFileSync('git',['show','HEAD:'+manifestPath],{encoding:'utf8'}));
assert.deepEqual(built,expected,'Only the scanner source hash may differ from the original manifest');
assert.deepEqual(committed,built,'Committed metadata must match the fresh build');
for(const asset of built.assets){const bytes=readFileSync('public'+asset.url);assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
console.log(JSON.stringify({protectedFiles:'unchanged',allowedManifestChange:'public/lib/a320-scan.js',scannerSHA256:digest,sdkAssets:'unchanged and verified'}));
