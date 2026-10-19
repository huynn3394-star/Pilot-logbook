import {openAccountBank,validUID} from './sync/store.js';
const ACTIVE='atpl_active_account_v1',SIGNAL='atpl_account_signal_v1';
export function createCoordinator({storage,eventTarget=globalThis.window,channel=null}={}){
 let generation=0;const listeners=new Set();
 function getCachedSelection(){try{const u=JSON.parse(storage.getItem(ACTIVE)||'null');return validUID(u?.uid)?u:null;}catch{return null;}}
 function notify(){generation++;for(const listener of listeners)listener(getCachedSelection());}
 const receive=()=>notify();channel?.addEventListener('message',receive);
 const storageChange=e=>{if([ACTIVE,SIGNAL].includes(e.key))notify();};eventTarget?.addEventListener('storage',storageChange);
 function select(user){if(user&&!validUID(user.uid))throw new Error('Tài khoản không hợp lệ.');if(user)storage.setItem(ACTIVE,JSON.stringify({uid:user.uid,displayName:String(user.displayName||'').slice(0,128),email:String(user.email||'').slice(0,254)}));else storage.setItem(ACTIVE,JSON.stringify({mode:'guest'}));notify();channel?.postMessage({type:'selection'});try{storage.setItem(SIGNAL,crypto.randomUUID());}catch{}}
 return {get generation(){return generation;},getCachedSelection,
 isExplicitGuest(){try{return JSON.parse(storage.getItem(ACTIVE)||'null')?.mode==='guest';}catch{return false;}},
 beginLoginIntent(){const previous=getCachedSelection();storage.setItem(ACTIVE,JSON.stringify({...previous,loginPending:true,...(previous?{}:{mode:'login-pending'})}));generation++;},
 cancelLoginIntent(){try{const value=JSON.parse(storage.getItem(ACTIVE)||'null');if(!value?.loginPending)return;if(validUID(value.uid))storage.setItem(ACTIVE,JSON.stringify({uid:value.uid,displayName:value.displayName||'',email:value.email||''}));else storage.setItem(ACTIVE,JSON.stringify({mode:'guest'}));}catch{}},selectAuthenticatedUser:select,selectGuest:()=>select(null),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},invalidateGeneration(){generation++;},capture:()=>({uid:getCachedSelection()?.uid||null,generation}),isCurrent:token=>token.generation===generation&&token.uid===(getCachedSelection()?.uid||null),dispose(){channel?.removeEventListener('message',receive);channel?.close();eventTarget?.removeEventListener('storage',storageChange);listeners.clear();}};
}
export function getCoordinator(){
 if(globalThis.ATPLAccountCoordinator)return globalThis.ATPLAccountCoordinator;
 let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error('Không thể lưu tài khoản.');},removeItem:()=>{}};}
 let channel=null;try{channel=new BroadcastChannel('atpl-account-v1');}catch{}
 return globalThis.ATPLAccountCoordinator=createCoordinator({storage,channel});
}
// Local-only boot: no Firebase or network wait is allowed on this path.
export async function bootstrapBank(identity){
 const coordinator=getCoordinator(),selection=coordinator.getCachedSelection(),selectedUID=selection?.uid||null;
 let storage=null;try{storage=localStorage;}catch{}
 let bank;
 if(!selectedUID){bank={engineStorage:storage?{getItem:key=>storage.getItem(key),setItem(key,value){if(coordinator.getCachedSelection())throw new Error('Đang chuyển tài khoản; tải lại trang.');storage.setItem(key,value);}}:null,writable:Boolean(storage),uid:null,release(){}};}
 else bank=await openAccountBank({storage,uid:selectedUID,identity,locks:navigator.locks,isCurrent:()=>coordinator.getCachedSelection()?.uid===selectedUID,onChange:()=>globalThis.dispatchEvent(new CustomEvent('atpl-local-change'))});
 function changing(){if((coordinator.getCachedSelection()?.uid||null)===selectedUID)return;bank.transitioning=true;bank.release();globalThis.dispatchEvent(new CustomEvent('atpl-account-changing'));location.reload();}
 const unsubscribe=coordinator.subscribe(changing);
 if((coordinator.getCachedSelection()?.uid||null)!==selectedUID){changing();return new Promise(()=>{});}
 addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 addEventListener('pagehide',()=>{unsubscribe();bank.release();},{once:true});
 return bank;
}
