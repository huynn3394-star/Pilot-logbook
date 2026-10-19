import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data/atpl-media');
let index;
const packs=new Map();
// Keep a small working set; the whole image library is never loaded into RAM.
export async function readATPLImage(filename){
 if(!/^[0-9a-f]{64}\.(webp|png|jpg)$/.test(filename))return null;
 const mapping=await(index ||= readFile(path.join(directory,'index.json'),'utf8').then(JSON.parse));
 const pack=mapping[filename];if(!pack||!/^pack-\d{3}\.json$/.test(pack))return null;
 let promise=packs.get(pack);
 if(promise){packs.delete(pack);packs.set(pack,promise)}else{
  promise=readFile(path.join(directory,pack),'utf8').then(JSON.parse);packs.set(pack,promise);
  if(packs.size>4)packs.delete(packs.keys().next().value);
  promise.catch(()=>{if(packs.get(pack)===promise)packs.delete(pack)});
 }
 const values=await promise;return typeof values[filename]==='string'?Buffer.from(values[filename],'base64'):null;
}
