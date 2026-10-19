import {validateState,prepareBatch,acknowledge,diffState,applyDelta,bytes,canonical} from './model.js';
import {clone,importSessionID} from './common.js';
import {mergeLegacy} from './import.js';
export const accountKey=(uid,code)=>`atpl_account_v1:${uid}:${code}`;
export const validUID=uid=>typeof uid==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(uid);
export const blankState=()=>({version:2,progress:{},wrong:[],bookmarks:[],examHistory:[],study:null,exam:null,settings:{theme:'system',language:'both'},updatedAt:null});
export async function openAccountBank({storage,uid,identity,locks,onChange=()=>{},isCurrent=()=>true}){
 if(!validUID(uid)||!identity?.code||!/^[A-Z]{2,4}$/.test(identity.code)||!/^[a-f0-9]{64}$/.test(identity.bankSHA256))throw new Error('Định danh tài khoản/ngân hàng không hợp lệ.');
 const key=accountKey(uid,identity.code),engineKey=`atpl_${identity.code.toLowerCase()}_v2_state`;
 let owned=false,released=false,releaseLock=()=>{},error=null,stagedSessions={};
 try{if(locks?.request)await new Promise(resolve=>{locks.request(`atpl-bank-v1:${uid}:${identity.code}`,{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock){resolve();return;}owned=true;await new Promise(done=>{releaseLock=done;resolve();});
 }).catch(e=>{error=e;resolve();});});}catch(e){error=e;}
 const fresh=()=>({schemaVersion:1,uid,code:identity.code,bankSHA256:identity.bankSHA256,epoch:'initial',localVersion:0,state:blankState(),baseline:blankState(),cloudRevision:0,sessionIds:{study:crypto.randomUUID(),exam:crypto.randomUUID()},inflight:null,pendingReports:[],pendingImports:[],importReceipts:[]});
 let envelope=fresh();
 try{const raw=storage?.getItem(key);if(raw){const candidate=JSON.parse(raw);if(candidate.schemaVersion!==1||candidate.uid!==uid||candidate.code!==identity.code||candidate.bankSHA256!==identity.bankSHA256)throw new Error('Bản lưu tài khoản không khớp ngân hàng. Hãy xuất bản gốc.');validateState(candidate.state,identity);validateState(candidate.baseline,identity);envelope=candidate;}}
 catch(e){error=e;owned=false;releaseLock();}
 let engineView=validateState(envelope.state,identity),viewSessionIds={...envelope.sessionIds},viewEpoch=envelope.epoch;
 function assertWriter(){if(released||!owned||error||!isCurrent())throw new Error(error?.message||'Chỉ đọc: chưa có khóa ghi (read-only). Đóng tab cùng môn rồi mở lại.');}
 function persist(next,local=true){assertWriter();if(bytes(next)>4*1024*1024)throw new Error('Bản lưu vượt giới hạn 4 MiB; hãy xuất sao lưu trước khi tiếp tục.');storage.setItem(key,JSON.stringify(next));envelope=next;if(local)onChange(clone(next));return clone(next);}
 const api={uid,identity,key,get writable(){return owned&&!released&&!error;},get error(){return error;},
  engineStorage:{getItem(requested){if(requested!==engineKey)return null;engineView=validateState(envelope.state,identity);viewEpoch=envelope.epoch;viewSessionIds={...envelope.sessionIds,...envelope.state._sync?.selected};return JSON.stringify(engineView);},setItem(requested,text){
   if(requested!==engineKey)throw new Error('Không được ghi khóa khác ngân hàng.');if(viewEpoch!==envelope.epoch)throw new Error('Tiến độ đã đổi phiên trên máy chủ; xuất bản đang mở rồi tải lại trang.');const state=validateState(JSON.parse(text),identity),next=clone(envelope),delta=diffState(engineView,state,identity),ids={...next.sessionIds,...viewSessionIds,...stagedSessions};
   for(const [kind,change]of Object.entries(delta.sessions))change.id=ids[kind];
   next.state=applyDelta(next.state,delta,(next.state._sync?.revision||0)+1);
   next.state.examHistory=[...new Map([...next.state.examHistory,...state.examHistory].map(r=>[canonical(r),r])).values()];
   next.localVersion++;next.sessionIds=ids;persist(next);
   engineView=validateState({...next.state,study:state.study,exam:state.exam},identity);viewSessionIds=ids;stagedSessions={};
  }},
  getEngineState:()=>clone(engineView),
  getEnvelope:()=>clone(envelope),
  beginSession(kind){assertWriter();if(!['study','exam'].includes(kind))throw new Error('Loại phiên không hợp lệ.');return stagedSessions[kind]=crypto.randomUUID();},
  prepare(options){return persist(prepareBatch(envelope,options),false).inflight.batch;},
  commitAck(ack){validateState(ack.state,identity);return persist(acknowledge(envelope,ack),false);},
  async stageImport(state,id){assertWriter();const guest=validateState(state,identity),epoch=envelope.epoch,ids=Object.fromEntries(await Promise.all(['study','exam'].map(async kind=>[kind,await importSessionID(epoch,id,kind)])));assertWriter();if(envelope.epoch!==epoch)throw new Error('Tiến độ đã đặt lại; hãy xem lại bản nhập.');if(envelope.importReceipts.includes(id)||envelope.pendingImports.some(i=>i.id===id))return clone(envelope);if(envelope.pendingImports.length>=10)throw new Error('Hãy đồng bộ các bản nhập đang chờ trước khi nhập thêm.');const next=clone(envelope);for(const kind of ['study','exam'])if(!next.state[kind]&&guest[kind])next.sessionIds[kind]=ids[kind];next.state=mergeLegacy(next.state,guest,identity);next.pendingImports.push({id,state:guest});next.localVersion++;return persist(next);},
  replaceWithNewEpoch(state){assertWriter();if(envelope.inflight)throw new Error('Cần đồng bộ lô đang gửi hoặc xuất bản lưu trước khi đặt lại.');const next=clone(envelope);next.resetFromEpoch=next.resetFromEpoch??next.epoch;next.epoch=crypto.randomUUID();next.state=validateState(state,identity);next.baseline=blankState();next.cloudRevision=0;next.pendingImports=[];next.importReceipts=[];next.sessionIds={study:crypto.randomUUID(),exam:crypto.randomUUID()};next.localVersion++;return persist(next);},
  acceptRemote(remote){
   assertWriter();if(envelope.inflight)throw new Error('Phải xác nhận lô đang gửi trước khi tải tiến độ.');if(remote.epoch!==envelope.epoch){if(envelope.localVersion===0&&envelope.cloudRevision===0&&!api.hasPending())return api.adoptRemoteEpoch(remote);throw new Error('Xung đột epoch: xuất bản lưu, rồi chọn Dùng bản trên máy chủ để khôi phục.');}if(remote.cloudRevision<envelope.cloudRevision)return clone(envelope);validateState(remote.state,identity);
   const next=clone(envelope),tail=diffState(next.baseline,next.state);for(const [kind,change]of Object.entries(tail.sessions))change.id=next.sessionIds[kind];next.baseline=clone(remote.state);next.cloudRevision=remote.cloudRevision;next.state=applyDelta(remote.state,tail,(remote.state._sync?.revision||0)+1);next.state.examHistory=[...new Map([...remote.state.examHistory,...envelope.state.examHistory].map(r=>[canonical(r),r])).values()];for(const kind of ['study','exam'])if(!tail.sessions[kind]&&remote.state._sync?.selected?.[kind])next.sessionIds[kind]=remote.state._sync.selected[kind];return persist(next,false);
  },
  adoptRemoteEpoch(remote){
   assertWriter();validateState(remote.state,identity);if(!validUID(remote.epoch)||!Number.isSafeInteger(remote.cloudRevision)||remote.cloudRevision<0)throw new Error('Phiên máy chủ không hợp lệ.');
   const next=clone(envelope);next.epoch=remote.epoch;next.cloudRevision=remote.cloudRevision;next.state=clone(remote.state);next.baseline=clone(remote.state);next.inflight=null;next.pendingReports=[];next.pendingImports=[];next.importReceipts=[];delete next.resetFromEpoch;
   next.sessionIds={study:remote.state._sync?.selected?.study||crypto.randomUUID(),exam:remote.state._sync?.selected?.exam||crypto.randomUUID()};return persist(next,false);
  },
  hasPending(){if(envelope.inflight||envelope.pendingImports.length||envelope.resetFromEpoch)return true;const d=diffState(envelope.baseline,envelope.state);return Object.keys(d.progress).length+Object.keys(d.bookmarks).length+Object.keys(d.wrong).length+Object.keys(d.settings).length+Object.keys(d.sessions).length>0||canonical(envelope.baseline.examHistory)!==canonical(envelope.state.examHistory);},
  release(){if(released)return;released=true;owned=false;releaseLock();}
 };return api;
}
