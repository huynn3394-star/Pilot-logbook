/** Read-only iPad flight preview. It never alters, persists or normalizes a flight. */
import {timeTotals} from '../lib/flight-times.js';
import {duration,clock} from '../lib/domain.js';
import {icaoFor} from '../lib/parsers.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':duration(n);
export function renderTabletFlightPreview(f,people=[]){
 if(!f)return '<div class="nv21-tablet-empty"><span aria-hidden="true">✈</span><h3>Chọn chuyến bay</h3><p>Chọn “Xem chi tiết” từ danh sách bên trái để xem tại đây.</p></div>';
 const t=timeTotals(f),actual=Object.values(f.actual||{}).some(Boolean),times=actual?f.actual:(f.scheduled||{});
 const timesList=[['OUT',times.out],['OFF',times.off],['ON',times.on],['IN',times.in]];
 const fields=[['FLIGHT',t.airborne],['PIC',t.pic],['SIC',t.sic],['IFR',t.ifr],['VFR',t.vfr],['DAY',t.day],['NIGHT',t.night],['INSTRUMENT',t.instrument]];
 const name=id=>people.find(p=>p.id===id)?.name||(id?'Đã lưu trong Crew Book':'—');
 const crew=[['CAPTAIN',f.captainId],['FIRST OFFICER',f.foId]];
 const takeoff=f.logbook?.takeoffDay,landing=f.logbook?.landingDay;
 const takeoffNight=f.logbook?.takeoffNight,landingNight=f.logbook?.landingNight;
 return `<div class="nv21-preview-title"><div><span class="nv21-preview-eyebrow">FLIGHT DETAILS · UTC</span><h3>${esc(f.flightNo||'Flight')} <small>${esc(f.date)}</small></h3></div><span class="nv21-preview-state">${f.confirmed?'✓ FINAL':actual?'DRAFT':'SCHEDULED'}</span></div>
 <div class="nv21-preview-route"><div><strong>${esc(f.dep||'—')}</strong><small>${esc(icaoFor(f.dep)||'—')}</small></div><span aria-hidden="true">✈</span><div><strong>${esc(f.dest||'—')}</strong><small>${esc(icaoFor(f.dest)||'—')}</small></div></div>
 <div class="nv21-preview-aircraft">${esc(f.reg||'Registration —')} · ${esc(f.aircraft||'Aircraft —')} · ${esc(f.role||'—')}</div>
 <section class="nv21-preview-section" aria-label="Flight and crew"><h4>FLIGHT INFORMATION</h4><div class="nv21-preview-keyvalues"><div><span>FLIGHT NO.</span><strong>${esc(f.flightNo||'—')}</strong></div><div><span>DATE · UTC</span><strong>${esc(f.date||'—')}</strong></div><div><span>AIRCRAFT</span><strong>${esc(f.aircraft||'—')}</strong></div><div><span>REGISTRATION</span><strong>${esc(f.reg||'—')}</strong></div></div></section>
 <section class="nv21-preview-section" aria-label="Crew"><h4>CREW</h4><div class="nv21-preview-keyvalues">${crew.map(([label,id])=>`<div><span>${label}</span><strong>${esc(name(id))}</strong></div>`).join('')}</div></section>
 <section class="nv21-preview-section" aria-label="Times"><h4>${actual?'ACTUAL TIMES':'SCHEDULED TIMES'} · UTC</h4>
 <div class="nv21-preview-times">${timesList.map(([label,v])=>`<div><span>${label} · UTC</span><strong>${esc(clock(v))}</strong></div>`).join('')}</div></section>
 <div class="nv21-preview-total"><span>BLOCK TIME</span><strong>${fmt(t.block)}</strong><small>OUT → IN · UTC</small></div>
 <section class="nv21-preview-section" aria-label="Flight allocation"><h4>FLIGHT ALLOCATION</h4><div class="nv21-preview-grid">${fields.map(([label,value])=>`<div><span>${label}</span><strong>${fmt(value)}</strong></div>`).join('')}</div></section>
 <section class="nv21-preview-section" aria-label="Takeoffs and landings"><h4>TAKEOFFS / LANDINGS</h4><div class="nv21-preview-keyvalues"><div><span>TAKEOFF DAY / NIGHT</span><strong>${esc(takeoff??'—')} / ${esc(takeoffNight??'—')}</strong></div><div><span>LANDING DAY / NIGHT</span><strong>${esc(landing??'—')} / ${esc(landingNight??'—')}</strong></div><div><span>LANDING MODE</span><strong>${esc(f.landingMode||'—')}</strong></div><div><span>ROLE</span><strong>${esc(f.role||'—')}</strong></div></div></section>
 ${f.note?`<section class="nv21-preview-section"><h4>REMARKS</h4><p class="nv21-preview-remarks">${esc(f.note)}</p></section>`:''}
 <button type="button" class="btn primary nv21-preview-edit" data-action="edit" data-id="${esc(f.id)}">Sửa chuyến bay</button>
 <p class="nv21-preview-footnote">Chỉ xem. Mọi chỉnh sửa sử dụng Flight Editor hiện tại.</p>`;
}
