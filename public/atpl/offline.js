export const ATPL_CACHE = 'avilog-atpl-v1';
let catalogPromise;
export function getCatalog(){return catalogPromise ||= fetch('/atpl/catalog.json').then(r=>{if(!r.ok)throw Error('Chưa mở được danh sách môn. Kết nối mạng để tải lần đầu.');return r.json()}).catch(e=>{catalogPromise=null;throw e})}
export async function enableOffline(){
 if(!('serviceWorker' in navigator)||!globalThis.caches||!globalThis.crypto?.subtle)throw Error('Trình duyệt chưa hỗ trợ lưu offline. Hãy mở bằng Safari trên iPad qua địa chỉ HTTPS của app.');
 const existing=await navigator.serviceWorker.getRegistration('/');
 if(existing?.active&&navigator.serviceWorker.controller){if(navigator.onLine)existing.update().catch(()=>{});return}
 await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
 let timeout;try{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Chưa bật được chế độ offline. Thử tải lại trang khi có mạng.')),20000)})])}finally{clearTimeout(timeout)}
}
export async function hash(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export function validateManifest(manifest,bank,origin=location.origin){
 if(manifest.code!==bank.code||!Array.isArray(manifest.assets)||!manifest.assets.length)throw Error('Bộ tải offline không khớp môn đã chọn.');
 const urls=new Set();
 for(const a of manifest.assets){const u=new URL(a.url,origin);if(u.origin!==origin||!/^\/atpl\/(banks|media)\/[A-Za-z0-9._-]+$/.test(u.pathname)||u.search||u.hash||u.pathname!==a.url||urls.has(a.url)||!Number.isSafeInteger(a.bytes)||a.bytes<1||!/^[0-9a-f]{64}$/.test(a.sha256))throw Error('Danh sách tài nguyên offline không hợp lệ.');urls.add(a.url)}
 if(!urls.has(bank.url)||manifest.assets.length!==bank.assetCount||manifest.assets.reduce((s,a)=>s+a.bytes,0)!==bank.offlineBytes)throw Error('Danh sách tài nguyên offline chưa đầy đủ.');
 return manifest;
}
export async function bankStatus(bank){
 if(!globalThis.caches)return {ready:false,cached:0};
 const cache=await caches.open(ATPL_CACHE),marker=await cache.match(bank.manifest);
 if(!marker)return {ready:false,cached:0};
 try{const bytes=await marker.arrayBuffer();if(await hash(bytes)!==bank.manifestSHA256)return {ready:false,cached:0};const manifest=validateManifest(JSON.parse(new TextDecoder().decode(bytes)),bank);const present=await Promise.all(manifest.assets.map(a=>cache.match(a.url).then(r=>Boolean(r?.ok&&r.headers.get('X-ATPL-Verified-SHA256')===a.sha256))));return {ready:present.every(Boolean),cached:present.filter(Boolean).length}}catch{return {ready:false,cached:0}}
}
function cancelled(signal){if(signal?.aborted)throw new DOMException('Đã dừng tải.','AbortError')}
async function storeVerified(cache,url,response,asset){const headers=new Headers(response.headers);headers.set('X-ATPL-Verified-SHA256',asset.sha256);await cache.put(url,new Response(await response.arrayBuffer(),{status:response.status,statusText:response.statusText,headers}))}
async function validResponse(response,asset){if(!response?.ok)return false;const b=await response.arrayBuffer();return b.byteLength===asset.bytes&&await hash(b)===asset.sha256}
export async function downloadBank(bank,{onProgress=()=>{},signal}={}){
 await enableOffline();cancelled(signal);
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
 try{
  const response=await fetch(bank.manifest,{cache:'reload',signal:controller.signal});if(!response.ok)throw Error('Chưa lấy được bộ tải. Kiểm tra mạng rồi thử lại.');
  const raw=await response.arrayBuffer();if(await hash(raw)!==bank.manifestSHA256)throw Error('Bộ tải đã thay đổi. Mở lại danh sách môn để lấy phiên bản mới.');
  const manifest=validateManifest(JSON.parse(new TextDecoder().decode(raw)),bank),cache=await caches.open(ATPL_CACHE);let index=0,completed=0,bytes=0;
  try{await navigator.storage?.persist?.()}catch{}
  const report=()=>onProgress({completed,total:manifest.assets.length,bytes,totalBytes:bank.offlineBytes});report();
  const worker=async()=>{while(index<manifest.assets.length){cancelled(signal);cancelled(controller.signal);const a=manifest.assets[index++];let stored=await cache.match(a.url);
   if(!(stored&&await validResponse(stored.clone(),a))){if(stored)await cache.delete(a.url);const r=await fetch(a.url,{cache:'reload',signal:controller.signal});if(!await validResponse(r.clone(),a))throw Error('Tài nguyên bị thiếu hoặc không khớp: '+a.url.split('/').pop()+'. Chưa đánh dấu tải xong.');await storeVerified(cache,a.url,r,a)}else if(stored.headers.get('X-ATPL-Verified-SHA256')!==a.sha256){await storeVerified(cache,a.url,stored,a)}
   completed++;bytes+=a.bytes;report();
  }};
  const workers=Array.from({length:Math.min(3,manifest.assets.length)},worker);
  try{await Promise.all(workers)}catch(e){controller.abort();await Promise.allSettled(workers);throw e}
  cancelled(signal);await cache.put(bank.manifest,new Response(raw,{headers:{'Content-Type':'application/json'}}));
  return {ready:true,completed,bytes};
 }finally{signal?.removeEventListener('abort',abort)}
}
export function downloadError(e){if(e.name==='AbortError')return 'Đã dừng. Phần đã lưu được giữ lại; bấm tải lại để tiếp tục.';if(e.name==='QuotaExceededError')return 'Bộ nhớ trình duyệt không đủ. Chưa tải xong môn này; giải phóng dung lượng rồi thử lại. Tiến độ học vẫn giữ nguyên.';return e.message||'Tải bị gián đoạn. Chưa sẵn sàng offline; kết nối lại và tiếp tục tải.'}
export const size=bytes=>(bytes/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+' MB';
