/** Read-only iPad flight preview. It never alters, persists or normalizes a flight. */
import {timeTotals} from '../lib/flight-times.js';
import {duration,clock} from '../lib/domain.js';
import {icaoFor} from '../lib/parsers.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n===null||n===undefined?'—':duration(n);
export function renderTabletFlightPreview(f){
 if(!f)return '<div class="nv21-tablet-empty"><span aria-hidden="true">✈</span><h3>Chọn chuyến bay</h3><p>Chọn “Xem chi tiết” từ danh sách bên trái để xem tại đây.</p></div>';
 const t=timeTotals(f),actual=Boolean(f.actual?.out||f.actual?.in),times=actual?f.actual:(f.scheduled||{});
 const timesList=[['OUT',times.out],['OFF',times.off],['ON',times.on],['IN',times.in]];
 const fields=[['FLIGHT',t.airborne],['PIC',t.pic],['SIC',t.sic],['IFR',t.ifr],['VFR',t.vfr],['DAY',t.day],['NIGHT',t.night],['INSTRUMENT',t.instrument]];
 return `<div class="nv21-preview-title"><div><span class="nv21-preview-eyebrow">FLIGHT DETAILS · UTC</span><h3>${esc(f.flightNo||'Flight')} <small>${esc(f.date)}</small></h3></div><span class="nv21-preview-state">${f.confirmed?'✓ FINAL':actual?'DRAFT':'SCHEDULED'}</span></div>
 <div class="nv21-preview-route"><div><strong>${esc(f.dep||'—')}</strong><small>${esc(icaoFor(f.dep)||'—')}</small></div><span aria-hidden="true">✈</span><div><strong>${esc(f.dest||'—')}</strong><small>${esc(icaoFor(f.dest)||'—')}</small></div></div>
 <div class="nv21-preview-aircraft">${esc(f.reg||'Registration —')} · ${esc(f.aircraft||'Aircraft —')} · ${esc(f.role||'—')}</div>
 <div class="nv21-preview-times">${timesList.map(([label,v])=>`<div><span>${label} · UTC</span><strong>${esc(clock(v))}</strong></div>`).join('')}</div>
 <div class="nv21-preview-total"><span>BLOCK TIME</span><strong>${fmt(t.block)}</strong><small>OUT → IN · UTC</small></div>
 <div class="nv21-preview-grid">${fields.map(([label,value])=>`<div><span>${label}</span><strong>${fmt(value)}</strong></div>`).join('')}</div>
 <button type="button" class="btn primary nv21-preview-edit" data-action="edit" data-id="${esc(f.id)}">Sửa chuyến bay</button>
 <p class="nv21-preview-footnote">Chỉ xem. Mọi chỉnh sửa sử dụng Flight Editor hiện tại.</p>`;
}
