import {mountStudyShell} from '../ui/study-shell.js';
import {replaceEmbeddedStudy} from '../ui/companion-navigation.js';
import {appearance,applyAppearance,setAppearance} from '../lib/appearance.js';
import {setupAccountUI} from './account-ui.js';
import {getCatalog,enableOffline,bankStatus,downloadBank,downloadError,size,downloadSize} from './offline.js';
const theme=document.createElement('link');theme.rel='stylesheet';theme.href='/atpl/avilog-theme.css';document.head.append(theme);
const tools=document.querySelector('.top-tools'),manage=document.createElement('details');manage.dataset.bankManage='';manage.className='bank-management';manage.innerHTML='<summary>＋ Quản lý</summary><div class="bank-management-content"></div>';for(const button of tools.querySelectorAll('[data-action=theme],[data-action=settings]'))manage.lastElementChild.append(button);tools.append(manage);
document.addEventListener('click',event=>{if(manage.open&&!event.composedPath().includes(manage))manage.open=false;});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&manage.open){manage.open=false;manage.querySelector('summary').focus();}});
const compactBankInfo=()=>{for(const card of document.querySelectorAll('#view section.card')){if(!card.querySelector('[data-action=audit]')||card.closest('[data-bank-quality]'))continue;const details=document.createElement('details');details.className='sourcebox';details.dataset.bankQuality='';const summary=document.createElement('summary');summary.textContent='Nguồn và chất lượng câu hỏi';card.before(details);details.append(summary,card);}};
compactBankInfo();new MutationObserver(compactBankInfo).observe(document.getElementById('view'),{childList:true});
// MB keeps the original 300-question Word source and its existing progress key.
const removeEdition=()=>document.querySelector('.mb-edition')?.remove();
removeEdition();new MutationObserver(removeEdition).observe(document.querySelector('.app'),{childList:true});
const studyShell=mountStudyShell(document.querySelector('.app'),{bank:true});
const choose=document.getElementById('choose-subject');choose.textContent='Môn học';choose.addEventListener('click',()=>{if(!replaceEmbeddedStudy('/atpl/'))location.assign('/atpl/');});
const bankStore=await window.ATPL_ACCOUNT_READY;
const button=document.createElement('button');button.type='button';button.id='atpl-offline-button';button.textContent='Tải offline';manage.lastElementChild.append(button);
const line=document.createElement('div');line.id='atpl-offline-status';line.className='storage-line';line.setAttribute('role','status');manage.lastElementChild.append(line);
let active,bank,preparing;
async function update(){try{const s=await bankStatus(bank);line.textContent=s.ready?'✓ Môn này sẵn sàng offline · đủ đề, lời giải và ảnh nguồn':'Muốn học khi mất mạng: tải offline môn này trước.';button.textContent=s.ready?'Offline ✓':'Tải offline · '+size(downloadSize(bank))}catch{line.textContent='Chưa kiểm tra được bộ nhớ offline.'}}
function prepareOffline(){
 if(preparing)return preparing;
 button.disabled=true;
 preparing=(async()=>{
  const catalog=await getCatalog();bank=catalog.banks.find(b=>b.code===window.ATPL_SUBJECT);
  if(!bank)throw Error('Chưa tìm thấy thông tin tải offline của môn này.');
  document.querySelector('[data-study-subject]').textContent=bank.name;await update();
 })().catch(e=>{line.textContent=downloadError(e);button.textContent='Thử lại thông tin offline';}).finally(()=>{button.disabled=false;preparing=null;});
 return preparing;
}
button.addEventListener('click',async()=>{if(!bank){await prepareOffline();return}if(active){active.abort();return}active=new AbortController();button.textContent='Dừng tải';try{await downloadBank(bank,{signal:active.signal,onProgress:p=>{line.textContent=`Đang tải ${size(p.bytes)} / ${size(p.totalBytes)} · ${p.completed}/${p.total} tài nguyên`}});active=null;await update()}catch(e){active=null;button.textContent='Tiếp tục tải offline';line.textContent=downloadError(e)}});
// Optional catalog/offline checks cannot hold up account controls or display
// settings, and a navigation-cancelled fetch must not reject this module.
enableOffline().catch(e=>{line.textContent=downloadError(e)});prepareOffline();

// Use the same bank store/controller for the collapsed account menu in this subject.
if(bankStore.uid&&!bankStore.writable)document.getElementById('storage-warning').textContent='Chỉ đọc: môn này đang mở ở tab khác hoặc thiếu Web Locks. Đóng tab cùng môn rồi tải lại để lưu tiến độ.';
setupAccountUI({element:studyShell.accountElement,bankStore}).catch(()=>{document.getElementById('storage-warning').textContent='Chưa kết nối tài khoản. Tiến độ vẫn lưu trên máy; về Ôn thi để kiểm tra đồng bộ.';});

// Display choice is shared with AviLog without rewriting source-bank engine state.
applyAppearance();new MutationObserver(()=>{applyAppearance();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
document.addEventListener('click',event=>{if(!event.target.closest('[data-action=theme]'))return;event.preventDefault();event.stopImmediatePropagation();setAppearance({theme:document.documentElement.dataset.theme==='dark'?'light':'dark'});},true);

// Keep the original quiz settings control connected to the shared display choice.
const themeDialog=document.querySelector('#dialog');new MutationObserver(()=>{const select=themeDialog.querySelector('#theme-select');if(select)select.value=appearance().theme||'light';}).observe(themeDialog,{childList:true});
document.addEventListener('change',event=>{if(event.target.id==='theme-select')setAppearance({theme:event.target.value});},true);

// Additive Notes controls: original bank data, engine and progress keys stay unchanged.
import('../notes/context.js').then(m=>m.mountStudyNotes()).catch(e=>console.warn('Notes unavailable',e));
