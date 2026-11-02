import {getAccountClient} from '../account/client.js';
const $=id=>document.getElementById(id),number=n=>Number(n||0).toLocaleString('vi-VN'),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={weather:'Thời tiết',schedule:'Lịch bay',logbook:'Logbook',atpl:'Ôn thi ATPL',crew:'Crew Book',statistics:'Statistics',settings:'Cài đặt',desktop:'Máy tính',tablet:'Máy tính bảng',mobile:'Điện thoại'};
const date=value=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
let client,data=null,generation=0,busy=false,request;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function clear(){data=null;$('dashboard').hidden=true;$('gate').hidden=false;$('account-name').textContent='';for(const id of ['cards','chart','daily','features','system','devices'])$(id).replaceChildren();}
const row=(label,value)=>'<div class="stat-row"><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong></div>';
function render(value){
 data=value;$('gate').hidden=true;$('dashboard').hidden=false;$('account-name').textContent=value.account.name;$('updated').textContent='Cập nhật '+date(value.generatedAt)+' · Tự làm mới mỗi 30 giây';$('started').textContent=date(value.startedAt);
 const s=value.summary;$('cards').innerHTML=[['Hoạt động 5 phút',s.active5,'Trong 30 phút: '+number(s.active30)],['Người dùng hôm nay',s.today,'Trình duyệt riêng biệt'],['Người dùng 7 ngày',s.week,'Không cộng trùng giữa các ngày'],['Người dùng 30 ngày',s.month,'Không phải số tài khoản']].map((c,i)=>'<article class="card"><small>'+(i===0?'<span class="live"></span>':'')+escape(c[0])+'</small><strong>'+number(c[1])+'</strong><p>'+escape(c[2])+'</p></article>').join('');
 const max=Math.max(1,...value.daily.map(d=>d.visitors)),step=620/value.daily.length;
 $('chart').innerHTML=value.daily.some(d=>d.visitors)?'<svg viewBox="0 0 660 200" role="img" aria-label="Số người dùng theo ngày"><line x1="20" x2="640" y1="170" y2="170" stroke="#dce4ed"/>'+value.daily.map((d,i)=>'<rect x="'+(20+i*step+1)+'" y="'+(170-d.visitors/max*145)+'" width="'+Math.max(2,step-3)+'" height="'+(d.visitors/max*145)+'" rx="2" fill="#0f766e"><title>'+escape(d.day)+': '+number(d.visitors)+' người dùng</title></rect>').join('')+'<text x="20" y="194" font-size="11" fill="#596d87">'+escape(value.daily[0].day)+'</text><text x="640" y="194" text-anchor="end" font-size="11" fill="#596d87">'+escape(value.daily.at(-1).day)+'</text></svg>':'<div class="empty">Chưa có lượt truy cập trong khoảng này.</div>';
 $('daily').innerHTML=value.daily.map(d=>'<tr><td>'+escape(d.day)+'</td><td>'+number(d.visitors)+'</td><td>'+number(d.views)+'</td></tr>').join('');
 const largest=Math.max(1,...value.features.map(f=>f.views));$('features').innerHTML=value.features.length?value.features.map(f=>'<div class="feature"><header><span>'+escape(names[f.feature]||f.feature)+'</span><strong>'+number(f.views)+'</strong></header><div class="track"><span style="width:'+Math.round(f.views/largest*100)+'%"></span></div><small>'+number(f.visitors)+' trình duyệt</small></div>').join(''):'<p class="muted">Số liệu sẽ xuất hiện khi người dùng mở ứng dụng.</p>';
 const c=value.counters;$('system').innerHTML=row('Máy chủ','Đang hoạt động')+row('Lượt xem · '+value.days+' ngày',number(s.views))+row('Phiên mở tab · '+value.days+' ngày',number(s.sessions))+row('Yêu cầu thời tiết',number(c.weather_requests))+row('Lỗi lấy thời tiết',number(c.weather_errors))+row('Lỗi máy chủ (5xx)',number(c.http_errors))+row('Lỗi giao diện đã ghi nhận',number(c.browser_errors))+row('Lưu thống kê',value.system.persistent?'Bộ nhớ bền vững · 90 ngày':'Chưa sẵn sàng')+row('Phiên bản triển khai',value.system.deployment||'Bản phát triển');
 $('devices').innerHTML=value.devices.length?value.devices.map(d=>row(names[d.device]||d.device,number(d.visitors))).join(''):'<p class="muted">Chưa có dữ liệu thiết bị.</p>';
}
async function refresh(){
 if(busy||!client?.currentUser())return;busy=true;const current=client.currentUser(),epoch=generation;request=new AbortController();$('refresh').disabled=true;
 try{const token=await current.getIdToken();const response=await fetch('/api/admin/overview?days='+$('days').value,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.any([request.signal,AbortSignal.timeout(15000)])});const value=await response.json();if(epoch!==generation||client.currentUser()?.uid!==current.uid)return;if(!response.ok){clear();throw Error(value.error||'Chưa đọc được thống kê.');}render(value);status('');}
 catch(error){if(epoch===generation&&error.name!=='AbortError')status(error.message||'Chưa đọc được thống kê.',true);}finally{busy=false;$('refresh').disabled=false;if(epoch!==generation&&client.currentUser())queueMicrotask(refresh);}
}
$('login').addEventListener('click',async()=>{try{$('login').disabled=true;status('Đang mở đăng nhập Google…');await client.login();}catch(error){status(error.message,true);}finally{$('login').disabled=false;}});
$('logout').addEventListener('click',async()=>{generation++;request?.abort();clear();try{await client.logout();}catch(error){status(error.message,true);}});
$('refresh').addEventListener('click',refresh);$('days').addEventListener('change',refresh);
$('export').addEventListener('click',()=>{if(!data)return;const csv='\uFEFFNgày,Người dùng,Lượt xem\r\n'+data.daily.map(d=>[d.day,d.visitors,d.views].join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='avilog-thong-ke-'+data.generatedAt.slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
try{
 client=await getAccountClient();await client.ready;$('login').textContent='Đăng nhập bằng Google';$('login').disabled=!client.config.enabled;
 client.subscribe(({user,status:state})=>{generation++;request?.abort();clear();$('logout').hidden=!user;if(user){status('Đang xác minh quyền quản trị…');refresh();}else status(state==='disabled'?'Đăng nhập Google chưa được bật trên ứng dụng.':'Chỉ tài khoản Google đã được chủ ứng dụng cấp quyền mới xem được thống kê.');});
 setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
}catch(error){clear();status(error.message||'Chưa mở được đăng nhập.',true);}
