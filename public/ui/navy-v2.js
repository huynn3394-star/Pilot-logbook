/** Navy presentation/view models. No persistence, network calls or record mutation. */
import {clock,duration,statistics} from '../lib/domain.js';
import {timeTotals} from '../lib/flight-times.js';
import {icaoFor} from '../lib/parsers.js';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHTML;
export const defaultFilters=()=>({period:'month',from:'',to:'',status:'all',aircraft:'',reg:'',airport:'',role:'',pilot:'',allocation:'',rules:'',conditions:'',minBlock:'',maxBlock:''});
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const filterCount=filters=>Object.entries(filters).filter(([key,value])=>value!==defaultFilters()[key]).length;
export function selectFlights(flights,{month,query='',filters=defaultFilters(),people=[]}={}){
 const q=fold(query),names=new Map(people.map(p=>[p.id,p.name]));
 return flights.filter(f=>{
  if(filters.period==='month'&&month&&!f.date.startsWith(month))return false;
  if(filters.period==='range'&&((filters.from&&f.date<filters.from)||(filters.to&&f.date>filters.to)))return false;
  const crew=[f.captainId,f.foId,...(f.crewIds||[])].filter(Boolean);
  if(q&&!fold([f.flightNo,f.dep,f.dest,icaoFor(f.dep),icaoFor(f.dest),f.aircraft,f.reg,...crew.map(id=>names.get(id))].join(' ')).includes(q))return false;
  if(filters.status==='confirmed'&&!f.confirmed)return false;
  if(filters.status==='incomplete'&&['out','off','on','in'].every(k=>f.actual?.[k]))return false;
  if(filters.status==='pending'&&f.confirmed)return false;
  if(filters.aircraft&&f.aircraft!==filters.aircraft)return false;
  if(filters.reg&&!fold(f.reg).includes(fold(filters.reg)))return false;
  if(filters.airport&&![f.dep,f.dest,icaoFor(f.dep),icaoFor(f.dest)].some(p=>fold(p)===fold(filters.airport)))return false;
  if(filters.role&&f.role!==filters.role)return false;
  if(filters.pilot&&!crew.includes(filters.pilot))return false;
  const t=timeTotals(f);
  if(filters.allocation&&!(t[filters.allocation]>0))return false;
  if(filters.rules&&!(t[filters.rules]>0))return false;
  if(filters.conditions&&!(t[filters.conditions]>0))return false;
  if(filters.minBlock!==''&&(t.block===null||t.block<Number(filters.minBlock)))return false;
  if(filters.maxBlock!==''&&(t.block===null||t.block>Number(filters.maxBlock)))return false;
  return true;
 }).sort((a,b)=>(a.scheduled?.out||a.date).localeCompare(b.scheduled?.out||b.date)||a.id.localeCompare(b.id));
}
export function flightGroups(flights){
 const groups=new Map();
 for(const f of flights){const key=f.date.slice(0,7);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
 return [...groups].map(([month,records])=>({month,records,totals:statistics(records)}));
}
export function monthLabel(month){return new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});}
export function renderFlightCard(f){
 const totals=timeTotals(f),date=new Date(f.date+'T12:00:00Z'),actual=Boolean(f.actual?.out||f.actual?.in),times=actual?f.actual:f.scheduled||{};
 const allocation=[f.picMinutes>0?'PIC':'',f.logbook?.sicMinutes>0?'SIC':''].filter(Boolean).join('/')||'—';
 const weekday=date.toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'}),day=String(date.getUTCDate()).padStart(2,'0');
 const block=totals.block===null?'—':duration(totals.block)+'h';
 const airborne=totals.airborne===null?'—':duration(totals.airborne)+'h';
 const status=f.confirmed?'✓ FINAL':actual?'◷ DRAFT':'◷ SCHEDULED';
 const airport=(code)=>e(icaoFor(code)||'—');
 const op=['PF','PM'].includes(f.role)?f.role:'—';
 return `<article class="nv-flight-card nv-v215-card" data-flight-card="${e(f.id)}">
  <button type="button" class="nv-flight-open" data-action="edit" data-id="${e(f.id)}" aria-label="Chi tiết ${e(f.flightNo)} · ${e(f.date)} · ${e(f.dep)} đến ${e(f.dest)}">
   <span class="nv-card-heading">
    <span class="nv-flight-date"><small>${e(weekday.toUpperCase())}</small><strong>${day}</strong></span>
    <span class="nv-card-separator" aria-hidden="true">|</span>
    <span class="nv-flight-number"><small>✈ FLT</small><strong>${e(f.flightNo || '—')}</strong></span>
    <span class="nv-flight-function">${allocation}</span>
    <span class="nv-flight-state nv-flight-status-pill ${f.confirmed?'is-final':actual?'is-draft':'is-scheduled'}" aria-label="${e(status)}">${f.confirmed?'FINAL':actual?'DRAFT':'PLAN'}</span>
   </span>
   <span class="nv-card-route"><strong>${e(f.dep)}</strong><span><small>BLOCK</small><b class="mono">${block}</b></span><strong>${e(f.dest)}</strong></span>
   <span class="nv-card-times nv-v215-times">
    <span class="nv-station"><span class="nv-station-main"><b class="mono">${clock(times.out)}</b><small>${airport(f.dep)}</small></span><span class="nv-station-role">✈ ${e(op)}</span></span>
    <span class="nv-timeline" aria-label="Timeline minh họa Init / Dep / Arr, không theo tỷ lệ thời gian">
     <span class="nv-timeline-track"><i></i><i></i><b aria-hidden="true">✈</b></span>
     <span class="nv-timeline-labels"><small>Init</small><small>Dep</small><small>Arr</small></span>
    </span>
    <span class="nv-station nv-station-dest"><span class="nv-station-main"><small>${airport(f.dest)}</small><b class="mono">${clock(times.in)}</b></span><span class="nv-station-role">${e(op)} ✈</span></span>
   </span>
   <span class="nv-card-foot"><span>${e(f.reg||'Registration —')} · ${e(f.aircraft||'Aircraft —')}</span><span class="nv-card-day">${e(f.date)}</span></span>
   <span class="nv-card-caption">${actual?'Actual':'Scheduled'} OUT / IN · UTC · FLIGHT ${airborne}${times.in?.slice(0,10)>f.date?' · IN '+e(times.in.slice(0,10)):''}${f.confirmed?'':' · Chưa tính vào tổng Actual'}</span>
  </button>
  <button type="button" class="nv-card-scan flight-scan-shortcut" data-flight-scan-shortcut="list" data-action="image" data-id="${e(f.id)}" aria-label="Scan Flight Log · ${e(f.flightNo)}" title="Scan Flight Log"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h5l2-3h4l2 3h5v15H3Z M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/></svg><span>Scan Flight Log</span></button>
 </article>`;
}
export function renderLogbook({flights,people,month,query,filters,limit=80,icon=()=>''}){
 const selected=selectFlights(flights,{month,query,filters,people}),shown=selected.slice(-limit),visibleIds=new Set(shown.map(f=>f.id)),groups=flightGroups(selected).reverse(),total=statistics(selected);
 return `<section class="nv-logbook w5-logbook" data-navy-logbook><div class="w5-logbook-layout"><div class="w5-list-pane">
  <div class="nv-logbook-tools"><label class="nv-search">${icon('search')}<input type="search" data-filter="search" value="${e(query)}" placeholder="Search logbook" aria-label="Tìm chuyến bay"></label><button type="button" class="iconbtn nv-filter-button" data-action="navy-filters" aria-label="Bộ lọc chuyến bay${filterCount(filters)?' · '+filterCount(filters)+' điều kiện':''}">${icon('filter')}${filterCount(filters)?'<b>'+filterCount(filters)+'</b>':''}</button></div>
  <div class="nv-wader-month-switch" aria-label="Chọn tháng và phạm vi logbook">
    <button type="button" class="nv-wader-month-button" data-action="month-prev" aria-label="Tháng trước">${icon('left')}</button>
    <label class="nv-wader-month-picker"><span>MONTH</span><strong>${new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'})}</strong><input type="month" value="${e(month)}" data-navy-month aria-label="Chọn tháng bay"></label>
    <button type="button" class="nv-wader-month-button" data-action="month-next" aria-label="Tháng sau">${icon('chevron')}</button>
    <button type="button" class="nv-wader-all-months" data-action="navy-period">${filters.period==='all'?'This month':'All months'}</button>
  </div>
  <div class="nv-wader-summary nv-list-status" role="status"><span>${selected.length} chuyến${selected.length>shown.length?' · đang hiển thị '+shown.length:''}</span><span>BLOCK <strong class="mono">${duration(total.block)}</strong></span></div>
  ${groups.map(g=>{const visible=g.records.filter(f=>visibleIds.has(f.id)).reverse();return visible.length?`<section class="nv-month-group"><header class="nv-month-header"><h2><i aria-hidden="true"></i>${monthLabel(g.month)}</h2><span>ACTUAL <strong class="mono">${duration(g.totals.block)}</strong></span></header><div class="nv-flight-list">${visible.map(renderFlightCard).join('')}</div></section>`:'';}).join('')||`<div class="empty nv-empty">${icon('book')}<h2>Chưa có chuyến bay phù hợp</h2><p>Đổi tháng, tìm kiếm hoặc xóa bộ lọc để xem lại.</p><button type="button" class="btn" data-action="navy-clear">Xóa bộ lọc</button><button type="button" class="btn primary" data-action="add">Thêm chuyến bay</button></div>`}
  ${selected.length>shown.length?'<button type="button" class="btn nv-load-more" data-action="navy-more-records">Xem thêm '+Math.min(80,selected.length-shown.length)+' chuyến</button>':''}
  <p class="nv-total-note">Giờ UTC · Actual đã xác nhận · Flight OFF → ON / Block OUT → IN</p></div>${renderFlightPreview(shown.at(-1),people)}</div>
 </section>`;
}
export function renderFlightPreview(f,people=[]){
 if(!f)return '<aside class="w5-detail-pane w5-detail-empty"><p>Chọn một chuyến bay để xem chi tiết.</p></aside>';
 const t=timeTotals(f),times=f.actual||{},crew=[f.captainId,f.foId,...(f.crewIds||[])].filter(Boolean).map(id=>people.find(p=>p.id===id)?.name).filter(Boolean);
 const time=(label,value)=>`<div><small>${label}</small><strong>${clock(value)}</strong><span>UTC</span></div>`;
 return `<aside class="w5-detail-pane" aria-label="Tóm tắt chuyến bay"><div class="w5-detail-top"><span>FLIGHT LOG</span><button class="btn small" type="button" data-action="edit" data-id="${e(f.id)}">Chỉnh sửa</button></div><h2>${e(f.flightNo)}</h2><p class="w5-detail-date">${e(f.date)} · ${e(f.aircraft||'—')} · ${e(f.reg||'—')}</p><div class="w5-detail-route"><div><strong>${e(f.dep)}</strong><small>${e(icaoFor(f.dep))}</small></div><span aria-hidden="true">✈</span><div><strong>${e(f.dest)}</strong><small>${e(icaoFor(f.dest))}</small></div></div><div class="w5-detail-times">${time('OUT',times.out)}${time('ON',times.on)}${time('OFF',times.off)}${time('IN',times.in)}</div><div class="w5-detail-totals"><div><small>FLIGHT</small><strong>${t.airborne===null?'—':duration(t.airborne)}</strong></div><div><small>BLOCK</small><strong>${t.block===null?'—':duration(t.block)}</strong></div></div><div class="w5-detail-section"><span>CREW</span><p>${crew.map(e).join(' · ')||'Chưa ghi crew'}</p></div><div class="w5-detail-section"><span>REMARKS</span><p>${e(f.note||'Chưa có ghi chú.')}</p></div><span class="w5-detail-status">${f.confirmed?'✓ FINAL · Actual đã xác nhận':'◷ DRAFT · Chưa xác nhận'}</span></aside>`;
}
const select=(name,label,value,options)=>`<label class="nv-filter-row"><span>${label}</span><select name="${name}">${options.map(([v,text])=>`<option value="${e(v)}"${value===v?' selected':''}>${e(text)}</option>`).join('')}</select></label>`;
const input=(name,label,value,type='text',attrs='')=>`<label class="nv-filter-row"><span>${label}</span><input name="${name}" type="${type}" value="${e(value)}" ${attrs}></label>`;
export function renderFilters(filters,{flights,people,month,query}){
 const f=filters,types=[...new Set(flights.map(r=>r.aircraft).filter(Boolean))].sort();
 return `<form data-navy-filter-form class="nv-filter-form nv-wader-filter">
 <section class="nv-filter-card nv-filter-period">${select("period","Period",f.period,[["month",monthLabel(month)],["all","All time"],["range","Date range"]])}<div class="nv-filter-rows" data-filter-range>${input("from","From",f.from,"date")}${input("to","To",f.to,"date")}</div></section>
 <section class="nv-filter-card">${select("status","Show",f.status,[["all","Flights · All"],["confirmed","Confirmed"],["pending","Pending"],["incomplete","Incomplete only"]])}</section>
 <section class="nv-filter-card">${select("aircraft","Aircraft type",f.aircraft,[["","Any"],...types.map(t=>[t,t])])}${input("reg","Tail number",f.reg)}</section>
 <section class="nv-filter-card">${input("airport","Airports",f.airport)}</section>
 <section class="nv-filter-card">${select("role","Function",f.role,[["","Any"],["PF","PF"],["PM","PM"]])}${select("pilot","Pilots",f.pilot,[["","Any"],...people.map(p=>[p.id,p.name+" · "+p.rank])])}</section>
 <section class="nv-filter-card">${select("rules","Rules",f.rules,[["","Any"],["ifr","IFR"],["vfr","VFR"]])}${select("conditions","Conditions",f.conditions,[["","Any"],["day","Day"],["night","Night"],["instrument","Actual instrument"]])}${select("allocation","Flight time function",f.allocation,[["","Any"],["pic","PIC"],["sic","SIC"]])}</section>
 <section class="nv-filter-card"><h3>Block time · minutes</h3><div class="nv-filter-rows">${input("minBlock","Under / minimum",f.minBlock,"number",'min="0" max="1440" step="1"')}${input("maxBlock","Over / maximum",f.maxBlock,"number",'min="0" max="1440" step="1"')}</div></section>
 <p role="alert" data-filter-error hidden></p><footer class="nv-filter-footer"><button type="button" class="btn ghost" data-navy-filter-clear>Clear</button><button type="submit" class="btn primary" data-navy-filter-apply>Show ${selectFlights(flights,{month,query,filters:f,people}).length} records</button></footer></form>`;
}

/** Native dialog owns focus trapping/Escape; swipe starts only on its handle. */
export function mountSheet(dialog,{onClose=()=>{}}={}){
 const previous=document.activeElement;
 let start=null,disposed=false;
 const down=event=>{if(event.target.closest('[data-sheet-handle]')){start={y:event.clientY,id:event.pointerId};event.target.setPointerCapture?.(event.pointerId);}};
 const up=event=>{if(start?.id===event.pointerId&&event.clientY-start.y>70)dialog.close();start=null;};
 const backdrop=event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}};
 const cleanup=()=>{if(disposed)return;disposed=true;dialog.removeEventListener('close',cleanup);dialog.removeEventListener('pointerdown',down);dialog.removeEventListener('pointerup',up);dialog.removeEventListener('click',backdrop);dialog.classList.remove('nv-sheet','nv-filter-modal');onClose();if(previous?.isConnected)previous.focus({preventScroll:true});};
 dialog.addEventListener('pointerdown',down);dialog.addEventListener('pointerup',up);dialog.addEventListener('click',backdrop);dialog.addEventListener('close',cleanup,{once:true});
 return {dispose:cleanup};
}
