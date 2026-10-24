/** Compact flight editor. Optional V14 metadata is guarded by the account capability flag.
 * Tabs only hide DOM panels: changing tabs never rebuilds inputs or drops a draft.
 */
import {minutes,duration} from './domain.js';
import {flightTimeInput,readUTCInput} from './utc-input.js';
import {icaoFor} from './parsers.js';
import {readLogbookFields,timeTotals} from './flight-times.js';
import {renderTimeFields,renderScanComparison,renderAuditTrail} from './flight-v14-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const field=(name,label,value='',type='text',attrs='')=>`<label class="fe-field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const choice=(name,label,value,options)=>`<label class="fe-field"><span>${esc(label)}</span><select name="${name}">${options.map(([key,text])=>`<option value="${esc(key)}"${key===value?' selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
const performerOptions=[['','Chưa ghi'],['self','Tôi'],['captain','Captain'],['fo','First Officer'],['other','Crew khác']];
const safePhoto=value=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value||'')?value:'';

// Same minute arithmetic as AviLog; incomplete/invalid inputs are not shown as zero.
export function flightEditorSummary(actual={},picMinutes=0,nightMinutes=0){
 const span=(a,b)=>{if(!actual[a]||!actual[b])return null;const n=minutes(actual[a],actual[b]);return Number.isFinite(n)&&n>=0&&n<=1440?n:null;};
 const block=span('out','in');let airborne=span('off','on');
 if(airborne!==null&&((actual.out&&Date.parse(actual.off)<Date.parse(actual.out))||(actual.in&&Date.parse(actual.on)>Date.parse(actual.in))))airborne=null;
 const allocation=value=>block!==null&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=block?Number(value):null;
 const pic=allocation(picMinutes),night=allocation(nightMinutes);
 return{block,airborne,pic,sic:pic===null?null:block-pic,day:night===null?null:block-night,night};
}

export function renderFlightEditor(f,{original=null,imported=null,warning='',icon=()=>'',scan=null,v14Enabled=true}={}){
 const actual=f.actual||{},scheduled=f.scheduled||{},photo=safePhoto(imported?.attachment||original?.attachment);
 const time=(name,label,value)=>`<div class="fe-time-cell">${flightTimeInput(name,label,value)}</div>`;
 const typeOptions=[['','Chưa ghi'],...['A320','A321','E190','B787','A350'].map(value=>[value,value]),['OTHER','Khác']];
 const confirmed=f.confirmed?'FINAL · Đã xác nhận':'DRAFT · Chưa xác nhận';
 return `<form id="flight-form" data-id="${esc(f.id)}" class="flight-editor-form" data-v14-enabled="${v14Enabled}">
  <nav class="fe-tabs" role="tablist" aria-label="Chi tiết chuyến bay">
   ${[['log','book','Log'],['airports','pin','Airports'],['tools','settings','Tools']].map(([key,ico,label],index)=>`<button type="button" role="tab" data-flight-tab="${key}" id="fe-tab-${key}" aria-controls="fe-panel-${key}" aria-selected="${!index}" tabindex="${index?-1:0}">${icon(ico)}<span>${label}</span></button>`).join('')}
  </nav>
  <div class="modal-body fe-body">
   <div class="error fe-error" data-error role="alert" tabindex="-1" hidden></div>
   <section role="tabpanel" data-flight-panel="log" id="fe-panel-log" aria-labelledby="fe-tab-log">
    <div class="fe-status-row"><span class="fe-eyebrow">FLIGHT RECORD</span><span class="fe-status" data-fe-status>${confirmed}</span></div>
    ${warning?`<div class="fe-notice fe-review-notice" data-ocr-review role="note">${icon('camera')}<div><strong>Kiểm tra kết quả Smart Scan</strong><p>${esc(warning)}</p></div></div>`:''}
    ${imported?'<p class="fe-help">Đã đọc từ ảnh, chưa tự lưu. Kiểm tra hành trình, từng giờ và ngày UTC trước khi xác nhận.</p>':''}
    ${!v14Enabled?'<div class="fe-notice" data-v14-gate>Chế độ tương thích V13. Giờ bổ sung và lịch sử V14 cần chủ app cập nhật Firebase rules rồi bật V14. Dữ liệu hiện có không bị xóa.</div>':''}
    ${renderScanComparison(original,scan)}
    <section class="fe-card fe-overview" aria-label="Thông tin chuyến bay">
     <div class="fe-grid fe-main-fields">
      ${field('flightNo','Flight number',f.flightNo,'text','required maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false"')}
      ${field('date','Ngày bay · UTC',f.date,'date','required')}
     </div>
     <div class="fe-autofill" data-flight-autofill role="status" aria-live="polite"></div>
     <div class="fe-grid fe-aircraft-fields">
      ${field('reg','Registration',f.reg||'','text','maxlength="20" autocapitalize="characters" spellcheck="false" placeholder="VN-…"')}
      ${choice('aircraft','Aircraft type',f.aircraft||'',typeOptions)}
     </div>
     <details class="fe-crew-details" data-fe-crew-details>
      <summary><span>${icon('people')} Crew</span><span class="fe-trailing">Captain / FO <span aria-hidden="true">⌄</span></span></summary>
      <div class="fe-crew-content"><div class="fe-grid"><div class="crew-entry" data-crew-field="captain"></div><div class="crew-entry" data-crew-field="fo"></div></div><div class="crew-entry" data-crew-field="crew"></div></div>
     </details>
    </section>
    <section class="fe-card fe-route-card" aria-label="Hành trình và giờ thực tế">
     <div class="fe-grid fe-route-inputs">
      ${field('dep','DEP · IATA / ICAO',f.dep,'text','required maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false"')}
      ${field('dest','DEST · IATA / ICAO',f.dest,'text','required maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false"')}
     </div>
     <div class="fe-time-caption"><span>${icon('clock')} Actual times</span><span>UTC · 24H</span></div>
     <div class="fe-grid fe-actual-grid">
      ${time('a_out','OUT · Off blocks',actual.out)}${time('a_on','ON · Landing',actual.on)}
      ${time('a_off','OFF · Takeoff',actual.off)}${time('a_in','IN · On blocks',actual.in)}
     </div>
     <div class="fe-route-foot">${icon('info')} Mỗi mốc có ngày UTC riêng. Chỉnh ngày khi bay qua nửa đêm.</div>
    </section>
    <details class="fe-card fe-scheduled" data-fe-scheduled${!Object.values(actual).some(Boolean)?' open':''}>
     <summary><span>${icon('calendar')} Scheduled · Giờ dự kiến</span><span aria-hidden="true">⌄</span></summary>
     <div class="fe-grid fe-scheduled-grid">${time('s_out','Scheduled OUT',scheduled.out)}${time('s_in','Scheduled IN',scheduled.in)}</div>
     <p class="fe-help fe-inset">Hành trình dự kiến ở tab Airports. Scheduled không thay đổi Actual.</p>
    </details>
    <section class="fe-card" aria-label="Vai trò và thao tác">
     <div class="fe-grid fe-operations">${choice('takeoffBy','Takeoff by',f.takeoffBy||'',performerOptions)}${choice('landingBy','Landing by',f.landingBy||'',performerOptions)}</div>
     <div class="fe-grid fe-operations">${choice('role','Pilot role',f.role,[['PF','PF · Pilot Flying'],['PM','PM · Pilot Monitoring']])}${choice('landingMode','Landing mode',f.landingMode||'manual',[['manual','Manual'],['autoland','Autoland']])}</div>
     <div class="fe-grid fe-allocations">${field('picMinutes','PIC · phút',f.picMinutes||0,'number','min="0" max="1440" step="1"')}${field('nightMinutes','Night · phút',f.nightMinutes||0,'number','min="0" max="1440" step="1"')}</div>
     <p class="fe-help fe-inset">PIC và Night nhập thủ công; PF/PM không tự quyết định PIC/SIC.</p>
    </section>
    ${renderTimeFields(f,{enabled:v14Enabled})}
    <section class="fe-card fe-remarks"><label class="fe-field"><span>Remarks · Ghi chú</span><textarea name="note" rows="2" maxlength="3000" placeholder="Ghi chú cho chuyến bay…">${esc(f.note||'')}</textarea></label></section>
    <section class="fe-card fe-summary-card" aria-label="Tổng thời gian chuyến bay">
     <div class="fe-card-heading"><h3>${icon('clock')} Flight Times</h3><span data-fe-summary-state>Từ biểu mẫu</span></div>
     <div id="actual-summary" class="fe-time-summary" aria-live="polite"></div>
    </section>
    <button type="button" class="fe-review-button" data-fe-open="tools">${icon('shield')}<span>Nguồn, ảnh & xác nhận Actual<small>Kiểm tra trước khi lưu chuyến bay</small></span>${icon('chevron')}</button>
   </section>
   <section role="tabpanel" data-flight-panel="airports" id="fe-panel-airports" aria-labelledby="fe-tab-airports" hidden>
    <div class="fe-section-heading"><span class="fe-eyebrow">ROUTE</span><h3>Sân bay của chuyến bay</h3><p>Thông tin hành trình từ biểu mẫu, không phải dữ liệu tra cứu trực tuyến.</p></div>
    <section class="fe-card"><div class="fe-grid fe-airport-pair"><div><span>DEPARTURE</span><strong data-fe-airport="dep">${esc(f.dep||'—')}</strong><small data-fe-icao="dep">${esc(f.dep?icaoFor(f.dep):'—')}</small></div><div><span>DESTINATION</span><strong data-fe-airport="dest">${esc(f.dest||'—')}</strong><small data-fe-icao="dest">${esc(f.dest?icaoFor(f.dest):'—')}</small></div></div><button type="button" class="fe-inline-button" data-fe-open="log">Sửa DEP / DEST trong Log ${icon('arrow')}</button></section>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('calendar')} Hành trình dự kiến</h3></div><div class="fe-grid fe-scheduled-route">${field('s_dep','Scheduled DEP',scheduled.dep||f.dep,'text','maxlength="4" autocapitalize="characters" spellcheck="false"')}${field('s_dest','Scheduled DEST',scheduled.dest||f.dest,'text','maxlength="4" autocapitalize="characters" spellcheck="false"')}</div><p class="fe-help fe-inset">Giữ riêng hành trình Scheduled khi chuyến bay thay đổi hoặc chuyển hướng.</p></section>
    <div class="fe-notice">${icon('info')}<div><strong>Chưa có trường procedure riêng</strong><p>Runway, SID/STAR, approach và threats chưa được lưu riêng trong phiên bản này. Có thể ghi tại Remarks; không tự tạo dữ liệu từ ảnh minh họa.</p></div></div>
   </section>
   <section role="tabpanel" data-flight-panel="tools" id="fe-panel-tools" aria-labelledby="fe-tab-tools" hidden>
    <div class="fe-section-heading"><span class="fe-eyebrow">REVIEW & SAVE</span><h3>Nguồn & xác nhận</h3><p>Thông tin được lưu theo chuyến bay. Kết quả scan cần bạn kiểm tra trước khi chốt Actual.</p></div>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('file')} Source</h3></div><div class="fe-source-fields">${field('source','Nguồn',f.source||'manual','text','maxlength="120"')}${field('confidence','Độ tin cậy nhận dạng (%)',f.confidence??100,'number','min="0" max="100"')}</div><p class="fe-help fe-inset">Độ tin cậy là thông tin nhận dạng, không phải chứng nhận độ chính xác.</p></section>
    <section class="fe-card"><div class="fe-card-heading"><h3>${icon('camera')} Files / Photos</h3><span>Ảnh gốc</span></div><div class="fe-evidence" data-flight-evidence><label class="fe-file-label"><span>Thêm / thay ảnh minh chứng</span><input type="file" name="evidence" accept="image/jpeg,image/png,image/webp"><small>JPG / PNG / WebP · tối đa 6 MB</small></label>${photo?`<img class="image-preview" src="${photo}" alt="Ảnh minh chứng chuyến bay"><label class="check"><input type="checkbox" name="removeAttachment">Bỏ ảnh khỏi chuyến này</label>`:''}</div><p class="fe-help fe-inset">Đính kèm ảnh ở đây không chạy OCR. Để đọc giờ từ ảnh, dùng Nhập từ ảnh trong Logbook.</p></section>
    <section class="fe-card fe-confirm-card"><div class="fe-card-heading"><h3>${icon('shield')} Xác nhận Actual</h3></div><div class="fe-confirm-content">${original?.confirmed?'<div class="fe-protected">Actual đã xác nhận đang được bảo vệ. Thay đổi giờ hoặc thông tin khai thác cần cho phép rõ ràng.</div>':''}<label class="check"><input type="checkbox" name="confirmed"${f.confirmed?' checked':''}><span>Tôi đã kiểm tra và xác nhận Actual<small>Cần đủ OUT / OFF / ON / IN và đúng ngày UTC.</small></span></label>${original?.confirmed?'<label class="check fe-replace"><input type="checkbox" name="replaceConfirmed"><span>Cho phép thay đổi Actual đã xác nhận<small>Chỉ chọn sau khi đã đối chiếu lại thông tin.</small></span></label>':''}${original?.confirmed&&v14Enabled?field('revisionReason','Lý do sửa FINAL', '', 'text', 'maxlength="500" placeholder="Ví dụ: đối chiếu lại ảnh AOC"'):''}<p class="fe-help">Bấm Lưu ở đầu màn hình để ghi thay đổi. Chuyển tab không lưu và không tự xác nhận.</p></div></section>
    ${renderAuditTrail(f)}
    ${original?`<button type="button" class="fe-archive-button" data-action="archive-flight" data-id="${esc(original.id)}">Bỏ chuyến vào thùng rác</button>`:''}
   </section>
  </div>
 </form>`;
}

export function updateFlightEditor(form){
 const data=new FormData(form);let actual={};
 try{actual=Object.fromEntries(['out','off','on','in'].map(key=>[key,readUTCInput(data,'a_'+key,form._timeValues?.actual?.[key])]));}catch{/* Invalid clocks display unknown totals until corrected. */}
 let logbook;try{logbook=readLogbookFields(data,form._timeValues?.logbook);}catch{}
 const totals=timeTotals({actual,picMinutes:Number(data.get('picMinutes')),nightMinutes:Number(data.get('nightMinutes')),logbook});
 const time=value=>value===null?'—':duration(value);
 const cell=(label,key,help)=>`<div><span>${label}${help?`<small>${help}</small>`:''}</span><strong class="mono" data-fe-total="${key}">${time(totals[key])}</strong></div>`;
 form.querySelector('#actual-summary').innerHTML=`<div class="fe-summary-grid">${cell('Flight','airborne','OFF → ON')}${cell('Block','block','OUT → IN')}${cell('PIC','pic','Nhập thủ công')}${cell('SIC','sic',totals.legacySIC?'Cũ: Block − PIC · cần kiểm tra':'Nhập thủ công')}${cell('Day','day','Block − Night')}${cell('Night','night','Nhập thủ công')}${logbook?cell('PICUS','picus','Nhập thủ công')+cell('IFR','ifr','Nhập thủ công')+cell('VFR','vfr','Nhập thủ công')+cell('Instrument','instrument','Nhập thủ công')+cell('Cross-country','crossCountry','Nhập thủ công'):''}</div><p class="fe-help fe-inset">Tạm tính từ biểu mẫu. Thống kê chỉ nhận Actual đã lưu và xác nhận.</p>`;
 const complete=['out','off','on','in'].every(key=>actual[key])&&totals.airborne!==null&&totals.block!==null;
 const requested=data.has('confirmed');
 form.querySelector('[data-fe-status]').textContent=form._original?.confirmed?'FINAL · Bản đã lưu được bảo vệ':requested&&complete?'Đã chọn xác nhận · Chưa lưu':'DRAFT · Chưa xác nhận';
 for(const key of ['dep','dest']){
  const value=String(data.get(key)||'').trim().toUpperCase();
  form.querySelector(`[data-fe-airport="${key}"]`).textContent=value||'—';
  form.querySelector(`[data-fe-icao="${key}"]`).textContent=value?icaoFor(value):'—';
 }
}

export function mountFlightEditor(modal,{title='Chi tiết chuyến bay',icon=()=>''}={}){
 const form=modal.querySelector('#flight-form'),head=modal.querySelector('.modal-head'),footer=modal.querySelector('.modal-footer');
 modal.classList.add('flight-editor-modal');
 head.innerHTML=`<button type="button" class="fe-back" data-action="close" aria-label="Đóng chi tiết chuyến bay">${icon('left')}</button><div class="fe-title"><span>AviLog</span><h2 id="flight-editor-title">${esc(title)}</h2></div><button type="submit" form="flight-form" class="fe-save" aria-label="Lưu chuyến bay">Lưu ${icon('check')}</button>`;
 modal.setAttribute('aria-labelledby','flight-editor-title');
 footer.replaceChildren();
 const tabs=[...form.querySelectorAll('[data-flight-tab]')],panels=[...form.querySelectorAll('[data-flight-panel]')];
 let selected='log';const positions=new Map();
 function show(key,{focus=false,restore=true}={}){
  if(!tabs.some(tab=>tab.dataset.flightTab===key))return;
  positions.set(selected,form.scrollTop);selected=key;
  for(const tab of tabs){const active=tab.dataset.flightTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
  for(const panel of panels)panel.hidden=panel.dataset.flightPanel!==key;
  if(restore)form.scrollTop=positions.get(key)||0;
 }
 const click=event=>{const tab=event.target.closest('[data-flight-tab]'),link=event.target.closest('[data-fe-open]');if(tab)show(tab.dataset.flightTab);else if(link)show(link.dataset.feOpen,{focus:true});};
 const keydown=event=>{const tab=event.target.closest('[data-flight-tab]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let i=tabs.indexOf(tab);if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else i=(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;show(tabs[i].dataset.flightTab,{focus:true});};
 const invalid=event=>{const input=form.querySelector('input:invalid,select:invalid,textarea:invalid')||event.target,panel=input.closest('[data-flight-panel]');if(panel)show(panel.dataset.flightPanel,{restore:false});let parent=input.parentElement;while(parent&&parent!==form){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}};
 // Field values remain in the same form for native FormData and the existing saveFlight().
 form.addEventListener('click',click);form.addEventListener('keydown',keydown);form.addEventListener('invalid',invalid,true);
 show('log');
 return{show,dispose(){form.removeEventListener('click',click);form.removeEventListener('keydown',keydown);form.removeEventListener('invalid',invalid,true);modal.classList.remove('flight-editor-modal');modal.removeAttribute('aria-labelledby');}};
}
