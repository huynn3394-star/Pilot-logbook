import {previewImport,importHash} from './import.js';
import {validateState} from './model.js';
export async function reviewLegacyImport({store,guest,sourceText,identity,confirm,backup}){
 const summary=previewImport(store.getEnvelope().state,guest,identity);
 if(!await confirm(summary))return false;
 const normalized=validateState(guest?.state||guest,identity);await backup({before:store.getEnvelope().state,source:guest,sourceText});
 await store.stageImport(normalized,await importHash(identity.code,normalized));return true;
}
export function createSyncController({account,openBank,transportFactory=(identity)=>account.transport(identity),onStatus=()=>{},codes=[],online=()=>globalThis.navigator?.onLine!==false,maxBatches=20}){
 let durable=true,stopped=false,version=0,running=null,timer=null,retries=0,current={kind:'local'},lastUID=account.currentUser()?.uid||null;const transports=new Set();
 const set=value=>{current=value;onStatus(value);};
 const valid=(token,uid)=>!stopped&&token===version&&account.currentUser()?.uid===uid;
 const unsubscribe=account.subscribe(event=>{const uid=event.user?.uid||null;if(uid!==lastUID){version++;lastUID=uid;for(const t of transports)t.close();transports.clear();clearTimeout(timer);set({kind:uid?'local':'reauth'});}});
 async function run(code){
  const uid=account.currentUser()?.uid,token=version;
  if(!account.config.enabled){set({kind:'disabled'});return;}
  if(!online()){set({kind:'offline'});return;}
  if(!uid){set({kind:'reauth'});return;}
  set({kind:'syncing',code});let pending=false;
  try{
   await account.validateSession?.();if(!valid(token,uid))return;
   for(const subject of code?[code]:codes){
    if(!valid(token,uid))return;const store=await openBank(subject);let transport;
    try{
     if(!valid(token,uid)||store.uid!==uid)return;if(!store.writable)throw new Error('Môn này đang mở ở tab khác hoặc trình duyệt chưa hỗ trợ khóa ghi. Đóng tab rồi thử lại.');
     transport=transportFactory(store.identity);transports.add(transport);
     if(!store.hasPending()){
      const remote=await transport.pull();if(!valid(token,uid))return;store.acceptRemote(remote);globalThis.dispatchEvent?.(new Event('atpl-remote-update'));
     }
     let sent=0;
     while(store.hasPending()&&sent<maxBatches){
      const batch=store.prepare({batchId:crypto.randomUUID(),deviceId:deviceID()});
      const ack=await transport.commit(batch);if(!valid(token,uid))return;
      store.commitAck(ack);globalThis.dispatchEvent?.(new Event('atpl-remote-update'));sent++;
     }
     pending||=store.hasPending();
    }finally{if(transport){transport.close();transports.delete(transport);}if(store.releaseAfterSync)store.release();}
   }
   if(valid(token,uid)){retries=0;set(durable?{kind:pending?'pending':'synced',code,at:Date.now()}:{kind:'error',message:'Có thay đổi chưa lưu được trên máy; hãy xuất tiến độ trước khi đóng.'});if(pending)schedule(code);}
  }catch(error){
   if(!valid(token,uid))return;const auth=['permission-denied','unauthenticated','auth/user-token-expired','auth/invalid-user-token','auth/user-not-found','auth/user-disabled','auth/invalid-refresh-token'].includes(error.code);
   set({kind:auth?'reauth':/epoch/.test(error.message)?'epoch':online()?'error':'offline',code,message:error.message});
   if(['unavailable','deadline-exceeded','aborted'].includes(error.code)&&retries<5){clearTimeout(timer);timer=setTimeout(()=>syncNow(code),Math.min(60000,2000*2**retries++));timer.unref?.();}
  }
 }
 async function restoreFromCloud(code,{backup,confirm}){
  if(stopped||!online()||!account.currentUser())throw new Error('Cần đăng nhập và có mạng để khôi phục.');if(!durable)throw new Error('Có thay đổi chưa lưu; xuất tiến độ trong Cài đặt trước khi tải lại.');
  version++;clearTimeout(timer);for(const t of transports)t.close();if(running)await running;
  const token=version,uid=account.currentUser()?.uid;if(!uid)return false;await account.validateSession?.();if(!valid(token,uid))return false;
  const store=await openBank(code);let transport;
  try{if(store.uid!==uid||!store.writable)throw new Error('Không có quyền ghi môn này. Đóng tab cùng môn rồi thử lại.');transport=transportFactory(store.identity);const remote=await transport.pull();if(!valid(token,uid))return false;const before=store.getEnvelope();await backup(before);if(!await confirm({local:before.state,remote:remote.state})||!valid(token,uid))return false;store.adoptRemoteEpoch(remote);set({kind:'synced',code,at:Date.now()});return true;}
  finally{transport?.close();if(store.releaseAfterSync)store.release();}
 }
 function deviceID(){try{const key='atpl_device_id_v1';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return 'temporary-device';}}
 function syncNow(code){if(stopped)return Promise.resolve();clearTimeout(timer);if(running)return running;return running=run(code).finally(()=>{running=null;});}
 function schedule(code){if(stopped)return;set({kind:online()?'pending':'offline',code});clearTimeout(timer);timer=setTimeout(()=>syncNow(code),2000);timer.unref?.();}
 return {syncNow,schedule,restoreFromCloud,setLocalDurability(ok){durable=Boolean(ok);if(!durable)set({kind:'error',message:'Có thay đổi chưa lưu được trên máy; hãy xuất tiến độ.'});},status:()=>({...current}),stop(){if(stopped)return;stopped=true;version++;clearTimeout(timer);unsubscribe();for(const transport of transports)transport.close();transports.clear();}};
}
