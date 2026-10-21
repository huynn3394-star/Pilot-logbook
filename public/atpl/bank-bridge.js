import {setupAccountUI} from './account-ui.js';
import {getCatalog,enableOffline,bankStatus,downloadBank,downloadError,size} from './offline.js';
const theme=document.createElement('link');theme.rel='stylesheet';theme.href='/atpl/avilog-theme.css';document.head.append(theme);
const tools=document.querySelector('.top-tools'),manage=document.createElement('details');manage.dataset.bankManage='';manage.className='bank-management';manage.innerHTML='<summary>＋ Quản lý</summary><div class="bank-management-content"></div>';for(const button of tools.querySelectorAll('[data-action=theme],[data-action=settings]'))manage.lastElementChild.append(button);tools.append(manage);
document.addEventListener('click',event=>{if(manage.open&&!event.composedPath().includes(manage))manage.open=false;});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&manage.open){manage.open=false;manage.querySelector('summary').focus();}});
const compactBankInfo=()=>{for(const card of document.querySelectorAll('#view section.card')){if(!card.querySelector('[data-action=audit]')||card.closest('[data-bank-quality]'))continue;const details=document.createElement('details');details.className='sourcebox';details.dataset.bankQuality='';const summary=document.createElement('summary');summary.textContent='Nguồn và chất lượng câu hỏi';card.before(details);details.append(summary,card);}};
compactBankInfo();new MutationObserver(compactBankInfo).observe(document.getElementById('view'),{childList:true});
const compactEdition=()=>{const edition=document.querySelector('.mb-edition');if(!edition||edition.closest('.bank-edition'))return;const details=document.createElement('details');details.className='bank-edition';const summary=document.createElement('summary');summary.textContent=edition.querySelector('strong').textContent;edition.before(details);details.append(summary,edition);};
compactEdition();new MutationObserver(compactEdition).observe(document.querySelector('.app'),{childList:true});
const choose=document.getElementById('choose-subject');choose.textContent='← Ôn thi';choose.addEventListener('click',()=>location.assign('/atpl/'));
// Mass & Balance modes retain separate URLs, source keys and localStorage keys.
const catalog=await getCatalog();
document.addEventListener('click',e=>{const link=e.target.closest('a.mb-mode-link');if(!link)return;const target=catalog.banks.find(b=>b.code===link.hash.slice(1).toUpperCase());if(target){e.preventDefault();e.stopImmediatePropagation();location.assign(target.url)}},true);
window.addEventListener('hashchange',()=>{const b=catalog.banks.find(b=>b.code===location.hash.slice(1).toUpperCase());if(b&&b.code!==window.ATPL_SUBJECT)location.replace(b.url)});
const bank=catalog.banks.find(b=>b.code===window.ATPL_SUBJECT),button=document.createElement('button');button.type='button';button.id='atpl-offline-button';button.textContent='Tải offline';manage.lastElementChild.append(button);
const line=document.createElement('div');line.id='atpl-offline-status';line.className='storage-line';line.setAttribute('role','status');manage.lastElementChild.append(line);
let active;
async function update(){try{const s=await bankStatus(bank);line.textContent=s.ready?'✓ Môn này sẵn sàng offline · đủ đề, lời giải và ảnh nguồn':'Muốn học khi mất mạng: tải offline môn này trước.';button.textContent=s.ready?'Offline ✓':'Tải offline · '+size(bank.offlineBytes)}catch{line.textContent='Chưa kiểm tra được bộ nhớ offline.'}}
button.addEventListener('click',async()=>{if(active){active.abort();return}active=new AbortController();button.textContent='Dừng tải';try{await downloadBank(bank,{signal:active.signal,onProgress:p=>{line.textContent=`Đang tải ${size(p.bytes)} / ${size(p.totalBytes)} · ${p.completed}/${p.total} tài nguyên`}});active=null;await update()}catch(e){active=null;button.textContent='Tiếp tục tải offline';line.textContent=downloadError(e)}});
enableOffline().catch(e=>{line.textContent=downloadError(e)});await update();

// Account controls live in the subject library; the bank still runs its sync controller.
const bankStore=await window.ATPL_ACCOUNT_READY;
if(bankStore.uid&&!bankStore.writable)document.getElementById('storage-warning').textContent='Chỉ đọc: môn này đang mở ở tab khác hoặc thiếu Web Locks. Đóng tab cùng môn rồi tải lại để lưu tiến độ.';
setupAccountUI({bankStore}).catch(()=>{document.getElementById('storage-warning').textContent='Chưa kết nối tài khoản. Tiến độ vẫn lưu trên máy; về Ôn thi để kiểm tra đồng bộ.';});
