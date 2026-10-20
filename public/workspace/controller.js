const transient=new Set(['unavailable','deadline-exceeded','aborted','resource-exhausted','workspace/unstable-snapshot']);
const authentication=new Set(['unauthenticated','permission-denied','auth/user-token-expired','auth/invalid-user-token','auth/user-disabled','auth/user-not-found','auth/invalid-refresh-token']);
const key=r=>r.kind+'\0'+(r.recordId??r.id);
export function createWorkspaceController({account,repository,coordinator,transportFactory=()=>account.workspaceTransport(),onStatus=()=>{},online=()=>globalThis.navigator?.onLine!==false,scheduler={setTimeout:(...args)=>globalThis.setTimeout(...args),clearTimeout:id=>globalThis.clearTimeout(id),random:Math.random}}){
 const token=coordinator.capture();let stopped=false,running=null,timer=null,transport=null,unlisten=()=>{},retries=0,knownRevision=0,current={kind:'local'};
 const alive=()=>!stopped&&coordinator.isCurrent(token)&&token.uid===repository.uid;
 const guard=()=>{if(!alive())throw new Error('Tài khoản đã đổi; dừng đồng bộ.');};
 const set=value=>{if(alive()){current=value;onStatus({...value});}};
 const clear=()=>{if(timer!==null)scheduler.clearTimeout(timer);timer=null;};
 const disconnect=()=>{unlisten();unlisten=()=>{};transport?.close();transport=null;};
 const cancelIfChanged=()=>{if(!alive()){clear();disconnect();}};
 const offCoordinator=coordinator.subscribe(cancelIfChanged),offAccount=account.subscribe(cancelIfChanged);
 function arm(delay){clear();timer=scheduler.setTimeout(()=>{timer=null;return syncNow();},delay);timer?.unref?.();}
 function schedule(){if(!alive())return;set({kind:online()?'pending':'offline'});if(online())arm(2000);}
 async function pull(){const snapshot=await transport.pull();guard();await repository.acceptRemote(snapshot,token);guard();knownRevision=snapshot.cloudRevision;}
 async function run(){
  if(!alive())return;
  if(!account.config.enabled||!account.config.workspaceSyncEnabled){set({kind:'disabled'});return;}
  if(!online()){set({kind:'offline'});return;}
  if(!repository.writable){set({kind:'readonly'});return;}
  if(account.currentUser()?.uid!==repository.uid){set({kind:'reauth'});return;}
  set({kind:'syncing'});
  try{
   const authenticated=await account.validateSession();guard();if(authenticated!==repository.uid)throw Object.assign(new Error('Cần đăng nhập lại đúng tài khoản.'),{code:'unauthenticated'});
   if(!transport){transport=transportFactory();unlisten=transport.subscribe(revision=>{if(alive()&&revision>knownRevision)schedule();},error=>{if(alive())set({kind:authentication.has(error.code)?'reauth':'error',message:error.message});});}
   knownRevision=(await repository.read()).cloudRevision;guard();
   if(!(await repository.pending()).length)await pull();
   const attempted=new Set();
   while(alive()){
    const pending=await repository.pending(),conflicts=await repository.conflicts();guard();
    const pendingIds=new Set(pending.map(o=>o.operationId));
    // A local prediction for an operation still in the outbox cannot establish its
    // server outcome: retry that immutable body to recover a possibly lost receipt.
    const blocked=new Set(conflicts.filter(c=>!pendingIds.has(c.operationId)).map(key));
    const next=pending.find(o=>!attempted.has(o.operationId)&&!o.parents.some(id=>pendingIds.has(id))&&o.changes.some(c=>!blocked.has(key(c))));
    if(!next)break;attempted.add(next.operationId);
    await account.validateSession();guard();const ack=await transport.commit(next);guard();
    try{await repository.acceptAck(ack,token);}catch(error){if(error.code!=='workspace/requires-pull')throw error;await pull();await repository.acceptAck(ack,token);}guard();knownRevision=Math.max(knownRevision,ack.revision);
   }
   const pending=await repository.pending(),conflicts=await repository.conflicts();guard();retries=0;
   set({kind:conflicts.length?'conflict':pending.length?'pending':'synced',pending:pending.length,conflicts:conflicts.length,at:Date.now()});
  }catch(error){
   if(!alive())return;const kind=authentication.has(error.code)?'reauth':!online()?'offline':error.code==='workspace/unstable-snapshot'?'pending':'error';set({kind,message:error.message});
   if(transient.has(error.code)&&retries<5)arm(Math.min(60000,2000*2**retries++)*(.8+.4*scheduler.random()));
  }
 }
 function syncNow(){if(!alive())return Promise.resolve();clear();if(running)return running;running=run().finally(()=>{running=null;});return running;}
 return{syncNow,schedule,status:()=>({...current}),stop(){if(stopped)return;stopped=true;clear();disconnect();offAccount();offCoordinator();}};
}
