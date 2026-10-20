import {verifyEvidence} from './evidence.js';
export function createTransfers({account,repository,coordinator,transportFactory=()=>account.evidenceTransport(),onStatus=()=>{}}){
 const token=coordinator.capture(),abort=new AbortController();let stopped=false,transport=null,uploading=null,downloading=null,current={kind:'local',pending:0,total:0,offlineReady:0,missing:0,errors:[],bytes:0};
 const alive=()=>!stopped&&coordinator.isCurrent(token)&&token.uid===repository.uid;
 const guard=()=>{if(!alive())throw new Error('Tài khoản đã đổi; dừng truyền ảnh.');};
 const report=patch=>{if(alive()){current={...current,...patch};onStatus({...current,errors:[...current.errors]});}};
 function stop(){if(stopped)return;stopped=true;abort.abort();transport?.close();offCoordinator();offAccount();}
 const offCoordinator=coordinator.subscribe(()=>{if(!alive())stop();}),offAccount=account.subscribe(()=>{if(!alive())stop();});
 async function ready(){guard();if(globalThis.navigator?.onLine===false)throw Error('Offline · ảnh gốc trên máy được giữ để thử lại khi có mạng.');if(!repository.writable)throw Error('Workspace chỉ đọc.');if(!account.config.enabled||!account.config.evidenceSyncEnabled)throw Error('Đồng bộ ảnh chưa được kích hoạt.');if(await account.validateSession()!==repository.uid)throw Error('Cần đăng nhập lại để truyền ảnh.');guard();return transport??=transportFactory();}
 async function refs(){const snapshot=await repository.read();guard();return[...new Map(snapshot.records.filter(r=>r.evidence).map(r=>[r.evidence.sha256,r.evidence])).values()];}
 let active=0;const waiting=[];
 async function slot(work){if(active<2)active++;else await new Promise(resolve=>waiting.push(resolve));try{guard();return await work();}finally{const next=waiting.shift();if(next)next();else active--;}}
 async function workers(items,work){let index=0;await Promise.all(Array.from({length:Math.min(2,items.length)},async()=>{while(alive()&&index<items.length){const item=items[index++];await slot(()=>work(item));}}));}
 async function uploadRun(){
  if(!alive())return;const errors=[];try{
   const all=await refs(),pending=all.filter(r=>!r.cloudReady);report({kind:pending.length?'uploading':'ready',total:all.length,pending:pending.length,errors});if(!pending.length)return;
   const remote=await ready();let remaining=pending.length;
   await workers(pending,async ref=>{
    const id='upload-'+ref.sha256;try{
     const blob=await repository.getBlob(ref.sha256,token);guard();if(!blob)throw Error('Ảnh gốc chưa có trên máy này; cần mở máy đã thêm ảnh.');
     await repository.setTransfer({id,hash:ref.sha256,direction:'upload',state:'uploading',bytes:0,total:ref.bytes},token);guard();
     await remote.upload({ref,blob,signal:abort.signal,onProgress:bytes=>{if(alive())report({bytes});}});guard();
     const snapshot=await repository.read();guard();const changes=snapshot.records.filter(r=>r.evidence?.sha256===ref.sha256&&!r.evidence.cloudReady).map(r=>({kind:r.kind,id:r.id,base:r,next:{...r,evidence:{...r.evidence,cloudReady:true}}}));
     if(changes.length)await repository.save({changes,token});guard();await repository.setTransfer({id,hash:ref.sha256,direction:'upload',state:'complete',bytes:ref.bytes,total:ref.bytes},token);guard();remaining--;report({pending:remaining});
    }catch(error){if(!alive())return;errors.push({hash:ref.sha256,message:error.message});await repository.setTransfer({id,hash:ref.sha256,direction:'upload',state:'error',message:error.message},token);}
   });report({kind:errors.length?'error':'ready',pending:(await refs()).filter(r=>!r.cloudReady).length,errors});
  }catch(error){if(alive())report({kind:'error',errors:[...errors,{message:error.message}]});}
 }
 function pump(){if(!alive())return Promise.resolve();if(uploading)return uploading;uploading=uploadRun().finally(()=>uploading=null);return uploading;}
 async function downloadRun(){
  if(!alive())return;const errors=[];let complete=0,missing=0,bytes=0;try{
   const all=await refs();report({kind:'downloading',total:all.length,offlineReady:0,missing:0,errors,bytes:0});
   await workers(all,async ref=>{try{
    let blob=await repository.getBlob(ref.sha256,token);guard();
    if(blob)await verifyEvidence(ref,blob);
    else{if(!ref.cloudReady)throw Error('Ảnh chưa tải lên từ máy nguồn.');const remote=await ready();blob=await remote.download(ref,{signal:abort.signal});guard();await verifyEvidence(ref,blob);guard();await repository.putBlob(ref,blob,token);guard();}
    complete++;bytes+=blob.size;report({offlineReady:complete,bytes});
   }catch(error){if(alive()){missing++;errors.push({hash:ref.sha256,message:error.message});}}});
   report({kind:missing?'error':'offline-ready',offlineReady:complete,missing,bytes,errors});
  }catch(error){if(alive())report({kind:'error',errors:[...errors,{message:error.message}]});}
 }
 function downloadAll(){if(!alive())return Promise.resolve();if(downloading)return downloading;downloading=downloadRun().finally(()=>downloading=null);return downloading;}
 return{pump,downloadAll,status:()=>({...current,errors:[...current.errors]}),async releaseCached(hash,t=token){guard();if(t.uid!==token.uid||t.generation!==token.generation)throw Error('Tài khoản đã đổi.');return repository.releaseBlob(hash,t);},stop};
}
