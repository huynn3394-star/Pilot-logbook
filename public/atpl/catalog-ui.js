import {setupAccountUI} from './account-ui.js';
import {getCatalog,enableOffline,bankStatus,downloadBank,downloadError,size} from './offline.js';
const host=document.querySelector('#atpl-banks'),status=document.querySelector('#atpl-status');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active;
async function render(){
 const catalog=await getCatalog();
 host.innerHTML=catalog.banks.map(b=>`<article class="atpl-card" data-bank="${b.code}"><div class="atpl-card-top"><span class="atpl-code">${b.code}</span><span class="atpl-tag">${b.reference?'Bản tham khảo riêng':'Đề và đáp án gốc'}</span></div><h2>${esc(b.name)}</h2><p>${b.count} câu · Lời giải và ảnh nguồn</p><p class="atpl-key-note">${b.reference?'Câu/key hiệu chỉnh để tham khảo. Luyện thi theo key gốc: mở Mass & Balance (MB).':'Giữ nguyên key gốc khi học và chấm thi. Kết luận đối chiếu ghi riêng.'}</p><p class="atpl-ready" data-ready role="status">Đang kiểm tra bản offline…</p><div class="atpl-actions"><a class="btn primary" href="${b.url}">Mở môn →</a><button class="btn" data-download="${b.code}">Tải offline · ${size(b.offlineBytes)}</button><button class="btn" data-cancel hidden>Dừng tải</button></div><progress max="100" value="0" hidden></progress><p class="atpl-progress" aria-live="polite"></p></article>`).join('');
 await Promise.all(catalog.banks.map(async b=>{const card=host.querySelector(`[data-bank="${b.code}"]`);try{const s=await bankStatus(b);card.querySelector('[data-ready]').textContent=s.ready?'✓ Sẵn sàng offline · đã lưu đủ đề, lời giải và ảnh nguồn':'Chưa tải đầy đủ để học offline';if(s.ready)card.querySelector('[data-download]').textContent='Kiểm tra / tải lại'}catch{card.querySelector('[data-ready]').textContent='Chưa kiểm tra được bộ nhớ offline'}}));
 host.addEventListener('click',async ev=>{
  if(ev.target.closest('[data-cancel]')){active?.abort();return}
  const button=ev.target.closest('[data-download]');if(!button||active)return;
  const bank=catalog.banks.find(b=>b.code===button.dataset.download),card=button.closest('[data-bank]'),line=card.querySelector('.atpl-progress'),progress=card.querySelector('progress'),cancel=card.querySelector('[data-cancel]'),ready=card.querySelector('[data-ready]');
  active=new AbortController();host.querySelectorAll('[data-download]').forEach(b=>b.disabled=true);cancel.hidden=false;progress.hidden=false;ready.textContent='Đang tải — chưa sẵn sàng offline';
  try{await downloadBank(bank,{signal:active.signal,onProgress:p=>{progress.value=Math.floor(100*p.bytes/p.totalBytes);line.textContent=`${size(p.bytes)} / ${size(p.totalBytes)} · ${p.completed}/${p.total} tài nguyên`}});ready.textContent='✓ Sẵn sàng offline · đã lưu đủ đề, lời giải và ảnh nguồn';line.textContent='Đã kiểm tra đầy đủ. Bạn có thể tắt mạng và mở môn này.';button.textContent='Kiểm tra / tải lại'}catch(e){line.textContent=downloadError(e);ready.textContent='Chưa tải đầy đủ để học offline'}finally{active=null;cancel.hidden=true;host.querySelectorAll('[data-download]').forEach(b=>b.disabled=false)}
 });
}
enableOffline().catch(e=>{status.textContent=downloadError(e)});
render().catch(e=>{host.textContent=downloadError(e)});
window.addEventListener('offline',()=>{status.textContent='Đang offline. Mở các môn đã tải đầy đủ; tiến độ và bookmark vẫn lưu trên thiết bị.'});

setupAccountUI({element:document.getElementById('atpl-account')}).catch(()=>{document.getElementById('atpl-account').textContent='Chưa kết nối tài khoản; các môn đã tải vẫn học offline được.';});
