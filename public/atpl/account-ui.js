import {bootstrapBank,getCoordinator} from './account-bootstrap.js';
import {getAccountClient} from './account.js';
import {publishAreaStatus} from '../account/coordinator.js';
import {openAccountBank} from './sync/store.js';
import {createSyncController,reviewLegacyImport} from './sync/controller.js';
let activeController=null;
const downloads=(name,value)=>{const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);};
function backup(identity,parts){const code=identity.code;downloads(`ATPL_${code}_truoc_khi_nhap_${Date.now()}.json`,parts.before?{format:`atpl-${code.toLowerCase()}-backup`,subject:code,bankSHA256:identity.bankSHA256,version:2,state:parts.before,sourceOriginal:parts.source,sourceText:parts.sourceText}:parts);}
export async function prepareBank(identity){
 const store=await bootstrapBank(identity);store.identity=identity;globalThis.ATPLBankStore=store;
 const bridge={account:Boolean(store.uid),pendingRefresh:false,
  beginSession(kind){if(store.uid&&store.writable)store.beginSession(kind);},
  onLocalSaveFailure(){activeController?.setLocalDurability(false);},
  onLocalSave(state){if(!store.uid)return state;activeController?.setLocalDurability(true);activeController?.schedule(identity.code);return store.getEngineState();},
  exportState(state,saved){return store.uid&&saved?store.getEnvelope().state:state;},
  refreshAtSafeBoundary(){if(!store.uid)return null;bridge.pendingRefresh=false;return JSON.parse(store.engineStorage.getItem(`atpl_${identity.code.toLowerCase()}_v2_state`));},
  exportBackup(text){return store.uid?JSON.stringify({...JSON.parse(text),bankSHA256:identity.bankSHA256},null,2):text;},
  async beforeImport(guest,sourceText){
   if(!store.writable)throw new Error('Môn này chỉ đọc. Đóng tab cùng môn rồi mở lại.');
   const accepted=await reviewLegacyImport({store,guest,sourceText,identity,confirm:summary=>confirm(`Hợp nhất ${summary.guestDone} câu đã làm, ${summary.guestBookmarks} bookmark và ${summary.guestReports} bài thi? Lượt cũ chồng lặp lấy số lớn hơn; không cộng trùng. Giữ phiên tài khoản đang có. Bản sao trước khi nhập sẽ được tải xuống.`),backup:parts=>backup(identity,parts)});
   if(accepted)activeController?.schedule(identity.code);return accepted;
  },
  beforeReset(state){if(!store.writable)throw new Error('Môn này chỉ đọc.');if(!confirm('Đặt lại tiến độ môn này trong tài khoản trên các thiết bị sau khi đồng bộ? Bản lưu máy khác chưa gửi sẽ được giữ để xuất khi báo xung đột. Hãy giữ bản sao tải xuống trước khi đặt lại.'))return false;backup(identity,{format:`atpl-${identity.code.toLowerCase()}-backup`,subject:identity.code,bankSHA256:identity.bankSHA256,version:2,state:store.getEnvelope().state});store.replaceWithNewEpoch(state);activeController?.schedule(identity.code);return true;}
 };
 globalThis.ATPLAccountBridge=bridge;
 addEventListener('atpl-remote-update',()=>{bridge.pendingRefresh=true;dispatchEvent(new Event('atpl-refresh-available'));});
 return store;
}
const statusText=s=>({local:'Lưu trên máy',pending:'Lưu trên máy · còn thay đổi chờ gửi',offline:'Offline · tiến độ giữ trên máy',reauth:'Cần đăng nhập lại để đồng bộ',syncing:'Đang đồng bộ…',synced:`Đã đồng bộ lúc ${new Date(s.at||Date.now()).toLocaleTimeString('vi-VN')}`,disabled:'Đăng nhập Google chưa được kích hoạt',epoch:'Tiến độ trên máy chủ đã đặt lại. Bản máy này được giữ; xuất sao lưu rồi chọn Dùng bản trên máy chủ.',error:'Chưa đồng bộ · '+(s.message||'hãy thử lại khi có mạng')}[s.kind]||'Lưu trên máy');
export function mountAccountUI({element,account,controller,coordinator,store=null,identities={}}){
 element.classList.add('atpl-account');const identityLine=document.createElement('div'),status=document.createElement('p'),actions=document.createElement('div'),notice=document.createElement('p');status.setAttribute('role','status');actions.className='atpl-account-actions';notice.className='atpl-account-note';element.append(identityLine,status,actions,notice);
 const button=(text,fn,disabled=false)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.disabled=disabled;b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}});actions.append(b);return b;};
 function render(){
  actions.replaceChildren();const cached=coordinator.getCachedSelection(),user=account.currentUser();identityLine.textContent=cached?`${cached.displayName||'Tài khoản'} · ${cached.email||''}`:'Chế độ khách · tiến độ chỉ lưu trên thiết bị';status.textContent=statusText(controller.status());
  if(!user)button(account.config.enabled?'Tiếp tục với Google':'Google chưa kích hoạt',()=>account.login(),!account.config.enabled);else{button('Đồng bộ ngay',()=>controller.syncNow(store?.identity?.code));button('Đăng nhập tài khoản khác',()=>account.login());}
  if(cached){button('Đăng xuất / về khách',()=>account.logout());button('Xuất bản lưu tài khoản',()=>{const raw={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(`atpl_account_v1:${cached.uid}:`))raw[key]=localStorage.getItem(key);}downloads('ATPL_ban_luu_tai_khoan.json',raw);});
   if(user)button('Xem / nhập tiến độ khách',async()=>{
    const list=Object.values(identities).filter(id=>!store||id.code===store.identity.code),candidates=list.map(id=>{const raw=localStorage.getItem(`atpl_${id.code.toLowerCase()}_v2_state`);if(!raw)return null;const guest=JSON.parse(raw);return {identity:id,guest,done:Object.keys(guest.progress||{}).length,reports:guest.examHistory?.length||0};}).filter(Boolean);
    if(!candidates.length){notice.textContent='Không có tiến độ khách trên thiết bị này. Có thể nhập file JSON trong Cài đặt của môn học.';return;}
    if(!confirm('Tiến độ khách trên máy: '+candidates.map(x=>`${x.identity.code}: ${x.done} câu, ${x.reports} bài thi`).join('; ')+'. Tiếp tục xem và duyệt riêng từng môn?'))return;
    for(const item of candidates){const target=store||await openAccountBank({storage:localStorage,uid:user.uid,identity:item.identity,locks:navigator.locks});try{await reviewLegacyImport({store:target,guest:item.guest,identity:item.identity,confirm:summary=>confirm(`${item.identity.code}: nhập ${summary.guestDone} câu, ${summary.guestReports} bài thi? Lượt cũ trùng lấy số lớn hơn, không cộng trùng. Tải bản sao trước khi nhập; giữ nguyên dữ liệu khách.`),backup:parts=>backup(item.identity,parts)});}finally{if(!store)target.release();}}
    if(store)dispatchEvent(new Event('atpl-refresh-requested'));controller.schedule(store?.identity?.code);notice.textContent='Bản nhập được lưu trên máy; chờ báo đã đồng bộ trước khi đổi thiết bị.';
   });
  }
  let recoveryCode;
  if(!store&&user){const label=document.createElement('label');label.textContent='Môn cần khôi phục ';recoveryCode=document.createElement('select');recoveryCode.setAttribute('aria-label','Môn cần khôi phục');for(const code of Object.keys(identities)){const option=document.createElement('option');option.value=code;option.textContent=code;recoveryCode.append(option);}label.append(recoveryCode);actions.append(label);}
  if(user)button('Dùng bản trên máy chủ',async()=>{
   const code=store?.identity.code||recoveryCode.value,identity=identities[code];
   const restored=await controller.restoreFromCloud(code,{backup:envelope=>downloads(`ATPL_${code}_truoc_khoi_phuc_${Date.now()}.json`,{format:`atpl-${code.toLowerCase()}-backup`,subject:code,bankSHA256:identity.bankSHA256,version:2,state:envelope.state,accountEnvelope:envelope}),confirm:summary=>confirm(`Đã tạo bản sao phục hồi. Dùng bản trên máy chủ (${Object.keys(summary.remote.progress).length} câu) thay bản trên máy này (${Object.keys(summary.local.progress).length} câu)? Phần chưa gửi chỉ còn trong file sao lưu. Bạn có thể nhập lại sau khi xem xét. Trang sẽ tải lại.`)});if(restored)location.reload();
  });
  if(store)button('Cập nhật tiến độ / về trang chủ',()=>dispatchEvent(new Event('atpl-refresh-requested')));
  const privacy=document.createElement('a');privacy.href='/atpl/privacy.html';privacy.textContent='Quyền riêng tư';actions.append(privacy);
  notice.textContent=store&&!store.writable?'Chỉ đọc: đóng tab đang học cùng môn rồi tải lại. Trình duyệt thiếu Web Locks vẫn có thể học bằng chế độ khách.':cached?'Sau cập nhật, đóng/mở lại AviLog trên các thiết bị; không xóa dữ liệu trình duyệt. Học offline trên máy này. Cần có mạng và báo đã đồng bộ để chuyển tiến độ sang máy khác. Tiến độ khách chỉ nhập sau khi bạn xác nhận.':'Đăng nhập để đồng bộ ATPL giữa điện thoại và iPad. Các môn đã tải vẫn học được offline.';
  if(store&&!store.writable)button('Thử mở lại quyền ghi',()=>location.reload());
 }
 render();account.subscribe(render);addEventListener('atpl-sync-status',()=>{status.textContent=statusText(controller.status());});addEventListener('offline',()=>{status.textContent='Offline · tiến độ giữ trên máy';});
 return {update:s=>{status.textContent=statusText(s);},render};
}
export async function setupAccountUI({element,bankStore=null}={}){
 const coordinator=getCoordinator();let identities={};if(bankStore?.identity)identities[bankStore.identity.code]=bankStore.identity;else try{identities=await(await fetch('/atpl/identities.json')).json();}catch{}
 const account=await getAccountClient();let ui;
 const controller=createSyncController({account,codes:bankStore?.identity?[bankStore.identity.code]:Object.keys(identities),openBank:async code=>{
  if(bankStore?.uid&&code===bankStore.identity.code)return bankStore;
  const store=await openAccountBank({storage:localStorage,uid:account.currentUser().uid,identity:identities[code],locks:navigator.locks});store.releaseAfterSync=true;return store;
 },onStatus:s=>{const uid=bankStore?.uid||account.currentUser()?.uid;if(uid&&uid===coordinator.getCachedSelection()?.uid){const code=s.code||bankStore?.identity?.code||'ALL';publishAreaStatus({uid,area:'atpl',code,status:{...s,...(!bankStore&&!s.code&&s.kind==='synced'?{checkedCodes:Object.keys(identities)}:{})}});}ui?.update(s);dispatchEvent(new Event('atpl-sync-status'));}});
 const warning=!element&&bankStore?document.createElement('p'):null;if(warning){warning.dataset.bankSyncWarning='';warning.className='storage-line';warning.setAttribute('role','status');warning.hidden=true;document.getElementById('storage-line')?.after(warning);}
 activeController=controller;ui=element?mountAccountUI({element,account,controller,coordinator,store:bankStore?.uid?bankStore:null,identities}):{update(s){if(!warning)return;const failure=['reauth','epoch','error'].includes(s.kind);warning.hidden=!failure;warning.textContent=failure?statusText(s)+' · Về menu Ôn thi để kiểm tra và xử lý. Tiến độ vẫn giữ trên máy.':'';},render(){}};
 addEventListener('atpl-local-change',()=>controller.schedule(bankStore?.identity?.code));for(const event of ['online','focus'])addEventListener(event,()=>controller.syncNow(bankStore?.identity?.code));
 account.subscribe(({user,status})=>{if(user&&status==='authenticated')controller.schedule(bankStore?.identity?.code);});
 account.ready.then(()=>{ui.render();if(account.currentUser())controller.syncNow(bankStore?.identity?.code);});
 if(!bankStore){coordinator.subscribe(()=>{controller.stop();location.reload();});addEventListener('pageshow',event=>{if(event.persisted)location.reload();});}
 addEventListener('pagehide',()=>controller.stop(),{once:true});return {account,controller,ui};
}
