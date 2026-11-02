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
 const weekday=date.toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'}),day=date.getUTCDate();
 const time=n=>n===null?'—':duration(n);
 return `<article class="nv-flight-card" data-flight-card="${e(f.id)}"><button type="button" class="nv-flight-open" data-action="edit" data-id="${e(f.id)}" aria-label="Chi tiết ${e(f.flightNo)} · ${e(f.date)} · ${e(f.dep)} đến ${e(f.dest)}">
  <span class="nv-card-heading"><span class="nv-flight-date"><small>${e(weekday)}</small><strong>${day}</strong></span><span class="nv-flight-number"><small>✈ FLT</small><strong>${e(f.flightNo)}</strong></span><span class="nv-flight-function">${allocation}</span><span class="nv-flight-state">${f.confirmed?'✓ FINAL':actual?'◷ DRAFT':'◷ SCHEDULED'}</span></span>
  <span class="nv-card-route"><strong>${e(f.dep)}</strong><span><small>BLOCK</small><b class="mono">${time(totals.block)}</b></span><strong>${e(f.dest)}</strong></span>
  <span class="nv-card-times"><span><b class="mono">${clock(times.out)}</b><small>${e(icaoFor(f.dep)||'—')}</small></span><span class="nv-timeline" aria-label="Sơ đồ OUT / OFF / ON, không theo tỷ lệ"><span class="nv-timeline-track"><i></i><i></i><b aria-hidden="true">✈</b></span><span class="nv-timeline-labels"><small>Init</small><small>Dep</small><small>Arr</small></span></span><span><b class="mono">${clock(times.in)}</b><small>${e(icaoFor(f.dest)||'—')}</small></span></span>
  <span class="nv-card-operation"><span>${e(f.role||'—')}</span><span>FLIGHT <b class="mono">${time(totals.airborne)}</b></span></span>
  <span class="nv-card-foot"><span>${e(f.reg||'Registration —')} · ${e(f.aircraft||'Aircraft —')}</span></span>
  <span class="nv-card-caption">${actual?'Actual':'Scheduled'} OUT / IN · UTC${times.in?.slice(0,10)>f.date?' · IN '+e(times.in.slice(0,10)):''}${f.confirmed?'':' · Chưa tính vào tổng Actual'}</span>
 </button><button type="button" class="nv-card-scan flight-scan-shortcut" data-flight-scan-shortcut="list" data-action="image" data-id="${e(f.id)}" aria-label="Scan Flight Log · ${e(f.flightNo)}">Scan Flight Log</button></article>`;
}
export function renderLogbook({flights,people,month,query,filters,limit=80,icon=()=>''}){
 const selected=selectFlights(flights,{month,query,filters,people}),shown=selected.slice(0,limit),visibleIds=new Set(shown.map(f=>f.id)),groups=flightGroups(selected),total=statistics(selected);
 return `<section class="nv-logbook" data-navy-logbook>
  <div class="nv-logbook-tools"><label class="nv-search">${icon('search')}<input type="search" data-filter="search" value="${e(query)}" placeholder="Flight, sân bay, crew…" aria-label="Tìm chuyến bay"></label><button type="button" class="iconbtn nv-filter-button" data-action="navy-filters" aria-label="Bộ lọc chuyến bay${filterCount(filters)?' · '+filterCount(filters)+' điều kiện':''}">${icon('filter')}${filterCount(filters)?'<b>'+filterCount(filters)+'</b>':''}</button></div>
  <div class="nv-month-navigator"><button type="button" class="iconbtn" data-action="month-prev" aria-label="Tháng trước">${icon('left')}</button><label><span>Tháng bay · UTC</span><strong class="nv-month-name">${new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'})}</strong><input type="month" value="${e(month)}" data-navy-month aria-label="Chọn tháng bay"></label><button type="button" class="iconbtn" data-action="month-next" aria-label="Tháng sau">${icon('chevron')}</button><button type="button" class="btn ghost" data-action="navy-period">${filters.period==='all'?'Theo tháng':'Tất cả tháng'}</button></div>
  <div class="nv-list-status" role="status"><span>${selected.length} chuyến${selected.length>shown.length?' · đang hiển thị '+shown.length:''}</span><span>ACTUAL BLOCK <strong class="mono">${duration(total.block)}</strong></span></div>
  ${groups.map(g=>{const visible=g.records.filter(f=>visibleIds.has(f.id));return visible.length?`<section class="nv-month-group"><header class="nv-month-header"><h2>${monthLabel(g.month)}</h2><span>ACTUAL · BLOCK <strong class="mono">${duration(g.totals.block)}</strong></span></header><div class="nv-flight-list">${visible.map(renderFlightCard).join('')}</div></section>`:'';}).join('')||`<div class="empty nv-empty">${icon('book')}<h2>Chưa có chuyến bay phù hợp</h2><p>Đổi tháng, tìm kiếm hoặc xóa bộ lọc để xem lại.</p><button type="button" class="btn" data-action="navy-clear">Xóa bộ lọc</button><button type="button" class="btn primary" data-action="add">Thêm chuyến bay</button></div>`}
  ${selected.length>shown.length?'<button type="button" class="btn nv-load-more" data-action="navy-more-records">Xem thêm '+Math.min(80,selected.length-shown.length)+' chuyến</button>':''}
  <p class="nv-total-note">Tổng Actual chỉ gồm Block đã xác nhận. Flight = OFF → ON, Block = OUT → IN. Bộ lọc không sửa dữ liệu.</p>
 </section>`;
}
const select=(name,label,value,options)=>`<label class="nv-filter-row"><span>${label}</span><select name="${name}">${options.map(([v,text])=>`<option value="${e(v)}"${value===v?' selected':''}>${e(text)}</option>`).join('')}</select></label>`;
const input=(name,label,value,type='text',attrs='')=>`<label class="nv-filter-row"><span>${label}</span><input name="${name}" type="${type}" value="${e(value)}" ${attrs}></label>`;
export function renderFilters(filters,{flights,people,month,query}){
 const f=filters,types=[...new Set(flights.map(r=>r.aircraft).filter(Boolean))].sort();
 return `<form data-navy-filter-form class="nv-filter-form"><section class="nv-filter-card">${select('period','Khoảng thời gian',f.period,[['month',monthLabel(month)],['all','Tất cả tháng'],['range','Từ ngày / đến ngày']])}<div class="nv-filter-rows" data-filter-range>${input('from','Từ ngày',f.from,'date')}${input('to','Đến ngày',f.to,'date')}</div></section>
 <section class="nv-filter-card">${select('status','Trạng thái',f.status,[['all','Tất cả'],['confirmed','Đã xác nhận'],['pending','Chưa xác nhận'],['incomplete','Thiếu mốc Actual']])}<div class="nv-filter-rows">${select('aircraft','Aircraft type',f.aircraft,[['','Tất cả'],...types.map(t=>[t,t])])}${input('reg','Registration',f.reg)}${input('airport','Sân bay · IATA / ICAO',f.airport)}${select('role','Vai trò',f.role,[['','Tất cả'],['PF','PF'],['PM','PM']])}</div>${select('pilot','Crew',f.pilot,[['','Tất cả'],...people.map(p=>[p.id,p.name+' · '+p.rank])])}</section>
 <section class="nv-filter-card"><div class="nv-filter-rows">${select('allocation','Có giờ PIC / SIC',f.allocation,[['','Tất cả'],['pic','PIC'],['sic','SIC']])}${select('rules','Có giờ IFR / VFR',f.rules,[['','Tất cả'],['ifr','IFR'],['vfr','VFR']])}${select('conditions','Điều kiện',f.conditions,[['','Tất cả'],['day','Day'],['night','Night'],['instrument','Actual instrument']])}</div><p class="muted">Theo số phút hiện có; trường chưa ghi không được coi là 0.</p></section>
 <section class="nv-filter-card"><h3>Block time · phút</h3><div class="nv-filter-rows">${input('minBlock','Tối thiểu',f.minBlock,'number','min="0" max="1440" step="1"')}${input('maxBlock','Tối đa',f.maxBlock,'number','min="0" max="1440" step="1"')}</div></section><p role="alert" data-filter-error hidden></p><p class="nv-total-note">Chỉ lọc chuyến bay; SIM và training vẫn nằm trong Lịch bay / Duty.</p>
 <footer class="nv-filter-footer"><button type="button" class="btn ghost" data-navy-filter-clear>Xóa tất cả</button><button type="submit" class="btn primary" data-navy-filter-apply>Hiển thị ${selectFlights(flights,{month,query,filters:f,people}).length} chuyến</button></footer></form>`;
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
