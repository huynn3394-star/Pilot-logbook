import {stampBundle} from './stamp-bundle.mjs';
import {build} from 'esbuild';import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';import {createHash} from 'node:crypto';
const dir='public/atpl/vendor';await mkdir(dir,{recursive:true});
const result=await build({entryPoints:['public/atpl/firebase-client.js'],outfile:`${dir}/firebase-client.js`,bundle:true,format:'esm',platform:'browser',target:['safari16.4','chrome115'],minify:true,legalComments:'external',charset:'utf8',metafile:true,logLevel:'warning'});
const assets=[];for(const name of (await readdir(dir)).sort()){if(name==='manifest.json')continue;const data=await readFile(`${dir}/${name}`);assets.push({url:`/atpl/vendor/${name}`,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
const appSourceHashes=[];for(const path of Object.keys(result.metafile.inputs).filter(p=>p.startsWith('public/')).sort()){appSourceHashes.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});}
await writeFile(`${dir}/manifest.json`,JSON.stringify({version:1,workspaceContract:14,appSourceHashes,sdk:'firebase@13.0.0',assets}));console.log('Bundled Firebase locally:',assets.map(a=>`${a.url} ${a.bytes} bytes`).join(', '));

const sdkAsset=assets.find(a=>a.url==='/atpl/vendor/firebase-client.js');
await writeFile('public/sw.js',stampBundle(await readFile('public/sw.js','utf8'),sdkAsset.sha256));
console.log('Stamped service worker for Firebase bundle',sdkAsset.sha256.slice(0,12));
