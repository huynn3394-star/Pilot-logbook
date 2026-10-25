import {savedReportTiming,weatherSourceURL} from './weather-report.js';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Work on raw-text offsets, then escape every piece. Never regex-replace generated HTML.
export function highlightWeatherReport(value){
 const raw=String(value??'');let html='',cursor=0;
 for(const match of raw.matchAll(/[A-Z0-9+/_-]+/gi)){
  const token=match[0];let start=-1,length=0;
  if(/^(?:RE|VC)?[+-]?TSRA(?:(?:DZ|SN|SG|IC|PL|GR|GS|UP)){0,3}$/i.test(token)){
   const part=token.match(/[+-]?TSRA/i);start=part.index;length=part[0].length;
  }else if(/^CB$/i.test(token)){start=0;length=2;}
  else if(/^(?:FEW|SCT|BKN|OVC|VV|\/\/\/)(?:\d{3}|\/\/\/)CB$/i.test(token)){start=token.length-2;length=2;}
  if(start<0)continue;
  const from=match.index+start;
  html+=escapeHTML(raw.slice(cursor,from))+'<mark class="weather-attention-word">'+escapeHTML(raw.slice(from,from+length))+'</mark>';
  cursor=from+length;
 }
 return html+escapeHTML(raw.slice(cursor));
}

// A remark mentioning SPECI or a TAF is not a special observation.
export function speciObservation(report,station){
 const raw=report?.metar;
 if(typeof raw!=='string'||raw.length>32768||report.station!==station)return null;
 const match=raw.match(/^\s*SPECI\s+(?:COR\s+)?([A-Z]{4})\s+(\d{2})(\d{2})(\d{2})Z\b/i);
 if(!match||match[1].toUpperCase()!==station||+match[2]<1||+match[2]>31||+match[3]>23||+match[4]>59||/\b(?:NIL|CNL)\b/.test(raw))return null;
 const timing=savedReportTiming(report,'metar'),anchor=report.productFetchedAt?.metar||report.fetchedAt;
 return {station,raw,issueCode:match[2]+match[3]+match[4]+'Z',issuedAt:timing?.station===station?timing.issuedAt:null,fetchedAt:anchor||null,source:weatherSourceURL(report.sources?.metar,station,'metar')?report.sources.metar:null};
}

export function collectSpeciAlerts(groups,snapshot,{now=Date.now(),offline=false}={}){
 const selected=new Map();
 for(const group of groups||[])for(const station of group.airports||[]){
  if(!/^[A-Z]{4}$/.test(station))continue;
  if(!selected.has(station))selected.set(station,[]);
  if(!selected.get(station).includes(group.name))selected.get(station).push(group.name);
 }
 const alerts=[];
 for(const [station,names] of selected){
  const report=snapshot?.reports?.[station],entry=speciObservation(report,station);if(!entry)continue;
  const flags=[],issued=Date.parse(entry.issuedAt),fetched=Date.parse(entry.fetchedAt);
  if(offline)flags.push('OFFLINE · BẢN ĐÃ LƯU');
  if(snapshot.errors?.[station]||report.stale||report.staleProducts?.metar)flags.push('CHƯA CẬP NHẬT ĐƯỢC · GIỮ BẢN CŨ');
  if(!Number.isFinite(issued)||!Number.isFinite(fetched)||issued>now+600000||fetched>now+600000)flags.push('GIỜ BẢN TIN CẦN KIỂM TRA');
  else if(now-issued>7200000)flags.push('BẢN TIN CŨ · TRÊN 2 GIỜ');
  else if(now-fetched>=300000&&!offline)flags.push('BẢN LƯU · CHƯA LÀM MỚI');
  alerts.push({...entry,groups:names,flags});
 }
 return alerts.sort((a,b)=>(Date.parse(b.issuedAt)||0)-(Date.parse(a.issuedAt)||0)||a.station.localeCompare(b.station));
}
const utc=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString().slice(0,16).replace('T',' ')+' UTC':'chưa xác định';};
export function renderSpeciAlerts(alerts){
 if(!alerts.length)return '';
 return '<h2>SPECI · '+alerts.length+' sân bay</h2><p class="weather-speci-hint">Bản tin đặc biệt trong danh sách đã lưu · kiểm tra giờ và nguồn.</p>'+alerts.map(a=>'<article class="weather-speci-item"><div class="weather-speci-head"><strong>'+escapeHTML(a.station)+' · SPECI</strong><button type="button" class="btn small" data-speci-open="'+escapeHTML(a.station)+'">Xem bản tin</button></div><p>Phát hành: '+escapeHTML(a.issuedAt?utc(a.issuedAt):a.issueCode+' · chưa xác định ngày đầy đủ')+'<br>Lấy dữ liệu: '+escapeHTML(utc(a.fetchedAt))+'</p><p class="weather-speci-groups">'+escapeHTML(a.groups.join(' · '))+'</p>'+(a.flags.length?'<p class="weather-speci-flags">'+escapeHTML(a.flags.join(' · '))+'</p>':'')+'</article>').join('');
}

// Keep status labels with the airport, not on an extra row below the report.
export function renderWeatherStationIdentity(station,{saved=false,hasSpeci=false}={}){
 return '<span class="weather-station-identity"><strong>'+escapeHTML(station)+'</strong>'+(hasSpeci?'<span class="weather-speci-badge">SPECI</span>':'')+(saved?'<span class="weather-row-saved">Bản lưu</span>':'')+'</span>';
}
