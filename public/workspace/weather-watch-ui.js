import {normalizeAirports} from './weather-watch.js';
import {savedReportTiming} from './weather-report.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const utc=value=>value?value.replace('T',' ').replace(/\.\d{3}Z$/,' UTC').replace(/Z$/,' UTC'):'—';
export function mountWeatherWatch({element,watch,getAirports,onAirports,isCurrent=()=>true,onError=()=>{}}){
 let disposed=false,busy=false;
 element.innerHTML='<section class="panel weather-watch-tools"><form id="weather-watch-form"><label>Thêm sân bay (ICAO hoặc IATA)<input name="airport" maxlength="4" autocomplete="off" placeholder="VVTS / SGN" required></label><button class="btn primary" type="submit">Thêm sân bay</button></form><button class="btn" type="button" data-watch-refresh>Cập nhật tất cả</button><p data-weather-watch-status role="status"></p></section><div class="weather-watch-grid" data-weather-cards></div>';
 const form=element.querySelector('form'),input=form.querySelector('input'),cards=element.querySelector('[data-weather-cards]'),status=element.querySelector('[data-weather-watch-status]'),refreshButton=element.querySelector('[data-watch-refresh]');
 function paint(data){if(disposed||!isCurrent())return;
  const offline=navigator.onLine===false;status.textContent=(offline?'Offline · xem bản tin chữ đã lưu. ':data.loading.length?'Đang cập nhật '+data.loading.length+' sân bay… ':'Đang xem bản tin chữ đã lưu. Tự cập nhật mỗi 5 phút khi có mạng và mở mục này. ')+(data.cacheError||'Luôn kiểm tra giờ phát hành và thời hạn bản tin.');refreshButton.disabled=offline||data.loading.length>0;
  cards.innerHTML=data.airports.length?data.airports.map(station=>{const r=data.reports[station],age=r?Date.now()-Date.parse(r.fetchedAt):0;
   const product=name=>{const raw=r?.[name],t=raw&&savedReportTiming(r,name),expired=t?.validTo&&Date.parse(t.validTo)<Date.now(),old=t&&name==='metar'&&Date.now()-Date.parse(t.issuedAt)>7200000;
    return '<section class="weather-product"><h3>'+name.toUpperCase()+'</h3>'+(t?'<p class="tiny muted">Phát hành '+esc(utc(t.issuedAt))+(t.validTo?' · Hiệu lực '+esc(utc(t.validFrom))+' → '+esc(utc(t.validTo)):'')+(r?.staleProducts?.[name]?' · CHƯA CẬP NHẬT ĐƯỢC · GIỮ BẢN CŨ':'')+(expired?' · HẾT HIỆU LỰC':old?' · BẢN TIN CŨ':'')+(t.cancelled?' · BẢN TIN HỦY':'')+'</p>':'')+'<pre class="weather-report">'+esc(raw||'Chưa có bản tin hiện hành.')+'</pre>'+(r?.sources?.[name]?'<a class="text-button" target="_blank" rel="noopener" href="'+esc(r.sources[name])+'">Nguồn '+name.toUpperCase()+'</a>':'')+'</section>';};
   return '<article class="panel weather-watch-card" data-weather-station="'+station+'"><div class="weather-watch-top"><h2>'+station+'</h2><button class="btn small ghost" type="button" data-watch-remove="'+station+'" aria-label="Bỏ theo dõi '+station+'">Bỏ theo dõi</button></div><p class="tiny muted">'+esc(r?r.provider+' · Lấy lúc '+utc(r.fetchedAt):'Chưa có bản tin đã lưu.')+(offline||age>300000||r?.stale?' · BẢN LƯU TRÊN MÁY':'')+'</p>'+(data.errors[station]?'<p class="weather-error" role="status">'+esc(data.errors[station])+' Bản đã lưu được giữ lại.</p>':'')+product('metar')+product('taf')+'</article>';
  }).join(''):'<section class="panel weather-watch-card"><p>Thêm sân bay bạn muốn theo dõi. Danh sách được lưu riêng theo tài khoản; chế độ khách lưu trên máy.</p></section>';
 }
 async function change(list){if(busy||disposed)return;busy=true;try{await onAirports(list);if(disposed||!isCurrent())return;watch.setAirports(list);input.value='';await watch.refresh();}catch(error){if(!disposed)onError(error.message);}finally{busy=false;}}
 const submit=event=>{event.preventDefault();try{change(normalizeAirports([...getAirports(),input.value]));}catch(error){onError(error.message);}};
 const click=event=>{const button=event.target.closest('[data-watch-remove]');if(button)change(getAirports().filter(s=>s!==button.dataset.watchRemove));};
 const refresh=()=>watch.refresh({force:true});form.addEventListener('submit',submit);cards.addEventListener('click',click);refreshButton.addEventListener('click',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
 const unsubscribe=watch.subscribe(paint),timer=setInterval(()=>{if(!document.hidden)watch.refresh();},300000);
 watch.ready.then(()=>{if(!disposed)watch.refresh();});
 return{dispose(){disposed=true;clearInterval(timer);unsubscribe();form.removeEventListener('submit',submit);cards.removeEventListener('click',click);refreshButton.removeEventListener('click',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);}};
}
