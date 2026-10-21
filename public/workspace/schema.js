import {weatherSourceURL} from './weather-report.js';
import {validateFlight,validDate} from '../lib/domain.js';
import {icaoFor} from '../lib/parsers.js';
export const MAX_RECORD_BYTES=128*1024,MAX_OPERATION_BYTES=800*1024,MAX_RECORDS=8,PAGE_SIZE=100,MAX_PULL_ATTEMPTS=3;
export const kinds=['profile','preferences','flight','duty','person'];
export const validUID=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
export const clone=v=>structuredClone(v);
export const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
export const plain=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=message=>{throw new Error(message);};
export function canonical(v){
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(plain(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 if(v===undefined||typeof v==='function'||typeof v==='symbol'||typeof v==='bigint'||(typeof v==='number'&&!Number.isFinite(v)))fail('Dữ liệu không phải JSON hợp lệ.');
 return JSON.stringify(v);
}
export async function sha256(input){const raw=typeof input==='string'?new TextEncoder().encode(input):input;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function recordKey(kind,id){if(!kinds.includes(kind)||typeof id!=='string'||!id||id.length>100)fail('Định danh bản ghi không hợp lệ.');return sha256(kind+'\u0000'+id);}
export function only(v,allowed){if(!plain(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('Trường dữ liệu không được hỗ trợ.');}
function text(v,max,optional=false){if(optional&&v===undefined)return;if(typeof v!=='string'||v.length>max)fail('Trường văn bản không hợp lệ.');}
function utc(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/.test(v)&&Number.isFinite(Date.parse(v));}
export function validateEvidence(ref){only(ref,['sha256','mime','bytes','cloudReady']);if(!/^[a-f0-9]{64}$/.test(ref.sha256)||!['image/jpeg','image/png','image/webp'].includes(ref.mime)||!Number.isInteger(ref.bytes)||ref.bytes<=0||ref.bytes>6*1024*1024||typeof ref.cloudReady!=='boolean')fail('Ảnh minh chứng không hợp lệ.');return ref;}
export function validateWeather(w,f){
 only(w,['day','reports']);validDate(w.day);if(w.day!==f.date||!Array.isArray(w.reports)||w.reports.length>2)fail('Ngày/sân bay thời tiết không khớp chuyến.');
 const airports=new Set([icaoFor(f.dep),icaoFor(f.dest)]),seen=new Set();
 for(const d of w.reports){
  only(d,['station','provider','fetchedAt','source','sources','metar','taf','stale','cached']);
  if(!/^[A-Z]{4}$/.test(d.station)||!airports.has(d.station)||seen.has(d.station)||!utc(d.fetchedAt)||d.fetchedAt.slice(0,10)!==w.day)fail('Bản tin thời tiết không khớp sân bay/ngày lấy.');seen.add(d.station);text(d.provider,160);
  for(const k of ['metar','taf'])if(d[k]!==null){text(d[k],32768);if(/data:image\//i.test(d[k]))fail('Chỉ lưu thời tiết dạng chữ.');}
  const source=(v,product)=>{text(v,512);if(!weatherSourceURL(v,d.station,product))fail('Nguồn thời tiết không hợp lệ.');};
  source(d.source);if(d.sources){only(d.sources,['metar','taf']);Object.entries(d.sources).forEach(([product,url])=>source(url,product));}for(const k of ['stale','cached'])if(d[k]!==undefined&&typeof d[k]!=='boolean')fail('Trạng thái thời tiết không hợp lệ.');
 }
}
export function validateRecord(r){
 only(r,['schemaVersion','kind','id','revision','archived','data','evidence','archive']);
 if(r.schemaVersion!==1||!kinds.includes(r.kind)||typeof r.id!=='string'||!r.id||r.id.length>100||!Number.isSafeInteger(r.revision)||r.revision<0||typeof r.archived!=='boolean'||!plain(r.data))fail('Bản ghi workspace không hợp lệ.');
 canonical(r);if(bytes(r)>MAX_RECORD_BYTES)fail('Bản ghi vượt 128 KiB.');
 if(r.archive){only(r.archive,['id','at']);text(r.archive.id,128);if(!r.archive.id||!utc(r.archive.at))fail('Thông tin thùng rác không hợp lệ.');}if(r.archived&&!r.archive)fail('Thiếu thông tin phục hồi bản đã lưu trữ.');
 if(r.evidence){if(r.kind!=='flight')fail('Ảnh chỉ thuộc chuyến bay.');validateEvidence(r.evidence);}
 const d=r.data;if(['flight','duty','person'].includes(r.kind)&&d.id!==r.id)fail('ID bản ghi không khớp.');
 if(r.kind==='flight'){
  only(d,['id','date','flightNo','dep','dest','aircraft','reg','scheduled','actual','confirmed','role','picMinutes','nightMinutes','takeoffBy','landingBy','landingMode','captainId','foId','crewIds','source','confidence','note','dutyId','updatedAt','weather']);validateFlight(d);
  if(d.captainId&&d.captainId===d.foId)fail('Captain và First Officer cần khác nhau.');
  for(const k of ['scheduled','actual'])if(d[k])only(d[k],k==='scheduled'?['out','off','on','in','dep','dest','aircraft','source']:['out','off','on','in']);
  for(const [k,max]of [['note',3000],['source',120],['aircraft',80],['reg',80],['updatedAt',64]])text(d[k],max,true);
  if(d.dutyId!==undefined&&d.dutyId!==null)text(d.dutyId,100);if(d.crewIds?.length>100)fail('Danh sách crew quá dài.');if(d.weather)validateWeather(d.weather,d);
 }else if(r.kind==='person'){
  only(d,['id','name','rank','note']);text(d.name,80);text(d.rank,80);text(d.note,1000,true);if(!d.name.trim()||!d.rank.trim())fail('Thiếu tên/vai trò crew.');
 }else if(r.kind==='duty'){
  only(d,['id','date','type','report','release','note']);validDate(d.date);if(!['FLIGHT','STANDBY','RESERVE','DAY OFF','POSITIONING','SIM','TRAINING'].includes(d.type))fail('Loại duty không hợp lệ.');for(const k of ['report','release'])if(d[k]&&!utc(d[k]))fail('Giờ duty phải là UTC.');if(d.report&&d.release&&Date.parse(d.report)>Date.parse(d.release))fail('Giờ release trước report.');text(d.note,3000,true);
 }else if(r.kind==='profile'){
  only(d,['name','base']);if(r.id!=='profile'||r.archived)fail('Hồ sơ không hợp lệ.');text(d.name,60);text(d.base,4);if(!d.name.trim()||(d.base&&!/^[A-Z]{3,4}$/.test(d.base)))fail('Tên/base không hợp lệ.');
 }else{
  only(d,['tomorrow','beforeDuty','missingActual','leadMinutes','eveningHour','weatherAirports']);if(d.weatherAirports!==undefined&&(!Array.isArray(d.weatherAirports)||d.weatherAirports.length>40||new Set(d.weatherAirports).size!==d.weatherAirports.length||d.weatherAirports.some(v=>typeof v!=='string'||!/^[A-Z]{4}$/.test(v))))fail('Danh sách sân bay không hợp lệ (tối đa 40 ICAO, không trùng).');if(r.id!=='preferences'||r.archived)fail('Cài đặt không hợp lệ.');for(const k of ['tomorrow','beforeDuty','missingActual'])if(d[k]!==undefined&&typeof d[k]!=='boolean')fail('Lựa chọn nhắc lịch không hợp lệ.');if(d.leadMinutes!==undefined&&(!Number.isInteger(d.leadMinutes)||d.leadMinutes<5||d.leadMinutes>1440))fail('Thời gian nhắc không hợp lệ.');if(d.eveningHour!==undefined&&(!Number.isInteger(d.eveningHour)||d.eveningHour<0||d.eveningHour>23))fail('Giờ nhắc không hợp lệ.');
 }return r;
}
export function validateOperation(op){
 only(op,['schemaVersion','operationId','uid','deviceId','sequence','parents','baseRevision','changes','importPart']);
 if(op.schemaVersion!==1||!validUID(op.operationId)||!validUID(op.uid)||!validUID(op.deviceId)||!Number.isSafeInteger(op.sequence)||op.sequence<1||!Number.isSafeInteger(op.baseRevision)||op.baseRevision<0||!Array.isArray(op.parents)||op.parents.some(p=>!validUID(p))||op.parents.length>1000||!Array.isArray(op.changes)||!op.changes.length||op.changes.length>MAX_RECORDS)fail('Operation workspace không hợp lệ.');
 const seen=new Set();for(const c of op.changes){only(c,['kind','id','base','next']);validateRecord(c.next);if(c.base!==null){validateRecord(c.base);if(c.base.kind!==c.kind||c.base.id!==c.id)fail('Bản nền khác bản ghi.');}if(c.next.kind!==c.kind||c.next.id!==c.id||seen.has(c.kind+'\0'+c.id))fail('Bản ghi trùng hoặc khác định danh.');seen.add(c.kind+'\0'+c.id);}
 if(op.importPart){only(op.importPart,['hash','index','total']);if(!/^[a-f0-9]{64}$/.test(op.importPart.hash)||!Number.isInteger(op.importPart.index)||!Number.isInteger(op.importPart.total)||op.importPart.index<0||op.importPart.index>=op.importPart.total)fail('Phần nhập không hợp lệ.');}canonical(op);if(bytes(op)>MAX_OPERATION_BYTES)fail('Operation vượt 800 KiB.');return op;
}
