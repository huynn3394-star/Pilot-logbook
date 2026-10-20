import {validUID} from '../atpl/sync/store.js';
const ACTIVE='atpl_active_account_v1',SIGNAL='atpl_account_signal_v1';
export const requiredAtplCodes=Object.freeze(['POF','COM','INS','MET','RNAV','LAW','MB','MBR','AGK','PERF','OPS','HUM']);
const statusKinds=new Set(['local','pending','offline','syncing','synced','conflict','reauth','error','disabled','readonly','not-loaded','ready','uploading','downloading','offline-ready','epoch']);
function safeStatus(status){
 if(!statusKinds.has(status?.kind))throw Error('Trạng thái khu vực không hợp lệ.');const safe={kind:status.kind};
 for(const field of['at','pending','conflicts','total','offlineReady','missing'])if(Number.isSafeInteger(status[field])&&status[field]>=0)safe[field]=status[field];
 if(Array.isArray(status.checkedCodes))safe.checkedCodes=[...new Set(status.checkedCodes.filter(code=>requiredAtplCodes.includes(code)))];return safe;
}
export function createCoordinator({storage,eventTarget=globalThis.window,channel=null}={}){
 let generation=0,sequence=0;const listeners=new Set(),areaListeners=new Set(),areas=new Map(),senderId=crypto.randomUUID();
 function getCachedSelection(){try{const user=JSON.parse(storage.getItem(ACTIVE)||'null');return validUID(user?.uid)?user:null;}catch{return null;}}
 const selection=()=>{try{return storage.getItem(SIGNAL)||'';}catch{return '';}};
 const areaChanged=()=>{for(const listener of areaListeners)listener();};
 function invalidate(){generation++;areas.clear();areaChanged();}
 function notify(){invalidate();for(const listener of listeners)listener(getCachedSelection());}
 function receiveArea(value){
  if(value?.uid!==getCachedSelection()?.uid||value.selection!==selection()||!validUID(value.senderId)||!Number.isSafeInteger(value.sequence)||value.sequence<1||!Number.isSafeInteger(value.generation)||value.generation<0||!['workspace','evidence','atpl'].includes(value.area)||value.code!==undefined&&!['ALL',...requiredAtplCodes].includes(value.code))return;
  let status;try{status=safeStatus(value.status);}catch{return;}const key=value.senderId+'\0'+value.area+'\0'+(value.code||''),prior=areas.get(key);if(prior&&(value.generation<prior.generation||value.generation===prior.generation&&value.sequence<=prior.sequence))return;
  areas.set(key,{uid:value.uid,senderId:value.senderId,area:value.area,code:value.code,generation:value.generation,sequence:value.sequence,status,receivedAt:Date.now()});areaChanged();
 }
 const receive=event=>{if(event?.data?.type==='area-status'){receiveArea(event.data);return;}notify();};channel?.addEventListener('message',receive);
 const storageChange=event=>{if([ACTIVE,SIGNAL].includes(event.key))notify();};eventTarget?.addEventListener('storage',storageChange);
 function select(user){if(user&&!validUID(user.uid))throw Error('Tài khoản không hợp lệ.');if(user)storage.setItem(ACTIVE,JSON.stringify({uid:user.uid,displayName:String(user.displayName||'').slice(0,128),email:String(user.email||'').slice(0,254)}));else storage.setItem(ACTIVE,JSON.stringify({mode:'guest'}));notify();channel?.postMessage({type:'selection'});try{storage.setItem(SIGNAL,crypto.randomUUID());}catch{}}
 function publishAreaStatus({uid,area,code,status}){if(uid!==getCachedSelection()?.uid)return;const message={type:'area-status',uid,area,senderId,sequence:++sequence,generation,selection:selection(),status:safeStatus(status)};if(code!==undefined)message.code=code;receiveArea(message);channel?.postMessage(message);}
 function readAreaStatus(uid){
  const result={kind:'partial',atplVerified:false,atpl:{}};if(uid!==getCachedSelection()?.uid)return result;
  for(const value of areas.values())if(value.uid===uid&&Date.now()-value.receivedAt<120000){const target=value.area==='atpl'?result.atpl:result,slot=value.area==='atpl'?value.code||'ALL':value.area;if(!target[slot]||target[slot].receivedAt<=value.receivedAt)target[slot]=cloneStatus(value);}
  const all=result.atpl.ALL,verified=all?.status.kind==='synced'&&requiredAtplCodes.every(code=>all.status.checkedCodes?.includes(code)&&(!result.atpl[code]||result.atpl[code].receivedAt<all.receivedAt||result.atpl[code].status.kind==='synced'));result.atplVerified=Boolean(verified);if(result.workspace?.status.kind==='synced'&&result.evidence?.status.kind==='ready'&&!result.evidence.status.pending&&verified)result.kind='synced';return result;
 }
 return{get generation(){return generation;},getCachedSelection,publishAreaStatus,readAreaStatus,subscribeAreaStatus(fn){areaListeners.add(fn);return()=>areaListeners.delete(fn);},
  isExplicitGuest(){try{return JSON.parse(storage.getItem(ACTIVE)||'null')?.mode==='guest';}catch{return false;}},
  beginLoginIntent(){const previous=getCachedSelection();storage.setItem(ACTIVE,JSON.stringify({...previous,loginPending:true,...(previous?{}:{mode:'login-pending'})}));invalidate();},
  cancelLoginIntent(){try{const value=JSON.parse(storage.getItem(ACTIVE)||'null');if(!value?.loginPending)return;if(validUID(value.uid))storage.setItem(ACTIVE,JSON.stringify({uid:value.uid,displayName:value.displayName||'',email:value.email||''}));else storage.setItem(ACTIVE,JSON.stringify({mode:'guest'}));}catch{}},
  selectAuthenticatedUser:select,selectGuest:()=>select(null),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},invalidateGeneration:invalidate,
  capture:()=>({uid:getCachedSelection()?.uid||null,generation}),isCurrent:token=>token.generation===generation&&token.uid===(getCachedSelection()?.uid||null),
  dispose(){channel?.removeEventListener('message',receive);channel?.close();eventTarget?.removeEventListener('storage',storageChange);listeners.clear();areaListeners.clear();areas.clear();}
 };
}
const cloneStatus=value=>({...value,status:{...value.status,...(value.status.checkedCodes?{checkedCodes:[...value.status.checkedCodes]}:{})}});
export function getCoordinator(){
 if(globalThis.ATPLAccountCoordinator)return globalThis.ATPLAccountCoordinator;
 let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Không thể lưu tài khoản.');},removeItem:()=>{}};}
 let channel=null;try{channel=new BroadcastChannel('atpl-account-v1');}catch{}
 return globalThis.ATPLAccountCoordinator=createCoordinator({storage,channel});
}
export function publishAreaStatus(value){return getCoordinator().publishAreaStatus(value);}
export function readAreaStatus(uid){return getCoordinator().readAreaStatus(uid);}
