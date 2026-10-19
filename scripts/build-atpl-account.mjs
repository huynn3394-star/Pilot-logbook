import {build} from 'esbuild';import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';import {createHash} from 'node:crypto';
const dir='public/atpl/vendor';await mkdir(dir,{recursive:true});
await build({entryPoints:['public/atpl/firebase-client.js'],outfile:`${dir}/firebase-client.js`,bundle:true,format:'esm',platform:'browser',target:['safari16.4','chrome115'],minify:true,legalComments:'external',charset:'utf8',metafile:false,logLevel:'warning'});
const assets=[];for(const name of (await readdir(dir)).sort()){if(name==='manifest.json')continue;const data=await readFile(`${dir}/${name}`);assets.push({url:`/atpl/vendor/${name}`,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
await writeFile(`${dir}/manifest.json`,JSON.stringify({version:1,sdk:'firebase@13.0.0',assets}));console.log('Bundled Firebase locally:',assets.map(a=>`${a.url} ${a.bytes} bytes`).join(', '));
