// Source for the deterministic local browser bundle. No CDN SDK scripts.
import {initializeApp,getApps} from 'firebase/app';
import {initializeAuth,getAuth,indexedDBLocalPersistence,browserLocalPersistence,browserPopupRedirectResolver,GoogleAuthProvider,onIdTokenChanged,getRedirectResult,signInWithPopup,signInWithRedirect,signOut,connectAuthEmulator} from 'firebase/auth';
import {initializeFirestore,memoryLocalCache,connectFirestoreEmulator} from 'firebase/firestore';
import {createProgressTransport} from './sync/firebase-transport.js';
import {createWorkspaceTransport} from '../workspace/firebase-transport.js';
import {getStorage,connectStorageEmulator} from 'firebase/storage';
import {createEvidenceTransport} from '../workspace/evidence-transport.js';
import {validUID} from './sync/store.js';
export const prefersRedirect=(agent=navigator)=>/iPhone|iPad|iPod|Android/i.test(agent.userAgent)||(/Macintosh/i.test(agent.userAgent)&&agent.maxTouchPoints>0);
export function createAccountClient({config,coordinator}){
 config={...config,workspaceSyncEnabled:config.enabled===true&&config.workspaceSyncEnabled===true,evidenceSyncEnabled:config.enabled===true&&config.workspaceSyncEnabled===true&&config.evidenceSyncEnabled===true};
 const listeners=new Set();let user=null,status=config.enabled?'connecting':'disabled',error=null,auth=null,db=null,storage=null,stop=()=>{};
 const notify=()=>{for(const fn of listeners)fn({user,status,error});};
 const ready=(async()=>{
  if(!config.enabled)return null;
  if(config.appOrigin!==location.origin||config.authDomain!==location.host)throw new Error('Cấu hình đăng nhập khác địa chỉ ứng dụng.');
  if(config.emulators&&(!['localhost','127.0.0.1'].includes(location.hostname)||!config.projectId.startsWith('demo-')))throw new Error('Cấu hình emulator chỉ dùng trên localhost.');
  const app=getApps().find(a=>a.name==='atpl-account-v1')||initializeApp(config,'atpl-account-v1');
  try{auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence],popupRedirectResolver:browserPopupRedirectResolver});}catch(e){if(e.code!=='auth/already-initialized')throw e;auth=getAuth(app);}
  // Short-lived sync reads use long polling to avoid stalled streaming reads on WebKit/proxies.
  db=initializeFirestore(app,{localCache:memoryLocalCache(),experimentalForceLongPolling:true,experimentalAutoDetectLongPolling:false});
  if(config.evidenceSyncEnabled){if(!config.storageBucket)throw new Error('Thiếu bucket ảnh riêng tư.');storage=getStorage(app);if(config.emulators?.storage)connectStorageEmulator(storage,config.emulators.storage.host,config.emulators.storage.port);}
  if(config.emulators){connectAuthEmulator(auth,config.emulators.auth,{disableWarnings:true});connectFirestoreEmulator(db,config.emulators.firestore.host,config.emulators.firestore.port);}
  await new Promise(resolve=>{let first=true;stop=onIdTokenChanged(auth,async current=>{
   const valid=current&&validUID(current.uid)&&current.providerData.some(p=>p.providerId==='google.com');
   if(valid&&coordinator.isExplicitGuest?.()){user=null;status='guest';try{await signOut(auth);}catch(e){error=e;status='error';}notify();if(first){first=false;resolve();}return;}
   user=valid?current:null;status=user?'authenticated':coordinator.getCachedSelection()?'reauth':'guest';
   try{if(user){if(coordinator.getCachedSelection()?.uid!==user.uid||coordinator.getCachedSelection()?.loginPending)coordinator.selectAuthenticatedUser(user);}else coordinator.invalidateGeneration();}catch(e){error=e;user=null;status='error';coordinator.invalidateGeneration();if(coordinator.getCachedSelection())globalThis.dispatchEvent?.(new Event('atpl-account-changing'));}
   notify();if(first){first=false;resolve();}
  },e=>{error=e;status='error';notify();resolve();});});
  try{const result=await getRedirectResult(auth);if(!result&&!user)coordinator.cancelLoginIntent?.();}catch(e){coordinator.cancelLoginIntent?.();error=e;status=user?'authenticated':'error';notify();}
  return user;
 })().catch(e=>{error=e;status='error';notify();return null;});
 function provider(){const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return p;}
 return {ready,get config(){return config;},currentUser:()=>user,get status(){return status;},get error(){return error;},subscribe(fn){listeners.add(fn);fn({user,status,error});return()=>listeners.delete(fn);},
  async validateSession(){await ready;if(!user)throw Object.assign(new Error('Cần đăng nhập lại để đồng bộ.'),{code:'unauthenticated'});try{await user.getIdToken();return user.uid;}catch(e){error=e;user=null;status='reauth';coordinator.invalidateGeneration();notify();throw e;}},
  async login({redirect=prefersRedirect()}={}){
   await ready;if(!config.enabled||!auth)throw new Error('Đăng nhập Google chưa được kích hoạt.');if(!navigator.onLine)throw new Error('Cần có mạng để đăng nhập Google.');
   error=null;coordinator.beginLoginIntent?.();try{if(redirect)return await signInWithRedirect(auth,provider());return await signInWithPopup(auth,provider());}catch(e){if(e.code==='auth/popup-blocked')return signInWithRedirect(auth,provider());coordinator.cancelLoginIntent?.();error=e;status=user?'authenticated':'error';notify();throw e;}
  },
  async logout(){await ready;coordinator.invalidateGeneration();if(auth)await signOut(auth);user=null;status='guest';coordinator.selectGuest();notify();},
  transport(identity){if(!user||status!=='authenticated')throw new Error('Cần đăng nhập lại để đồng bộ.');return createProgressTransport({db,uid:user.uid,identity,getAuthGeneration:()=>coordinator.generation});},
  workspaceTransport(){if(!config.workspaceSyncEnabled)throw new Error('Đồng bộ workspace chưa được kích hoạt.');if(!user||status!=='authenticated')throw new Error('Cần đăng nhập lại để đồng bộ.');return createWorkspaceTransport({db,uid:user.uid,getAuthGeneration:()=>coordinator.generation});},
  evidenceTransport(){if(!config.evidenceSyncEnabled||!storage)throw new Error('Đồng bộ ảnh chưa được kích hoạt.');if(!user||status!=='authenticated')throw new Error('Cần đăng nhập lại để truyền ảnh.');return createEvidenceTransport({storage,uid:user.uid,getAuthGeneration:()=>coordinator.generation});},
  close(){stop();listeners.clear();}
 };
}
