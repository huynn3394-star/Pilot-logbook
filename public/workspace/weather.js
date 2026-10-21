import {icaoFor} from '../lib/parsers.js';
import {clone,validateWeather} from './schema.js';
export {createWeatherWatch,normalizeAirports} from './weather-watch.js';
export function createWeatherCollector({fetch=globalThis.fetch,now=()=>new Date(),isCurrent=()=>true}={}){
 const cache=new Map(),pending=new Map(),controllers=new Set();
 const today=()=>now().toISOString().slice(0,10);
 const guard=(token,day)=>{if(!isCurrent(token))throw Error('Tài khoản đã đổi; không lưu bản tin của phiên cũ.');if(today()!==day)throw Error('Ngày UTC đã đổi; không gắn bản tin khác ngày chuyến.');};
 async function stationReport(station,day,{refresh,token}){
  const key=day+'\0'+station;if(pending.has(key))return pending.get(key);if(!refresh&&cache.has(key))return cache.get(key);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);controllers.add(controller);
  const request=(async()=>{try{
   if(!/^[A-Z]{4}$/.test(station))throw Error('Chưa có ICAO cho sân bay này.');
   const response=await fetch('/api/weather?station='+station,{signal:controller.signal});guard(token,day);const raw=await response.json();guard(token,day);if(!response.ok)throw Error(raw.error||'Không lấy được thời tiết.');
   if(raw.station!==station||typeof raw.fetchedAt!=='string'||raw.fetchedAt.slice(0,10)!==day)throw Error('Bản tin không khớp sân bay/ngày lấy.');
   if(!raw.metar&&!raw.taf)throw Error('Nguồn chưa có METAR/TAF cho sân bay này.');
   const source=product=>raw.sources?.[product]||`https://aviationweather.gov/api/data/${product}?ids=${station}&format=raw`;
   const report={station,provider:raw.provider,fetchedAt:raw.fetchedAt,source:source('metar'),sources:{metar:source('metar'),taf:source('taf')},metar:raw.metar??null,taf:raw.taf??null};for(const field of['stale','cached'])if(raw[field]!==undefined)report[field]=raw[field];if(Object.values(raw.staleProducts||{}).some(Boolean))report.stale=true;validateWeather({day,reports:[report]},{date:day,dep:station,dest:station});return{report,error:null};
  }catch(error){guard(token,day);return{report:null,error:{station,message:error.message}};}finally{clearTimeout(timeout);controllers.delete(controller);pending.delete(key);}})();
  pending.set(key,request);const result=await request;guard(token,day);cache.set(key,result);return result;
 }
 async function collect(flight,{token,refresh=false}={}){
  if(!isCurrent(token))throw Error('Tài khoản đã đổi.');const day=flight.date,old=flight.weather?.day===day?clone(flight.weather):null;if(day!==today())return{weather:old,status:'historical',errors:[]};
  const stations=[...new Set([icaoFor(flight.dep),icaoFor(flight.dest)])],results=await Promise.all(stations.map(station=>stationReport(station,day,{token,refresh})));guard(token,day);
  const reports=stations.map(station=>{const previous=old?.reports.find(r=>r.station===station),received=results.find(r=>r.report?.station===station)?.report;if(!received)return previous||null;const merged={...received,sources:{...received.sources},metar:received.metar??previous?.metar??null,taf:received.taf??previous?.taf??null};for(const product of['metar','taf'])if(!received[product]&&previous?.[product]){merged.sources[product]=previous.sources?.[product]||previous.source;merged.stale=true;}merged.source=merged.sources.metar;if(merged.stale&&previous?.provider!==received.provider)merged.provider='Bản lưu · xem nguồn từng bản tin';return merged;}).filter(Boolean);
  const errors=results.map(r=>r.error).filter(Boolean),weather=reports.length?{day,reports}:null;if(weather)validateWeather(weather,flight);return{weather,status:errors.length?'partial':'saved',errors};
 }
 return{collect,clear(){for(const controller of controllers)controller.abort();cache.clear();pending.clear();}};
}
