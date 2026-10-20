import {openAccountBank} from './sync/store.js';
import {getCoordinator} from '../account/coordinator.js';
export {createCoordinator,getCoordinator} from '../account/coordinator.js';
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
