/** Compact flight editor. Optional V14 metadata is guarded by the account capability flag.
 * Tabs only hide DOM panels: changing tabs never rebuilds inputs or drops a draft.
 */
import {minutes,duration,isWaderCsvFlight} from './domain.js';
import {flightTimeInput,readUTCInput} from './utc-input.js';
import {icaoFor} from './parsers.js';
import {readLogbookFields,timeTotals} from './flight-times.js';
import {renderTimeFields,renderScanComparison,renderAuditTrail} from './flight-v14-ui.js';
import {updateAutomaticNight} from './flight-night-ui.js';
import {airportLocation} from './flight-night.js';
import {mapAirports} from '../ui/airport-map-data.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const field=(name,label,value='',type='text',attrs='')=>`<label class="fe-field"><span>${esc(label)}</span><input name="${name}" type="${type}" aria-label="${esc(label)}" value="${esc(value)}" ${attrs}></label>`;
const choice=(name,label,value,options)=>`<label class="fe-field"><span>${esc(label)}</span><select name="${name}" aria-label="${esc(label)}">${options.map(([key,text])=>`<option value="${esc(key)}"${key===value?' selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
const performerOptions=[['','Chưa ghi'],['self','Tôi'],['captain','Captain'],['fo','First Officer'],['other','Crew khác']];
const safePhoto=value=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value||'')?value:'';
const movementIcon=(landing=false)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 21h20"/><path d="M3 13l4 2 11-6a3 3 0 0 1 4 1l-12 8H6l-4-4 1-1ZM10 13 5 9l2-1 7 3"${landing?' transform="translate(0 21) scale(1 -1)"':''}/></svg>`;
const flightDateLabel=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const crewInitials=name=>name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();

function renderPilotControl(name,label,performer,icon){
 return `<div class="fe-pilot-control">
  <label class="fe-pilot-picker">${icon('people')}<span data-fe-pilot-label="${name}">PF</span><select name="${name}" aria-label="${label}">${performerOptions.map(([key,text])=>`<option value="${key}"${key===performer?' selected':''}>${text}</option>`).join('')}</select></label>
  <button type="button" class="fe-pilot-switch" role="switch" aria-label="${name==='takeoffBy'?'Tôi cất cánh':'Tôi hạ cánh'}" aria-checked="${performer==='self'}" data-fe-pilot-switch="${name}"></button>
 </div>`;
}

// Same minute arithmetic as AviLog; incomplete/invalid inputs are not shown as zero.
export function flightEditorSummary(actual={},picMinutes=0,nightMinutes=0){
 const span=(a,b)=>{if(!actual[a]||!actual[b])return null;const n=minutes(actual[a],actual[b]);return Number.isFinite(n)&&n>=0&&n<=1440?n:null;};
 const block=span('out','in');let airborne=span('off','on');
 if(airborne!==null&&((actual.out&&Date.parse(actual.off)<Date.parse(actual.out))||(actual.in&&Date.parse(actual.on)>Date.parse(actual.in))))airborne=null;
 const allocation=value=>block!==null&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=block?Number(value):null;
 const pic=allocation(picMinutes),night=allocation(nightMinutes);
 return{block,airborne,pic,sic:pic===null?null:block-pic,day:night===null?null:block-night,night};
}

export function renderFlightEditor(f,{original=null,imported=null,warning='',icon=()=>'',scan=null,v14Enabled=true,lastAircraft=null,lastCrew=null}={}){
 const actual=f.actual||{},scheduled=f.scheduled||{},photo=safePhoto(imported?.attachment||original?.attachment);
 const wader=isWaderCsvFlight(f),unknown=wader?[['','Chưa ghi']]:[];
 const time=(name,label,value,placeholder,timeIcon)=>flightTimeInput(name,label,value,{date:f.date,placeholder,icon:timeIcon});
 const types=new Set(['A320','A321','E190','B787','A350',f.aircraft,lastAircraft?.aircraft].filter(value=>value&&value!=='OTHER'));
 const typeOptions=[['','Loại tàu bay'],...[...types].map(value=>[value,value]),['OTHER','Khác']];
 const airport=(name,label,value)=>`<label class="fe-field fe-route-airport"><span class="fe-web-label">${label}</span><input name="${name}" value="${esc(value)}" aria-label="${label} · IATA / ICAO" placeholder="${label}" required maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false"><span class="fe-airport-code" data-fe-code="${name}">IATA / ICAO</span></label>`;
 const confirmed=f.confirmed?'FINAL · Đã xác nhận':'DRAFT · Chưa xác nhận';
 return `<form id="flight-form" data-id="${esc(f.id)}" class="flight-editor-form" data-existing-flight="${Boolean(original)}" data-v14-enabled="${v14Enabled}">
  <nav class="fe-tabs" role="tablist" aria-label="Chi tiết chuyến bay">
   ${[['log','book','Log'],['airports','pin','Airports'],['tools','settings','Tools']].map(([key,ico,label],index)=>`<button type="button" role="tab" data-flight-tab="${key}" id="fe-tab-${key}" aria-controls="fe-panel-${key}" aria-selected="${!index}" tabindex="${index?-1:0}">${icon(ico)}<span>${label}</span></button>`).join('')}
  </nav>
  <div class="modal-body fe-body">
   <div class="error fe-error" data-error role="alert" tabindex="-1" hidden></div>
   <section role="tabpanel" class="fe-wader-log-panel" data-flight-panel="log" id="fe-panel-log" aria-labelledby="fe-tab-log">
    <span class="fe-sr-only" data-fe-status>${confirmed}</span>
    ${warning?`<div class="fe-notice fe-review-notice" data-ocr-review role="note">${icon('camera')}<div><strong>Kiểm tra kết quả Smart Scan</strong><p>${esc(warning)}</p></div></div>`:''}
    ${imported?'<p class="fe-help">Đã đọc từ ảnh, chưa tự lưu. Kiểm tra hành trình, từng giờ và ngày UTC trước khi xác nhận.</p>':''}
    ${!v14Enabled?'<div class="fe-notice" data-v14-gate>Chế độ tương thích V13. Giờ bổ sung và lịch sử V14 cần chủ app cập nhật Firebase rules rồi bật V14. Dữ liệu hiện có không bị xóa.</div>':''}
    ${renderScanComparison(original,scan)}
    ${original?`<button type="button" class="fe-back fe-scan" data-action="image" data-id="${esc(original.id)}" data-flight-log-scan aria-label="Nhập ảnh Flight Log" title="Nhập ảnh Flight Log">${icon('camera')}</button>`:''}
    <div class="fe-entry-grid">
    <section class="fe-entry-column fe-route-column" aria-label="Route &amp; Schedule">
     <h3 class="fe-column-title">${icon('arrow')} Route &amp; Schedule</h3>
     <div class="fe-grid fe-main-fields">
      ${field('flightNo','Flight number',f.flightNo,'text',(wader?'maxlength="16"':'required maxlength="12"')+' autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Flight no."')}
      <span class="fe-web-scan-slot"></span>
      <span class="fe-web-label fe-date-label">Date · UTC</span>
      <div class="fe-date-stepper">
       <button type="button" data-fe-step-date="-1" aria-label="Ngày trước">${icon('left')}</button>
       <label class="fe-flight-date"><span aria-hidden="true" data-fe-date-caption></span><input type="date" name="date" aria-label="Ngày bay · UTC" value="${esc(f.date)}" required></label>
       <button type="button" data-fe-step-date="1" aria-label="Ngày sau">${icon('chevron')}</button>
      </div>
     </div>
     <div class="fe-autofill" data-flight-autofill role="status" aria-live="polite"></div>
     <div class="fe-grid fe-scheduled-grid" data-fe-scheduled aria-label="Scheduled · UTC">
      ${time('s_out','Scheduled OUT',scheduled.out,'ETD',icon('clock'))}${time('s_in','Scheduled IN',scheduled.in,'ETA',icon('clock'))}
     </div>
     <div class="fe-grid fe-route-inputs">
      ${airport('dep','From',f.dep)}${airport('dest','To',f.dest)}
     </div>
     <div class="fe-grid fe-actual-grid" aria-label="Actual times · UTC">
      ${time('a_out','OUT · Off blocks',actual.out,'OUT',icon('pin'))}${time('a_on','ON · Landing',actual.on,'ON',movementIcon(true))}
      ${time('a_off','OFF · Takeoff',actual.off,'OFF',movementIcon())}${time('a_in','IN · On blocks',actual.in,'IN',icon('pin'))}
     </div>
    </section>
    <section class="fe-entry-column fe-aircraft-column" aria-label="Aircraft &amp; Crew">
     <h3 class="fe-column-title">${icon('people')} Aircraft &amp; Crew</h3>
     <div class="fe-grid fe-aircraft-fields"><span class="fe-aircraft-icon" aria-hidden="true">${icon('plane')}</span>
      ${field('reg','Tail Number',f.reg||'','text','maxlength="20" autocapitalize="characters" spellcheck="false" placeholder="Tail no."')}
      ${choice('aircraft','Aircraft Type',f.aircraft||'',typeOptions)}
      ${lastAircraft?'<button type="button" class="fe-use-last" data-fe-use-last="aircraft" aria-label="Dùng tàu bay gần nhất">Use last</button>':''}
     </div>
     <div class="fe-crew-row">
     <details class="fe-crew-details" data-fe-crew-details>
      <summary><span>Crew</span><span class="fe-crew-tail"><span class="fe-crew-avatars" data-fe-crew-avatars aria-hidden="true"></span><span class="fe-crew-chevron" aria-hidden="true">${icon('chevron')}</span></span></summary>
      <div class="fe-crew-content"><div class="fe-grid"><div class="crew-entry" data-crew-field="captain"></div><div class="crew-entry" data-crew-field="fo"></div></div><div class="crew-entry" data-crew-field="crew"></div></div>
     </details>
     ${lastCrew?'<button type="button" class="fe-use-last" data-fe-use-last="crew" aria-label="Dùng crew gần nhất">Use last</button>':''}
     </div>
    </section>
    <section class="fe-entry-column fe-details-column" aria-label="Flight Details">
     <h3 class="fe-column-title">${icon('settings')} Flight Details</h3>
     <section class="fe-card fe-operation-card" aria-label="Vai trò và thao tác">
      <div class="fe-grid fe-operations">${choice('role','Pilot Role',f.role,[...unknown,['PF','PF'],['PM','PM']])}${choice('landingMode','Landing Mode',f.landingMode||(wader?'':'manual'),[...unknown,['manual','Manual'],['autoland','Autoland']])}</div>
     </section>
     <div class="fe-grid fe-pilot-grid">${renderPilotControl('takeoffBy','Takeoff by',f.takeoffBy||'',icon)}${renderPilotControl('landingBy','Landing by',f.landingBy||'',icon)}</div>
     <div data-fe-counter-slot></div>
     ${renderTimeFields(f,{enabled:v14Enabled})}
    </section>
    <section class="fe-entry-column fe-totals-column" aria-label="Calculated Totals">
    <h3 class="fe-column-title">Calculated Totals</h3>
    <section class="fe-card nv-primary-times" aria-label="Flight và Block"><div><span>Flight</span><strong class="mono" data-nv-primary-time="airborne">—</strong></div><div><span>Block</span><strong class="mono" data-nv-primary-time="block">—</strong></div></section>
    <section class="fe-card fe-allocation-card" aria-label="Phân bổ PIC và Night">
     <div class="fe-grid fe-allocations">${field('picMinutes','PIC · phút',f.picMinutes||0,'number','min="0" max="1440" step="1"')}${field('nightMinutes','Night · phút',f.nightMinutes??'','number','min="0" max="1440" step="1" placeholder="Chưa tính"')}</div>
    </section>
    <details class="fe-card fe-extra-times fe-auto-night" aria-label="Ngày và đêm tự động"><summary><span>Ngày / đêm tự động</span><span>18:00–06:00 · local</span></summary><p class="fe-help fe-inset" data-night-status role="status"></p><button type="button" class="fe-inline-button" data-night-recalculate>Tính lại ngày/đêm</button></details>
    <section class="fe-card fe-summary-card fe-wader-summary" aria-label="Tổng thời gian chuyến bay">
     <div class="fe-card-heading"><h3>Flight Times</h3><span>Tạm tính · UTC</span></div>
     <div id="actual-summary" class="fe-time-summary" aria-live="polite"></div>
    </section>
    <section class="fe-card fe-remarks"><label class="fe-field"><span>Remarks</span><textarea name="note" rows="2" maxlength="3000" placeholder="Optional notes…">${esc(f.note||'')}</textarea></label></section>
    <button type="button" class="fe-review-button" data-fe-open="tools">${icon('shield')}<span>Nguồn, ảnh & xác nhận Actual<small>Kiểm tra trước khi lưu chuyến bay</small></span>${icon('chevron')}</button>
    </section>
    </div>
   </section>
   <section role="tabpanel" class="fe-wader-airports-panel" data-flight-panel="airports" id="fe-panel-airports" aria-labelledby="fe-tab-airports" hidden>
    <div class="fe-section-heading"><span class="fe-eyebrow">ROUTE</span><h3>Sân bay của chuyến bay</h3><p>Thông tin hành trình từ biểu mẫu, không phải dữ liệu tra cứu trực tuyến.</p></div>
    <section class="fe-card"><div class="fe-grid fe-airport-pair"><div><span>DEPARTURE</span><strong data-fe-airport="dep">${esc(f.dep||'—')}</strong><small data-fe-icao="dep">${esc(f.dep?icaoFor(f.dep):'—')}</small></div><div><span>DESTINATION</span><strong data-fe-airport="dest">${esc(f.dest||'—')}</strong><small data-fe-icao="dest">${esc(f.dest?icaoFor(f.dest):'—')}</small></div></div><button type="button" class="fe-inline-button" data-fe-open="log">Sửa DEP / DEST trong Log ${icon('arrow')}</button></section>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('calendar')} Hành trình dự kiến</h3></div><div class="fe-grid fe-scheduled-route">${field('s_dep','Scheduled DEP',scheduled.dep||f.dep,'text','maxlength="4" autocapitalize="characters" spellcheck="false"')}${field('s_dest','Scheduled DEST',scheduled.dest||f.dest,'text','maxlength="4" autocapitalize="characters" spellcheck="false"')}</div><p class="fe-help fe-inset">Giữ riêng hành trình Scheduled khi chuyến bay thay đổi hoặc chuyển hướng.</p></section>
    <div class="fe-notice">${icon('info')}<div><strong>Chưa có trường procedure riêng</strong><p>Runway, SID/STAR, approach và threats chưa được lưu riêng trong phiên bản này. Có thể ghi tại Remarks; không tự tạo dữ liệu từ ảnh minh họa.</p></div></div>
   </section>
   <section role="tabpanel" class="fe-wader-tools-panel" data-flight-panel="tools" id="fe-panel-tools" aria-labelledby="fe-tab-tools" hidden>
    <div class="fe-section-heading"><span class="fe-eyebrow">REVIEW & SAVE</span><h3>Nguồn & xác nhận</h3><p>Thông tin được lưu theo chuyến bay. Kết quả scan cần bạn kiểm tra trước khi chốt Actual.</p></div>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('file')} Source</h3></div><div class="fe-source-fields">${field('source','Nguồn',f.source||'manual','text','maxlength="120"')}${field('confidence','Độ tin cậy nhận dạng (%)',f.confidence??100,'number','min="0" max="100"')}</div><p class="fe-help fe-inset">Độ tin cậy là thông tin nhận dạng, không phải chứng nhận độ chính xác.</p></section>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('camera')} Files / Photos</h3><span>Ảnh gốc</span></div><div class="fe-evidence" data-flight-evidence><label class="fe-file-label"><span>Thêm / thay ảnh minh chứng</span><input type="file" name="evidence" accept="image/jpeg,image/png,image/webp"><small>JPG / PNG / WebP · tối đa 6 MB</small></label>${photo?`<img class="image-preview" src="${photo}" alt="Ảnh minh chứng chuyến bay"><label class="check"><input type="checkbox" name="removeAttachment">Bỏ ảnh khỏi chuyến này</label>`:''}</div><p class="fe-help fe-inset">Đính kèm ảnh ở đây không chạy OCR. Để đọc giờ, chọn Nhập ảnh Flight Log ngay trong tab Log của chuyến này.</p></section>
    <section class="fe-card fe-confirm-card"><div class="fe-card-heading"><h3>${icon('shield')} Xác nhận Actual</h3></div><div class="fe-confirm-content">${original?.confirmed?'<div class="fe-protected">Actual đã xác nhận đang được bảo vệ. Thay đổi giờ hoặc thông tin khai thác cần cho phép rõ ràng.</div>':''}<label class="check"><input type="checkbox" name="confirmed"${f.confirmed?' checked':''}><span>Tôi đã kiểm tra và xác nhận Actual<small>${wader?'Bản nhập Wader có thể để trống OFF / ON. Kiểm tra OUT / IN và ngày UTC.':'Cần đủ OUT / OFF / ON / IN và đúng ngày UTC.'}</small></span></label>${original?.confirmed?'<label class="check fe-replace"><input type="checkbox" name="replaceConfirmed"><span>Cho phép thay đổi Actual đã xác nhận<small>Chỉ chọn sau khi đã đối chiếu lại thông tin.</small></span></label>':''}${original?.confirmed&&v14Enabled?field('revisionReason','Lý do sửa FINAL', '', 'text', 'maxlength="500" placeholder="Ví dụ: đối chiếu lại ảnh AOC"'):''}<p class="fe-help">Bấm Lưu ở đầu màn hình để ghi thay đổi. Chuyển tab không lưu và không tự xác nhận.</p></div></section>
    ${renderAuditTrail(f)}
    ${original?`<button type="button" class="fe-archive-button" data-action="archive-flight" data-id="${esc(original.id)}">Bỏ chuyến vào thùng rác</button>`:''}
   </section>
  </div>
 </form>`;
}

export function updateFlightEditor(form,options={}){
 let data=new FormData(form);const actual={};
 for(const key of ['out','off','on','in'])try{actual[key]=readUTCInput(data,'a_'+key,form._timeValues?.actual?.[key]);}catch{actual[key]='invalid';}
 updateAutomaticNight(form,{...options,actual});
 data=new FormData(form);
 let logbook;try{logbook=readLogbookFields(data,form._timeValues?.logbook);}catch{}
 const totals=timeTotals({actual,picMinutes:Number(data.get('picMinutes')),nightMinutes:Number(data.get('nightMinutes')),logbook});
 if(String(data.get('nightMinutes')??'').trim()===''){totals.night=null;totals.day=null;}
 const time=value=>value===null?'—':duration(value);
 for(const key of ['airborne','block']){const node=form.querySelector('[data-nv-primary-time="'+key+'"]');if(node)node.textContent=time(totals[key]);}
 function cell(label,key,help=''){
  const field={night:'nightMinutes',ifr:'log_ifrMinutes',instrument:'log_instrumentMinutes'}[key];
  const input=field&&form.elements.namedItem(field);
  const edit=input&&!input.disabled?`<button type="button" data-fe-edit-allocation="${field}" aria-label="Edit ${label}">Edit</button>`:'';
  return `<div${field?` data-summary-featured="${key}"`:''}><span>${label}${help?`<small>${help}</small>`:''}</span><strong class="mono" data-fe-total="${key}">${time(totals[key])}</strong>${edit}</div>`;
 }
 const extra=logbook?cell('PICUS','picus')+cell('Act Ins','instrument')+cell('Cross-country','crossCountry'):'';
 const rules=logbook?`<div class="fe-summary-pair">${cell('VFR','vfr')}${cell('IFR','ifr')}</div>`:'';
 form.querySelector('#actual-summary').innerHTML=`<div class="fe-summary-grid">${cell('Flight','airborne')}${cell('Block','block')}${cell('PIC','pic')}${cell('SIC','sic',totals.legacySIC?'Cũ: Block − PIC · cần kiểm tra':'')}${extra}<div class="fe-summary-pair">${cell('Day','day')}${cell('Night','night')}</div>${rules}</div><p class="fe-help fe-inset">Thống kê dùng Actual đã lưu và xác nhận.</p>`;
 const complete=totals.block!==null&&(isWaderCsvFlight({id:form.dataset.id})||totals.airborne!==null);
 const modal=form.closest('dialog');
 if(modal&&!form._saving){
  const invalid=[...form.elements].some(input=>input.willValidate&&!input.validity.valid);
  for(const button of modal.querySelectorAll('.fe-action-save'))button.disabled=invalid;
 }
 const requested=data.has('confirmed');
 form.querySelector('[data-fe-status]').textContent=form._original?.confirmed?'FINAL · Bản đã lưu được bảo vệ':requested&&complete?'Đã chọn xác nhận · Chưa lưu':'DRAFT · Chưa xác nhận';
 const flightDate=String(data.get('date')||'');
 const reference=Date.parse(flightDate+'T00:00:00Z');
 const dateCaption=Number.isFinite(reference)?flightDateLabel.format(reference):'Ngày bay';
 form.querySelector('[data-fe-date-caption]').textContent=dateCaption;
 const headDate=modal?.querySelector('[data-fe-head-date]');
 if(headDate)headDate.textContent=`Log Flight · ${dateCaption}`;
 for(const input of form.querySelectorAll('[data-utc-event-date]')){
  const days=(Date.parse(input.value+'T00:00:00Z')-reference)/86400000;
  const offset=Number.isFinite(days)&&days!==0?` ${days>0?'+':''}${days}d`:'';
  input.previousElementSibling.textContent='UTC'+offset;
  input.title=input.value?`Ngày UTC: ${input.value}`:'Chọn ngày UTC';
 }
 for(const key of ['dep','dest']){
  const value=String(data.get(key)||'').trim().toUpperCase();
  const airport=airportLocation(value);
  const iata=airport&&mapAirports[airport.icao][2];
  form.querySelector(`[data-fe-code="${key}"]`).textContent=airport?[airport.icao,iata].filter(Boolean).join('/'):'IATA / ICAO';
  form.querySelector(`[data-fe-airport="${key}"]`).textContent=value||'—';
  form.querySelector(`[data-fe-icao="${key}"]`).textContent=airport?.icao||(value?icaoFor(value):'—');
 }
 for(const button of form.querySelectorAll('[data-fe-pilot-switch]')){
  const name=button.dataset.fePilotSwitch;
  const performer=data.get(name);
  button.setAttribute('aria-checked',String(performer==='self'));
  form.querySelector(`[data-fe-pilot-label="${name}"]`).textContent={captain:'Captain',fo:'FO',other:'Crew'}[performer]||'PF';
 }
 for(const input of form.querySelectorAll('.nv-counter input')){
  input.style.setProperty('--fe-count-digits',Math.max(1,input.value.length));
 }
 const crew=form._crewEntry?.read();
 const names=crew?[crew.captain,crew.fo,...crew.crew].map(person=>person?.name?.trim()).filter(Boolean):[];
 form.querySelector('[data-fe-crew-avatars]').innerHTML=names.slice(0,3).map(name=>`<span title="${esc(name)}">${esc(crewInitials(name))}</span>`).join('');
}

export function mountFlightEditor(modal,{title='Chi tiết chuyến bay',icon=()=>'',lastAircraft=null,lastCrew=null}={}){
 const form=modal.querySelector('#flight-form'),head=modal.querySelector('.modal-head'),footer=modal.querySelector('.modal-footer');
 const isNew=form.dataset.existingFlight==='false';
 modal.classList.add('flight-editor-modal');
 modal.classList.toggle('fe-new-flight-modal',isNew);
 const heading=isNew&&title==='Thêm chuyến bay'?'New Flight':title;
 head.innerHTML=`
  <button type="button" class="fe-back fe-close" data-action="close" aria-label="Đóng chi tiết chuyến bay">
   <span class="fe-mobile-close-icon">${icon('left')}</span><span class="fe-web-close-icon">${icon('close')}</span>
  </button>
  <div class="fe-title"><span class="fe-flight-badge">FLIGHT</span><div><h2 id="flight-editor-title">${esc(heading)}</h2><small data-fe-head-date></small></div></div>
  <div class="fe-head-actions"><button type="submit" form="flight-form" class="fe-save fe-action-save" aria-label="Lưu chuyến bay">Save</button></div>`;
 const headActions=head.querySelector('.fe-head-actions');
 const save=headActions.querySelector('.fe-save');
 const targetedScan=form.querySelector('[data-flight-log-scan]');
 if(targetedScan)headActions.prepend(targetedScan);
 else headActions.insertAdjacentHTML('afterbegin',`<button type="button" class="fe-back fe-scan" data-action="image" data-new-flight-scan aria-label="Tạo chuyến từ ảnh Flight Log" title="Tạo chuyến từ ảnh Flight Log">${icon('camera')}<span>Scan</span></button>`);
 const scan=headActions.querySelector('.fe-scan');
 modal.setAttribute('aria-labelledby','flight-editor-title');
 footer.innerHTML=isNew?`<div class="fe-footer-nav"></div><div class="fe-footer-actions">
  <button type="button" data-action="close">Cancel</button>
  <button class="fe-action-save" type="button" data-fe-save-mode="next">Save + Next</button>
  <button class="fe-action-save" type="button" data-fe-save-mode="return">Save + Return</button>
 </div>`:'';
 const nav=form.querySelector('.fe-tabs');
 const tabs=[...nav.querySelectorAll('[data-flight-tab]')],panels=[...form.querySelectorAll('[data-flight-panel]')];
 const wide=matchMedia('(min-width: 1040px)');
 const mobile=matchMedia('(max-width: 720px)');
 function syncLayout(){
  if(isNew){
   if(wide.matches){
    footer.querySelector('.fe-footer-nav').append(nav);
    footer.querySelector('.fe-footer-actions').append(save);
    form.querySelector('.fe-web-scan-slot').append(scan);
    form.querySelector('[data-fe-crew-details]').open=true;
   }else{
    if(mobile.matches)form.prepend(nav);
    else form.append(nav);
    headActions.append(scan,save);
   }
  }
  for(const input of form.querySelectorAll('[data-utc-clock]')){
   input.dataset.defaultPlaceholder ||= input.placeholder;
   input.placeholder=mobile.matches||(isNew&&wide.matches)?'HH:MM':input.dataset.defaultPlaceholder;
  }
 }
 syncLayout();
 if(isNew)wide.addEventListener('change',syncLayout);
 mobile.addEventListener('change',syncLayout);
 let selected='log';const positions=new Map();
 function show(key,{focus=false,restore=true}={}){
  if(!tabs.some(tab=>tab.dataset.flightTab===key))return;
  if(selected!==key)positions.set(selected,form.scrollTop);
  selected=key;
  for(const tab of tabs){const active=tab.dataset.flightTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
  for(const panel of panels)panel.hidden=panel.dataset.flightPanel!==key;
  if(restore)form.scrollTop=positions.get(key)||0;
 }
 const emitInput=input=>input.dispatchEvent(new Event('input',{bubbles:true}));
 function updateDates(event){
  const input=event.target;
  if(input.matches('[data-utc-event-date]'))input.dataset.explicitDate='';
  if(input.name==='date'){
   for(const date of form.querySelectorAll('[data-utc-event-date]:not([data-explicit-date])'))date.value=input.value;
  }
 }
 function click(event){
  const tab=event.target.closest('[data-flight-tab]');
  const link=event.target.closest('[data-fe-open]');
  const step=event.target.closest('[data-fe-step-date]');
  const pilot=event.target.closest('[data-fe-pilot-switch]');
  const useLast=event.target.closest('[data-fe-use-last]');
  const editAllocation=event.target.closest('[data-fe-edit-allocation]');
  const continuation=event.target.closest('[data-fe-save-mode]');
  if(tab)show(tab.dataset.flightTab);
  else if(link)show(link.dataset.feOpen,{focus:true});
  else if(step){
   const input=form.elements.namedItem('date');
   const date=new Date((input.value||input.defaultValue)+'T00:00:00Z');
   if(!Number.isFinite(date.getTime()))return;
   date.setUTCDate(date.getUTCDate()+Number(step.dataset.feStepDate));
   input.value=date.toISOString().slice(0,10);
   emitInput(input);
   input.dispatchEvent(new Event('change',{bubbles:true}));
  }else if(pilot){
   const input=form.elements.namedItem(pilot.dataset.fePilotSwitch);
   input.value=input.value==='self'?'':'self';
   emitInput(input);
  }else if(useLast?.dataset.feUseLast==='aircraft'&&lastAircraft){
   form.elements.namedItem('reg').value=lastAircraft.reg;
   form.elements.namedItem('aircraft').value=lastAircraft.aircraft;
   emitInput(form);
  }else if(useLast?.dataset.feUseLast==='crew'&&lastCrew){
   form._crewEntry.apply(lastCrew);
   emitInput(form);
  }else if(editAllocation){
   const input=form.elements.namedItem(editAllocation.dataset.feEditAllocation);
   const details=input?.closest('details');
   if(details)details.open=true;
   input?.focus();
  }else if(continuation){
   form._saveMode=continuation.dataset.feSaveMode;
   try{form.requestSubmit(save);}finally{delete form._saveMode;}
  }else if(event.target.closest('[data-night-recalculate]')){
   updateFlightEditor(form,{recalculate:true});
   emitInput(form);
  }
 }
 const keydown=event=>{const tab=event.target.closest('[data-flight-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let i=tabs.indexOf(tab);if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else i=(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;show(tabs[i].dataset.flightTab,{focus:true});};
 const invalid=event=>{const input=form.querySelector('input:invalid,select:invalid,textarea:invalid')||event.target,panel=input.closest('[data-flight-panel]');if(panel)show(panel.dataset.flightPanel,{restore:false});let parent=input.parentElement;while(parent&&parent!==form){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}};
 // Field values remain in the same form for native FormData and the existing saveFlight().
 modal.addEventListener('click',click);modal.addEventListener('keydown',keydown);form.addEventListener('invalid',invalid,true);
 form.addEventListener('input',updateDates);form.addEventListener('change',updateDates);
 show('log');
 for(const input of form.querySelectorAll('input[name^="log_takeoff"],input[name^="log_landing"]')){
  const field=input.closest('label');
  const labelText=field.querySelector('span').textContent;
  input.setAttribute('aria-label',labelText);
  const wrapper=document.createElement('span');wrapper.className='nv-counter';input.placeholder='—';input.before(wrapper);
  const value=document.createElement('span');value.className='fe-count-value';
  const period=document.createElement('span');period.textContent=input.name.endsWith('Night')?'night':'day';period.setAttribute('aria-hidden','true');
  value.append(input,period);wrapper.append(value);
  for(const [delta,label]of [[-1,'Giảm'],[1,'Tăng']]){
   const button=document.createElement('button');button.type='button';button.innerHTML=icon(delta<0?'left':'chevron');button.setAttribute('aria-label',label+' '+labelText);
   button.disabled=input.disabled;button.onclick=()=>{if(!input.validity.valid&&input.value!=='')return;input.value=String(Math.max(0,Math.min(20,Number(input.value||0)+delta)));input.dispatchEvent(new Event('input',{bubbles:true}));};
   if(delta<0)wrapper.prepend(button);else wrapper.append(button);
  }
 }
 const countFields=['takeoffDay','landingDay','takeoffNight','landingNight'].map(key=>form.elements.namedItem('log_'+key)?.closest('label'));
 if(countFields.every(Boolean)){
  const card=document.createElement('section');card.className='fe-card nv-count-card';card.setAttribute('aria-label','Takeoffs và Landings');card.innerHTML=`<div class="nv-count-heading"><h3>${movementIcon()} Takeoffs</h3><h3>${movementIcon(true)} Landings</h3></div><div class="fe-grid fe-v14-fields nv-count-grid"></div>`;
  countFields.forEach((field,index)=>{field.classList.add('nv-count-field');field.dataset.countPeriod=index<2?'day':'night';field.dataset.countOperation=index%2?'landing':'takeoff';field.firstElementChild.hidden=true;});
  card.querySelector('.nv-count-grid').append(...countFields);form.querySelector('[data-fe-counter-slot]').replaceWith(card);
 }
 function setSaveState(state){
  const disabled=state==='saving'||[...form.elements].some(input=>input.willValidate&&!input.validity.valid);
  for(const button of modal.querySelectorAll('.fe-action-save')){
   button.disabled=disabled;
   button.setAttribute('aria-busy',String(state==='saving'));
  }
  save.textContent=({saving:'Đang lưu…',saved:'Đã lưu',error:'Thử lưu lại'})[state]||'Save';
 }
 return{show,setSaveState,dispose(){
  for(const layout of [wide,mobile])layout.removeEventListener('change',syncLayout);
  modal.removeEventListener('click',click);modal.removeEventListener('keydown',keydown);
  form.removeEventListener('invalid',invalid,true);form.removeEventListener('input',updateDates);form.removeEventListener('change',updateDates);
  modal.classList.remove('flight-editor-modal','fe-new-flight-modal');modal.removeAttribute('aria-labelledby');
 }};
}
