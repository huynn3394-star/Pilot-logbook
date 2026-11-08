/** User-selected clock rule, not a solar-night or regulatory calculation.
 * UTC records stay UTC. Local clocks use the timezone at the estimated position.
 */
import tzlookup from './vendor/tz-lookup.js';
import {mapAirports} from '../ui/airport-map-data.js';

const aliases=new Map();
for(const [icao,point] of Object.entries(mapAirports))if(point[2]){
 const code=point[2];aliases.set(code,aliases.has(code)?null:icao);
}
const clocks=new Map(),rad=Math.PI/180;
export function airportLocation(code){
 const key=String(code??'').trim().toUpperCase(),icao=mapAirports[key]?key:aliases.get(key),p=mapAirports[icao];
 if(!p)return null;
 return {icao,longitude:p[0],latitude:p[1],timeZone:tzlookup(p[1],p[0])};
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))return NaN;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,19)===value.slice(0,19)?ms:NaN;
}
export function isLocalNight(instant,timeZone){
 const ms=typeof instant==='number'?instant:timestamp(instant);
 if(!Number.isFinite(ms))throw Error('Invalid UTC instant');
 if(!clocks.has(timeZone))clocks.set(timeZone,new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',hourCycle:'h23'}));
 const hour=Number(clocks.get(timeZone).format(new Date(ms)));
 return hour>=18||hour<6;
}
/** Shortest great circle, including date-line crossings. Antipodes have no unique route. */
export function routePosition(a,b,fraction){
 const vector=p=>{const lat=p.latitude*rad,lon=p.longitude*rad;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];};
 const u=vector(a),v=vector(b),dot=Math.max(-1,Math.min(1,u.reduce((sum,n,i)=>sum+n*v[i],0))),angle=Math.acos(dot),f=Math.max(0,Math.min(1,fraction));
 if(dot<-0.999999)return null;
 const weight=angle<1e-8?[1-f,f]:[Math.sin((1-f)*angle)/Math.sin(angle),Math.sin(f*angle)/Math.sin(angle)];
 const p=u.map((n,i)=>weight[0]*n+weight[1]*v[i]);
 return {latitude:Math.atan2(p[2],Math.hypot(p[0],p[1]))/rad,longitude:Math.atan2(p[1],p[0])/rad};
}
function eventCounts(owner,instant,airport){
 if(!Number.isFinite(instant)||!owner)return null;
 if(['captain','fo','other'].includes(owner))return {day:0,night:0};
 if(owner!=='self'||!airport)return null;
 const night=isLocalNight(instant,airport.timeZone);
 return {day:night?0:1,night:night?1:0};
}
export function calculateFlightNight(flight){
 const actual=flight.actual||{},t=Object.fromEntries(['out','off','on','in'].map(k=>[k,timestamp(actual[k])])),dep=airportLocation(flight.dep),dest=airportLocation(flight.dest);
 const result={nightMinutes:null,takeoff:null,landing:null,depTimeZone:dep?.timeZone??null,destTimeZone:dest?.timeZone??null,status:'missing-block',routeEstimated:true};
 // Any supplied event must be valid and chronological. Do not classify an invalid sequence.
 const supplied=['out','off','on','in'].filter(k=>actual[k]);
 if(supplied.some(k=>!Number.isFinite(t[k]))||supplied.some((k,i)=>i&&t[k]<t[supplied[i-1]]))return {...result,status:'invalid-times'};
 try{
  result.takeoff=eventCounts(flight.takeoffBy,t.off,dep);
  result.landing=eventCounts(flight.landingBy,t.on,dest);
  if(!Number.isFinite(t.out)||!Number.isFinite(t.in))return result;
  if(t.in-t.out>86400000)return {...result,takeoff:null,landing:null,status:'invalid-times'};
  if(!dep||!dest)return {...result,status:'unknown-airport'};
  const airborne=Number.isFinite(t.off)&&Number.isFinite(t.on);
  result.routeEstimated=!airborne;
  const start=airborne?t.off:t.out,end=airborne?t.on:t.in;
  if(!routePosition(dep,dest,0.5))return {...result,status:'ambiguous-route'};
  let night=0;
  // Integrate each phase separately so OFF/ON and taxi boundaries remain exact.
  const phases=airborne?[[t.out,t.off,dep],[t.off,t.on,null],[t.on,t.in,dest]]:[[t.out,t.in,null]];
  for(const [from,to,stationary] of phases)for(let ms=from;ms<to;ms+=30000){
   const next=Math.min(ms+30000,to),mid=(ms+next)/2,p=stationary||routePosition(dep,dest,(mid-start)/(end-start));
   const zone=stationary?.timeZone||tzlookup(p.latitude,p.longitude);
   if(isLocalNight(mid,zone))night+=next-ms;
  }
  return {...result,nightMinutes:Math.min(Math.round((t.in-t.out)/60000),Math.round(night/60000)),status:'estimated'};
 }catch{return {...result,nightMinutes:null,status:'unsupported-timezone'};}
}
