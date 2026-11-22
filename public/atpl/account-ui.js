// Quiz boot waits only for its local, account-scoped store. Cloud/UI code loads afterwards.
import {bootstrapBank} from './account-bootstrap.js';
import {backup} from './account-backup.js';
let activeController=null;
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
   const {reviewLegacyImport}=await import('./sync/controller.js');
   const accepted=await reviewLegacyImport({store,guest,sourceText,identity,confirm:summary=>confirm(`Hợp nhất ${summary.guestDone} câu đã làm, ${summary.guestBookmarks} bookmark và ${summary.guestReports} bài thi? Lượt cũ chồng lặp lấy số lớn hơn; không cộng trùng. Giữ phiên tài khoản đang có. Bản sao trước khi nhập sẽ được tải xuống.`),backup:parts=>backup(identity,parts)});
   if(accepted)activeController?.schedule(identity.code);return accepted;
  },
  beforeReset(state){if(!store.writable)throw new Error('Môn này chỉ đọc.');if(!confirm('Đặt lại tiến độ môn này trong tài khoản trên các thiết bị sau khi đồng bộ? Bản lưu máy khác chưa gửi sẽ được giữ để xuất khi báo xung đột. Hãy giữ bản sao tải xuống trước khi đặt lại.'))return false;backup(identity,{format:`atpl-${identity.code.toLowerCase()}-backup`,subject:identity.code,bankSHA256:identity.bankSHA256,version:2,state:store.getEnvelope().state});store.replaceWithNewEpoch(state);activeController?.schedule(identity.code);return true;}
 };
 globalThis.ATPLAccountBridge=bridge;
 addEventListener('atpl-remote-update',()=>{bridge.pendingRefresh=true;dispatchEvent(new Event('atpl-refresh-available'));});
 return store;
}

export async function setupAccountUI(options){
 const {setupAccountUI:setup}=await import('./account-panel.js');
 const result=await setup(options);activeController=result.controller;return result;
}
