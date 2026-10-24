/** V14 editor components: no persistence, no API calls. */
import {lookupFlights,scanComparison} from './flight-assist.js';
import {logbookMinuteFields,logbookCountFields} from './flight-times.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={sicMinutes:'SIC · phút',picusMinutes:'PICUS · phút',ifrMinutes:'IFR · phút',vfrMinutes:'VFR · phút',instrumentMinutes:'Actual instrument · phút',crossCountryMinutes:'Cross-country · phút',takeoffDay:'Takeoff ngày · số lần',takeoffNight:'Takeoff đêm · số lần',landingDay:'Landing ngày · số lần',landingNight:'Landing đêm · số lần'};
export function renderTimeFields(f,{enabled=true}={}){
 if(!enabled&&!f.logbook)return '';
 const fields=[...logbookMinuteFields,...logbookCountFields].map(k=>`<label class="fe-field"><span>${labels[k]}</span><input type="number" name="log_${k}" value="${esc(f.logbook?.[k]??'')}" min="0" max="${logbookCountFields.includes(k)?20:1440}" step="1" inputmode="numeric" placeholder="Chưa ghi"${enabled?'':' disabled'}></label>`).join('');
 return `<details class="fe-card fe-extra-times" data-v14-times><summary><span>Phân bổ giờ & số lần của tôi</span><span aria-hidden="true">⌄</span></summary><div class="fe-grid fe-v14-fields">${fields}</div><p class="fe-help fe-inset">Để trống = chưa ghi; 0 = đã xác nhận bằng 0. Không tự suy PIC/SIC từ PF/PM, Instrument từ IFR hoặc ngày/đêm từ giờ trên đồng hồ. Các nhóm giờ khác nhau không cộng dồn với nhau.</p></details>`;
}
const scanLabels={dep:'DEP',dest:'DEST','actual.out':'OUT','actual.off':'OFF','actual.on':'ON','actual.in':'IN'};
function display(value){if(value===null||value===undefined||value==='')return '—';if(typeof value==='object')return JSON.stringify(value,null,2);return String(value);}
export function renderScanComparison(previous,scan){
 if(!scan)return '';
 const rows=scanComparison(previous,scan);
 return `<section class="fe-card fe-scan-review" data-scan-comparison><div class="fe-card-heading"><h3>Đối chiếu ảnh cuối chuyến</h3><span>UTC</span></div><div class="fe-comparison-head"><span>Trường</span><span>Đang lưu</span><span>Đọc từ ảnh</span></div>${rows.map(r=>`<div class="fe-comparison-row" data-scan-state="${r.state}"><strong>${scanLabels[r.key]}<small>${{same:'Khớp',different:'Khác',missing:'Chưa đọc',new:'Mới'}[r.state]}</small></strong><span>${esc(display(r.before))}</span><span>${esc(display(r.after))}</span></div>`).join('')}<p class="fe-help fe-inset">Trường ảnh chưa đọc được vẫn giữ giá trị cũ nếu có; không coi đó là dữ liệu đã đọc từ ảnh. Sửa các ô bên dưới và kiểm tra cả ngày UTC.</p><label class="check fe-scan-check"><input type="checkbox" name="scanReviewed"><span>Tôi đã đối chiếu ảnh và các trường giữ lại<small>Cần chọn trước khi chốt FINAL. Scan không tự lưu.</small></span></label></section>`;
}
const auditLabels={date:'Ngày UTC',flightNo:'Số hiệu',actual:'Actual UTC',confirmed:'FINAL',dep:'DEP',dest:'DEST',aircraft:'Loại tàu bay',reg:'Registration',role:'PF/PM',picMinutes:'PIC phút',nightMinutes:'Night phút',takeoffBy:'Takeoff by',landingBy:'Landing by',landingMode:'Landing mode',captainId:'Captain ID',foId:'FO ID',crewIds:'Crew IDs',source:'Nguồn',logbook:'Phân bổ giờ',note:'Ghi chú',confidence:'Độ tin cậy',evidenceHash:'SHA-256 ảnh'};
export function renderAuditTrail(f){
 const entries=f.auditTrail?.entries||[];
 return `<details class="fe-card fe-audit" data-audit-trail><summary><span>Lịch sử chỉnh sửa</span><span>${entries.length} lượt</span></summary><p class="fe-help fe-inset">Lịch sử bắt đầu từ lần xác nhận/chỉnh sửa trên V14. Thời điểm theo đồng hồ thiết bị, không phải chữ ký chứng thực. Lưu dấu ảnh SHA-256; backup đầy đủ ảnh chỉ giữ ảnh hiện tại.</p>${entries.length?[...entries].reverse().map(entry=>`<details class="fe-audit-entry"><summary>${esc(entry.at)}<span>${{confirmed:'Xác nhận FINAL','revised-final':'Sửa FINAL',reopened:'Mở lại nháp',edited:'Chỉnh sửa'}[entry.action]||esc(entry.action)}</span></summary>${entry.reason?`<p>Lý do: ${esc(entry.reason)}</p>`:''}${[...new Set([...Object.keys(entry.before),...Object.keys(entry.after)])].map(k=>`<div class="fe-audit-change"><strong>${esc(auditLabels[k]||k)}</strong><div><span>Trước</span><pre>${esc(display(entry.before[k]))}</pre></div><div><span>Sau</span><pre>${esc(display(entry.after[k]))}</pre></div></div>`).join('')}</details>`).join(''):'<p class="fe-help fe-inset">Chưa có lượt chỉnh sửa được ghi nhận trên V14.</p>'}</details>`;
}
export function mountFlightAssist(form,{flights,onOpen}){
 const host=form.querySelector('[data-flight-autofill]');if(!host||form._original||form._imported)return {dispose(){}};
 let otherDirty=false,last='',result=null,disposed=false;
 const mark=event=>{if(event.target===form||event.target.name&&!['flightNo','date'].includes(event.target.name))otherDirty=true;};
 const query=()=>{
  if(disposed||!form.isConnected)return;
  const input=form.elements.namedItem('flightNo'),date=form.elements.namedItem('date'),key=input.value+'|'+date.value;
  if(key===last)return;last=key;
  result=lookupFlights(flights,{flightNo:input.value,date:date.value});host.replaceChildren();
  if(result.kind==='none'){if(input.value.trim())host.textContent='Chưa có chuyến phù hợp trong dữ liệu riêng. Tiếp tục nhập thủ công.';return;}
  if(result.kind==='same-day'&&!otherDirty){onOpen(result.matches[0]);return;}
  const message=document.createElement('p');message.textContent=result.kind==='history'?'Hành trình từ lịch sử — chỉ là gợi ý, cần kiểm tra chuyến hôm nay.':'Có chuyến cùng ngày. Mở bản ghi để ghi Actual, không tạo trùng.';host.append(message);
  (result.kind==='history'?result.routes:result.matches).forEach((candidate,index)=>{
   const button=document.createElement('button');button.type='button';button.className='btn small';button.dataset.assistIndex=String(index);
   button.textContent=result.kind==='history'?`${candidate.dep} → ${candidate.dest} · ${candidate.date}`:`Mở ${candidate.flightNo} · ${candidate.dep} → ${candidate.dest}${candidate.reg?' · '+candidate.reg:''}`;host.append(button);
  });
 };
 const changed=event=>{if(['flightNo','date'].includes(event.target.name))query();};
 const click=event=>{const button=event.target.closest('[data-assist-index]');if(!button||!host.contains(button)||!result)return;const index=Number(button.dataset.assistIndex);
  if(result.kind==='history'){
   const candidate=result.routes[index];if(!candidate)return;
   for(const k of ['dep','dest']){const current=form.elements.namedItem(k),scheduled=form.elements.namedItem('s_'+k),old=current.value;current.value=candidate[k];if(scheduled&&(!scheduled.value||scheduled.value===old))scheduled.value=candidate[k];current.dispatchEvent(new Event('input',{bubbles:true}));}
   host.textContent=`Đã dùng gợi ý ${candidate.dep} → ${candidate.dest} từ ${candidate.date}. Không lấy registration/Actual của chuyến cũ.`;
  }else if(result.matches[index]){
   // Opening another record discards this unsaved form only with an explicit click.
   if(otherDirty&&!confirm('Mở chuyến đã có sẽ bỏ nội dung chưa lưu của biểu mẫu này. Tiếp tục?'))return;
   onOpen(result.matches[index]);
  }
 };
 form.addEventListener('input',mark);form.addEventListener('change',changed);form.addEventListener('focusout',changed);host.addEventListener('click',click);
 return {dispose(){disposed=true;form.removeEventListener('input',mark);form.removeEventListener('change',changed);form.removeEventListener('focusout',changed);host.removeEventListener('click',click);}};
}
