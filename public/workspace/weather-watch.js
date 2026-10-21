import {icaoFor} from '../lib/parsers.js';
import {connect} from '../lib/storage.js';
import {weatherSourceURL,mergeWeatherProducts} from './weather-report.js';
export function normalizeAirports(list){
 if(!Array.isArray(list))throw Error('Danh sách sân bay không hợp lệ.');
 if(list.some(value=>typeof value!=='string'))throw Error('Mã sân bay phải là chữ.');
 const values=[...new Set(list.map(value=>icaoFor(value.trim().toUpperCase())))];
 if(values.length>40||values.some(v=>!/^[A-Z]{4}$/.test(v)))throw Error('Nhập ICAO 4 chữ cái hoặc IATA có hỗ trợ; tối đa 40 sân bay.');return values;
}
async function readCache(key){const db=await connect();return new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function writeCache(key,value){const db=await connect();return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||Error('Không lưu được bản tin.'));});}
function report(data,station){
 if(!data||data.station!==station||typeof data.provider!=='string'||data.provider.length>160||typeof data.fetchedAt!=='string'||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Bản tin không khớp sân bay/thời điểm.');
 const value={station,provider:data.provider,fetchedAt:data.fetchedAt,metar:null,taf:null,sources:{},productFetchedAt:{},staleProducts:{}};
 for(const product of['metar','taf'])if(data[product]!==null&&data[product]!==undefined){
  if(typeof data[product]!=='string'||data[product].length>32768||/data:image\//i.test(data[product]))throw Error('Bản tin chữ không hợp lệ.');
  const source=data.sources?.[product];if(!weatherSourceURL(source,station,product))throw Error('Nguồn bản tin không hợp lệ.');value[product]=data[product];value.sources[product]=source;
  const anchor=data.productFetchedAt?.[product]||data.fetchedAt;if(typeof anchor!=='string'||!Number.isFinite(Date.parse(anchor)))throw Error('Thời điểm bản tin không hợp lệ.');value.productFetchedAt[product]=anchor;if(data.stale||data.staleProducts?.[product]===true)value.staleProducts[product]=true;
 }
 if(!value.metar&&!value.taf)throw Error('Nguồn chưa có METAR/TAF hiện hành cho sân bay này.');if(data.stale)value.stale=true;return value;
}
export function createWeatherWatch({uid=null,airports=[],fetchImpl=fetch,now=()=>new Date(),isCurrent=()=>true,readCache:load=readCache,writeCache:save=writeCache}={}){
 let selected=normalizeAirports(airports),reports={},errors={},cacheError=null,active=true,pending=null,queue=Promise.resolve();const listeners=new Set(),controllers=new Set(),loading=new Set(),key='weather-watch:v1:'+(uid?'account:'+uid:'guest');
 const current=()=>active&&isCurrent(),snapshot=()=>({airports:[...selected],reports:structuredClone(Object.fromEntries(Object.entries(reports).filter(([s])=>selected.includes(s)))),errors:{...errors},loading:[...loading],cacheError});
 const emit=()=>{if(current())for(const fn of listeners)fn(snapshot());};
 const ready=(async()=>{try{const cached=await load(key);if(!current())return;for(const [station,value]of Object.entries(cached?.reports||{})){if(!selected.includes(station))continue;try{reports[station]=report(value,station);}catch{}}}catch{cacheError='Không đọc được bản tin đã lưu.';}emit();})();
 function persist(){queue=queue.catch(()=>{}).then(async()=>{if(!current())return;try{await save(key,{reports:structuredClone(Object.fromEntries(Object.entries(reports).filter(([s])=>selected.includes(s))))});if(current())cacheError=null;}catch{if(current())cacheError='Không lưu được bản tin offline. Kiểm tra dung lượng và thử cập nhật lại.';}emit();});return queue;}
 async function refresh({force=false}={}){
  await ready;if(!current())return snapshot();
  if(pending){await pending;if(current()&&selected.some(s=>!reports[s]&&!errors[s]))return refresh();return snapshot();}
  if(globalThis.navigator?.onLine===false){emit();return snapshot();}
  const work=selected.filter(s=>force||!reports[s]||now()-Date.parse(reports[s].fetchedAt)>=300000);let index=0;
  pending=(async()=>{const worker=async()=>{while(current()&&index<work.length){const station=work[index++];if(!selected.includes(station))continue;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);controllers.add(controller);loading.add(station);delete errors[station];emit();
   try{const response=await fetchImpl('/api/weather?station='+station,{signal:controller.signal,cache:'no-store'});const raw=await response.json();if(!current()||!selected.includes(station))continue;if(!response.ok)throw Error('Không kết nối được nguồn thời tiết.');reports[station]=mergeWeatherProducts(reports[station],report(raw,station));await persist();}
   catch(error){if(current()&&selected.includes(station))errors[station]=error.name==='AbortError'?'Nguồn phản hồi chậm; bấm cập nhật để thử lại.':error.message;}
   finally{clearTimeout(timer);controllers.delete(controller);loading.delete(station);emit();}
  }};try{await Promise.all(Array.from({length:Math.min(4,work.length)},worker));}finally{pending=null;emit();}})();await pending;return snapshot();
 }
 return{ready,snapshot,refresh,setAirports(list){selected=normalizeAirports(list);for(const s of Object.keys(reports))if(!selected.includes(s))delete reports[s];for(const s of Object.keys(errors))if(!selected.includes(s))delete errors[s];emit();},subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},dispose(){active=false;for(const c of controllers)c.abort();listeners.clear();}};
}
