/** Explicit user-entered time categories. Bounds are data checks, not licence-credit rules. */
export const logbookMinuteFields=['sicMinutes','picusMinutes','ifrMinutes','vfrMinutes','instrumentMinutes','crossCountryMinutes'];
export const logbookCountFields=['takeoffDay','takeoffNight','landingDay','landingNight'];
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function span(actual,a,b){if(!actual?.[a]||!actual?.[b])return null;const n=Math.round((Date.parse(actual[b])-Date.parse(actual[a]))/60000);return Number.isFinite(n)&&n>=0&&n<=1440?n:null;}
export function validateLogbook(f){
 if(f.logbook===undefined)return;
 const l=f.logbook,keys=['version',...logbookMinuteFields,...logbookCountFields];
 if(!plain(l)||l.version!==1||Object.keys(l).some(k=>!keys.includes(k)))throw Error('Dữ liệu phân bổ giờ V14 không hợp lệ.');
 const block=span(f.actual,'out','in'),airborne=span(f.actual,'off','on');
 for(const k of [...logbookMinuteFields,...logbookCountFields])if(Object.hasOwn(l,k)){
  const max=logbookCountFields.includes(k)?20:1440;
  if(!Number.isInteger(l[k])||l[k]<0||l[k]>max)throw Error(k+': cần số nguyên không âm, tối đa '+max+'.');
  const limit=k==='instrumentMinutes'?airborne:block;
  if(logbookMinuteFields.includes(k)&&limit!==null&&l[k]>limit)throw Error(k+': vượt '+(k==='instrumentMinutes'?'Airborne':'Block')+' của chuyến.');
 }
 if(block!==null&&(l.ifrMinutes||0)+(l.vfrMinutes||0)>block)throw Error('IFR + VFR vượt Block; kiểm tra phân bổ.');
}
export function readLogbookFields(data,previous){
 const l={version:1};let supplied=false;
 for(const k of [...logbookMinuteFields,...logbookCountFields]){
  const raw=data.get('log_'+k);if(raw===null){if(previous?.[k]!==undefined)l[k]=previous[k];continue;}
  if(String(raw).trim()==='')continue;
  if(!/^\d+$/.test(String(raw).trim()))throw Error(k+': chỉ nhập phút/số lần nguyên không âm.');
  l[k]=Number(raw);supplied=true;
 }
 return supplied||previous?l:undefined;
}
export function timeTotals(f){
 const block=span(f.actual,'out','in');let airborne=span(f.actual,'off','on');
 if(airborne!==null&&((f.actual.out&&Date.parse(f.actual.off)<Date.parse(f.actual.out))||(f.actual.in&&Date.parse(f.actual.on)>Date.parse(f.actual.in))))airborne=null;
 const allocation=n=>block!==null&&Number.isInteger(n)&&n>=0&&n<=block?n:null;
 const pic=allocation(f.picMinutes??0),night=allocation(f.nightMinutes??0),l=f.logbook;
 return {block,airborne,pic,night,day:night===null?null:block-night,sic:l?allocation(l.sicMinutes):pic===null?null:block-pic,legacySIC:!l,
  picus:allocation(l?.picusMinutes),ifr:allocation(l?.ifrMinutes),vfr:allocation(l?.vfrMinutes),instrument:airborne!==null&&Number.isInteger(l?.instrumentMinutes)&&l.instrumentMinutes>=0&&l.instrumentMinutes<=airborne?l.instrumentMinutes:null,crossCountry:allocation(l?.crossCountryMinutes)};
}
