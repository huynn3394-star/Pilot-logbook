/** Fail closed when the V14 flag is enabled with an old bundled workspace schema. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertV14Bundle(root,config){
 if(!config?.enabled||!config.logbookV14Enabled)return;
 try{
  const manifest=JSON.parse(readFileSync(join(root,'public/atpl/vendor/manifest.json'),'utf8'));
  if(manifest.workspaceContract!==14||!Array.isArray(manifest.appSourceHashes)||!manifest.appSourceHashes.some(s=>s.path==='public/workspace/schema.js'))throw Error('old contract');
  for(const source of manifest.appSourceHashes){
   if(!/^public\/[A-Za-z0-9_./-]+\.js$/.test(source.path)||source.path.split('/').includes('..')||digest(readFileSync(join(root,source.path)))!==source.sha256)throw Error('source changed');
  }
  const asset=manifest.assets?.find(a=>a.url==='/atpl/vendor/firebase-client.js');
  const bytes=readFileSync(join(root,'public/atpl/vendor/firebase-client.js'));
  if(!asset||bytes.length!==asset.bytes||digest(bytes)!==asset.sha256)throw Error('bundle changed');
 }catch{throw Error('V14 Firebase bundle chưa được build hoặc không khớp mã nguồn. Chạy npm ci --ignore-scripts rồi npm run build:atpl-account; Dockerfile V14 tự thực hiện bước build.');}
}
