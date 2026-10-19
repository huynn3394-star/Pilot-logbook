import {setupAccountUI} from './account-ui.js';
import {getCatalog,enableOffline,bankStatus,downloadBank,downloadError,size} from './offline.js';
const choose=document.getElementById('choose-subject');choose.textContent='← Ôn thi';choose.addEventListener('click',()=>location.assign('/atpl/'));
// Mass & Balance modes retain separate URLs, source keys and localStorage keys.
const catalog=await getCatalog();
document.addEventListener('click',e=>{const link=e.target.closest('a.mb-mode-link');if(!link)return;const target=catalog.banks.find(b=>b.code===link.hash.slice(1).toUpperCase());if(target){e.preventDefault();e.stopImmediatePropagation();location.assign(target.url)}},true);
window.addEventListener('hashchange',()=>{const b=catalog.banks.find(b=>b.code===location.hash.slice(1).toUpperCase());if(b&&b.code!==window.ATPL_SUBJECT)location.replace(b.url)});
const bank=catalog.banks.find(b=>b.code===window.ATPL_SUBJECT),button=document.createElement('button');button.type='button';button.id='atpl-offline-button';button.textContent='Tải offline';document.querySelector('.top-tools').append(button);
const line=document.createElement('div');line.id='atpl-offline-status';line.className='storage-line';line.setAttribute('role','status');document.getElementById('storage-line').after(line);
let active;
async function update(){try{const s=await bankStatus(bank);line.textContent=s.ready?'✓ Môn này sẵn sàng offline · đủ đề, lời giải và ảnh nguồn':'Muốn học khi mất mạng: tải offline môn này trước.';button.textContent=s.ready?'Offline ✓':'Tải offline · '+size(bank.offlineBytes)}catch{line.textContent='Chưa kiểm tra được bộ nhớ offline.'}}
button.addEventListener('click',async()=>{if(active){active.abort();return}active=new AbortController();button.textContent='Dừng tải';try{await downloadBank(bank,{signal:active.signal,onProgress:p=>{line.textContent=`Đang tải ${size(p.bytes)} / ${size(p.totalBytes)} · ${p.completed}/${p.total} tài nguyên`}});active=null;await update()}catch(e){active=null;button.textContent='Tiếp tục tải offline';line.textContent=downloadError(e)}});
enableOffline().catch(e=>{line.textContent=downloadError(e)});await update();

const accountElement=document.createElement('section');document.querySelector('.topbar').after(accountElement);
setupAccountUI({element:accountElement,bankStore:await window.ATPL_ACCOUNT_READY}).catch(()=>{accountElement.textContent='Chưa kết nối tài khoản. Bạn vẫn học và xuất tiến độ trên máy được.';});
