const assert=require('node:assert/strict');
module.exports=async function asyncRaces(page){
 // Three production flows remain pending at the same real Auth logout: a
 // server-committed receipt, image decoding/read, and backup UI emission.
 console.log('ASYNC_RACE prepare');
 await page.evaluate(async()=>{
  const {mountBackupUI}=await import('/workspace/backup-ui.js');
  Q.downloads=[];const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)Q.downloads.push(this.download);else click.call(this);};
  const host=document.createElement('div');document.body.append(host);Q.backupUI=mountBackupUI({element:host,session:Q.session,openDialog:(_title,body)=>{const dialog=document.createElement('dialog');dialog.innerHTML=body;document.body.append(dialog);dialog.showModal();return dialog;}});
  Q.releases=[];const arrayBuffer=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=function(){if(this.type==='image/png')return new Promise((resolve,reject)=>Q.releases.push(()=>arrayBuffer.call(this).then(resolve,reject)));return arrayBuffer.call(this);};
  const next=Q.session.view(),form=Q.session.captureForm();next.flights[0].note='Old account image flow';const canvas=document.createElement('canvas');canvas.width=7;canvas.height=7;const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));Q.pendingImage=Q.session.saveView({...form,next,evidenceFile:{id:next.flights[0].id,file:blob},confirmActualReplacement:true}).then(()=>Q.imageResult='saved',e=>Q.imageResult=e.message);
 });
 console.log('ASYNC_RACE start export');
 await page.locator('[data-workspace-backup=export]').click();await page.locator('[data-export-next]').click();await page.waitForFunction(()=>Q.releases.length===2);
 console.log('ASYNC_RACE stage held ack');
 const uid=await page.evaluate(async()=>{Q.holdAck=true;const form=Q.session.captureForm(),next=Q.session.view();next.flights[0].note='Receipt held across account switch';await Q.session.saveView({...form,next});Q.pendingSync=Q.controller.syncNow();return Q.session.uid;});
 await page.waitForFunction(()=>Q.ackHeld===true);
 console.log('ASYNC_RACE logout and release');
 await page.evaluate(async()=>{await Q.account.logout();for(const release of Q.releases.splice(0))release();Q.releaseAck();});
 await page.waitForFunction(()=>typeof Q.imageResult==='string'&&document.querySelector('[data-export-status]')?.textContent.match(/đổi|Tài khoản|tài khoản/));
 console.log('ASYNC_RACE check durable state');
 const result=await page.evaluate(async uid=>{await Promise.race([Promise.all([Q.pendingSync,Q.pendingImage]),new Promise((_,reject)=>setTimeout(()=>reject(Error("Async guard promises did not settle: "+Q.imageResult)),15000))]);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('avilog-workspaces-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const pending=await new Promise((resolve,reject)=>{const r=db.transaction('outbox').objectStore('outbox').index('byUID').getAll(IDBKeyRange.only(uid));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return{imageResult:Q.imageResult,downloads:Q.downloads,pending:pending.length,selected:Q.coordinator.getCachedSelection()};},uid);
 assert.match(result.imageResult,/đổi|Tài khoản|tài khoản/);assert.deepEqual(result.downloads,[]);assert.equal(result.pending,1);assert.equal(result.selected,null);console.log('ASYNC_RACE durable state passed');return{pendingImageGuard:true,backupEmissionGuard:true,committedAckGuard:true};
};
