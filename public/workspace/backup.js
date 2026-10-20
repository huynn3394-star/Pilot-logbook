import {clone,canonical,sha256,bytes,validateRecord,validateEvidence,validUID} from './schema.js';
import {verifyEvidence} from './evidence.js';
import {previewMigration,previewRecords,stageMigration,blobFromDataURL} from './migration.js';
const LIMIT=50*1024*1024,key=r=>r.kind+'\0'+r.id;
async function contentHash(record){const value=clone(record);value.revision=0;delete value.data.updatedAt;if(value.evidence)value.evidence.cloudReady=false;return sha256(canonical(value));}
const rank={person:0,duty:1,profile:2,preferences:3,flight:4},sortKeys=(a,b)=>rank[a.split('\0')[0]]-rank[b.split('\0')[0]]||(a<b?-1:a>b?1:0);
export async function captureBackup({repository,token}){if(token?.uid!==repository.uid)throw Error('Tài khoản backup đã đổi.');return{uid:repository.uid,backupSetId:crypto.randomUUID(),...await repository.exportCapture(token)};}
function dataURL(blob){return blob.arrayBuffer().then(buffer=>{const data=new Uint8Array(buffer);let raw='';for(let i=0;i<data.length;i+=32768)raw+=String.fromCharCode(...data.subarray(i,i+32768));return'data:'+blob.type+';base64,'+btoa(raw);});}
const payloadHash=payload=>sha256(canonical(payload));
const headerFor=capture=>({uid:capture.uid,schemaVersion:1,cloudRevision:capture.snapshot.cloudRevision,localVersion:capture.snapshot.localVersion});
export async function* exportBackupParts({capture,loadBlob,allowMissing=false,maxBytes=LIMIT}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>LIMIT)throw Error('Giới hạn phần backup không hợp lệ.');
 const header=headerFor(capture),units=[],missing=[],recordManifest=[];
 for(const record of [...capture.snapshot.records].sort((a,b)=>sortKeys(key(a),key(b)))){validateRecord(record);const content=clone(record);content.revision=0;delete content.data.updatedAt;if(content.evidence)content.evidence.cloudReady=false;recordManifest.push({key:key(record),sha256:await sha256(canonical(record)),contentHash:await sha256(canonical(content))});units.push({entry:{type:'record',record:clone(record)}});}
 for(const [type,values]of[['operation',capture.operations],['conflict',capture.conflicts],['recovery',capture.recoveries],['transfer',capture.transfers]])for(const value of values||[]){const safe=type==='transfer'?Object.fromEntries(Object.entries(value).filter(([k])=>['id','hash','direction','state','bytes','total','message'].includes(k))):clone(value);units.push({entry:{type,value:safe}});}
 for(const ref of capture.evidenceRefs){validateEvidence(ref);let blob;try{blob=await loadBlob(ref.sha256,ref);if(!blob)throw Error('Thiếu byte ảnh trên máy.');await verifyEvidence(ref,blob);}catch(error){if(!allowMissing)throw error;missing.push({hash:ref.sha256,message:error.message});}
  const absent=missing.find(item=>item.hash===ref.sha256);units.push({ref:clone(ref),absent:absent?.message||null,dataLength:absent?0:('data:'+ref.mime+';base64,').length+4*Math.ceil(ref.bytes/3)});
 }
 async function entryFor(unit){if(unit.entry)return clone(unit.entry);if(unit.absent)return{type:'image',ref:unit.ref,dataURL:null,missing:unit.absent};const blob=await loadBlob(unit.ref.sha256,unit.ref);if(!blob)throw Error('Byte ảnh thay đổi trong lúc xuất.');await verifyEvidence(unit.ref,blob);return{type:'image',ref:unit.ref,dataURL:await dataURL(blob)};}
 const sizeFor=unit=>unit.entry?bytes(unit.entry):bytes(unit.absent?{type:'image',ref:unit.ref,dataURL:null,missing:unit.absent}:{type:'image',ref:unit.ref,dataURL:''})+unit.dataLength;
 const manifestFor=total=>({complete:missing.length===0,missingImages:missing,evidence:clone(capture.evidenceRefs),records:recordManifest,parts:Array.from({length:total},(_,index)=>({index,sha256:'0'.repeat(64)}))});
 const envelope=(index,payload,manifest)=>({format:'avilog-workspace-backup',version:2,backupSetId:capture.backupSetId,sourceUID:capture.uid,index,total:manifest.parts.length,manifest,payload});
 let groups=[],total=1;
 for(let attempt=0;attempt<20;attempt++){
  const manifest=manifestFor(total);groups=[];let group=[],size=0;
  for(const unit of units){const extra=sizeFor(unit)+(group.length?1:0),overhead=bytes(envelope(groups.length,{header,entries:[]},manifest));
   if(group.length&&overhead+size+extra>maxBytes){groups.push(group);group=[];size=0;}
   if(bytes(envelope(groups.length,{header,entries:[]},manifest))+size+sizeFor(unit)+(group.length?1:0)>maxBytes)throw Error('Một mục backup vượt giới hạn phần; không cắt dữ liệu.');
   size+=sizeFor(unit)+(group.length?1:0);group.push(unit);
  }if(group.length||!groups.length)groups.push(group);if(groups.length===total)break;total=groups.length;if(attempt===19)throw Error('Không chia được manifest backup.');
 }
 const manifest=manifestFor(groups.length);
 async function payloadFor(group){const entries=[];for(const unit of group)entries.push(await entryFor(unit));return{header,entries};}
 // Hash one bounded part at a time, then regenerate it from the pinned snapshot.
 for(let i=0;i<groups.length;i++)manifest.parts[i].sha256=await payloadHash(await payloadFor(groups[i]));
 for(let i=0;i<groups.length;i++){const payload=await payloadFor(groups[i]);if(await payloadHash(payload)!==manifest.parts[i].sha256)throw Error('Byte backup đã đổi trong lúc xuất.');const jsonText=JSON.stringify(envelope(i,payload,manifest));if(new TextEncoder().encode(jsonText).length>maxBytes)throw Error('Phần backup vượt giới hạn.');yield{filename:`avilog-${capture.backupSetId}-part-${i+1}-of-${groups.length}.json`,jsonText};}
}
async function readPart(file){const text=await file.text();if(new TextEncoder().encode(text).length>LIMIT)throw Error('Mỗi phần backup tối đa 50 MiB.');let value;try{value=JSON.parse(text);}catch{throw Error('JSON backup không hợp lệ.');}return{value,text};}
async function validatePart(value){
 if(value?.format==='avilog-workspace-recovery')throw Error('Gói recovery phục hồi cần xem nguồn; không tự phát lại operation cũ.');
 if(value?.format!=='avilog-workspace-backup'||value.version!==2||typeof value.backupSetId!=='string'||!Array.isArray(value.manifest?.parts)||!Array.isArray(value.manifest.evidence)||!Array.isArray(value.manifest.records)||!Array.isArray(value.manifest.missingImages)||!Array.isArray(value.payload?.entries)||!Number.isSafeInteger(value.index)||value.index<0||value.total!==value.manifest.parts.length||value.index>=value.total)throw Error('Định dạng phần backup không hợp lệ.');
 const part=value.manifest.parts[value.index];if(part.index!==value.index||!/^[a-f0-9]{64}$/.test(part.sha256)||await payloadHash(value.payload)!==part.sha256)throw Error('SHA-256 payload backup không khớp.');
 if(value.payload.header?.schemaVersion!==1||!Number.isSafeInteger(value.payload.header.cloudRevision)||!Number.isSafeInteger(value.payload.header.localVersion))throw Error('Revision backup không hợp lệ.');
 return value;
}
export async function previewRestore({parts,targetUID,current,selectedIds,includeDemo=false,loadRestoreProgress=async()=>null}){
 if(!validUID(targetUID)||current.uid!==targetUID)throw Error('Tài khoản đích không khớp.');const files=[],records=[],images=[],seen=new Map();let first=null,identity=null,legacy=null;
 for await(const file of parts){const {value,text}=await readPart(file);
  if(value.version===1&&!value.format){if(files.length||legacy)throw Error('Không trộn backup v1 với bộ nhiều phần.');legacy=await previewMigration({source:value,sourceText:text,current,selectedIds,includeDemo});files.push({file,legacy:true,hash:await sha256(text)});continue;}
  if(legacy)throw Error('Không trộn backup v1 với bộ nhiều phần.');await validatePart(value);
  const signature=canonical({backupSetId:value.backupSetId,sourceUID:value.sourceUID,total:value.total,manifest:value.manifest,header:value.payload.header});if(!first){first=value;identity=signature;}else if(signature!==identity)throw Error('Lẫn bộ backup/set hoặc manifest khác nhau.');
  const partHash=value.manifest.parts[value.index].sha256;if(seen.has(value.index)){if(seen.get(value.index)!==partHash)throw Error('Phần trùng chỉ số khác hash.');continue;}seen.set(value.index,partHash);files.push({file,index:value.index,hash:partHash});
  for(const entry of value.payload.entries){if(entry.type==='record'){validateRecord(entry.record);const expected=value.manifest.records.find(r=>r.key===key(entry.record));if(!expected||expected.sha256!==await sha256(canonical(entry.record)))throw Error('Hash bản ghi backup không khớp manifest.');records.push(entry.record);}else if(entry.type==='image'){validateEvidence(entry.ref);if(entry.dataURL!==null)await verifyEvidence(entry.ref,blobFromDataURL(entry.dataURL));images.push({ref:entry.ref,partIndex:value.index,missing:entry.dataURL===null});}else if(!['operation','conflict','recovery','transfer'].includes(entry.type))throw Error('Mục backup chưa hỗ trợ.');}
 }
 if(legacy)return{...legacy,files,legacy:true,missingParts:[],missingImages:legacy.missingImages||[]};if(!first)throw Error('Chưa chọn phần backup.');
 const manifest=first.manifest,recordKeys=manifest.records.map(r=>r.key);if(new Set(recordKeys).size!==recordKeys.length)throw Error('Manifest có ID bản ghi trùng.');if(recordKeys.filter(k=>k.startsWith('flight\0')).length>10000)throw Error('Backup vượt 10.000 chuyến.');
 const restoreIdentity=await sha256(identity),progress=await loadRestoreProgress(restoreIdentity),resumeRecords=[];
 if(progress&&(progress.targetUID!==targetUID||progress.identity!==restoreIdentity||!Array.isArray(progress.entries)||!Array.isArray(progress.partIndices)||!Array.isArray(progress.imageHashes)))throw Error('Tiến độ khác bộ backup.');
 for(const entry of progress?.entries||[]){if(!manifest.records.some(r=>r.key===entry.sourceKey)||selectedIds&&!selectedIds.includes(entry.sourceKey))continue;const existing=current.records.find(r=>key(r)===entry.targetKey);if(existing&&await contentHash(existing)===entry.contentHash)resumeRecords.push({...clone(entry),record:clone(existing)});}
 const availableParts=new Set([...seen.keys(),...(progress?.partIndices||[])]),missingParts=manifest.parts.filter(p=>!availableParts.has(p.index)).map(p=>p.index),refs=new Map(records.filter(r=>r.evidence).map(r=>[r.evidence.sha256,r.evidence]));
 for(const ref of manifest.evidence)validateEvidence(ref);
 const missingImages=[...new Set([...refs.keys(),...manifest.evidence.map(r=>r.sha256)])].filter(hash=>!images.some(i=>i.ref.sha256===hash&&!i.missing)&&!progress?.imageHashes.includes(hash));
 for(const record of records)if(record.evidence)record.evidence={...record.evidence,cloudReady:false};
 for(const image of images)image.ref={...image.ref,cloudReady:false};
 const preview=await previewRecords({records,current,selectedIds,images,raw:{source:{format:'avilog-workspace-backup',version:2,backupSetId:first.backupSetId,sourceUID:first.sourceUID,manifest:clone(manifest)},sourceFiles:files.map(f=>({name:f.file.name,index:f.index,hash:f.hash}))}});
 const selectedKeys=(selectedIds?recordKeys.filter(k=>selectedIds.includes(k)):recordKeys).sort(sortKeys);
 preview.importHash=await sha256(canonical(manifest.records.filter(r=>selectedKeys.includes(r.key)).map(r=>({key:r.key,contentHash:r.contentHash})).sort((a,b)=>sortKeys(a.key,b.key))));
 // Stable source positions allow completed groups to resume when other files are
 // supplied later. An incomplete group waits, rather than changing a prior receipt body.
 const changes=new Map(preview.changes.map(c=>[key(c),c]));preview.parts=[];const waitingRecords=[];
 const mapped=new Map(records.map(r=>{const collision=preview.collisions.find(c=>c.kind==='flight'&&c.id===r.id);return[key(r),collision?.targetId?changes.get('flight\0'+collision.targetId):changes.get(key(r))];}));
 const resumed=new Set(resumeRecords.map(r=>r.sourceKey));
 for(let i=0;i<selectedKeys.length;i+=3){const keys=selectedKeys.slice(i,i+3);if(keys.every(k=>resumed.has(k)))continue;if(keys.every(k=>mapped.get(k))){preview.parts.push({index:i/3,sourceKeys:keys,changes:keys.map(k=>mapped.get(k)),importPart:{hash:preview.importHash,index:i/3,total:Math.ceil(selectedKeys.length/3)}});}else waitingRecords.push(...keys.filter(k=>!mapped.get(k)&&!resumed.has(k)));}
 const wanted=new Set(resumeRecords.map(r=>r.record.evidence?.sha256).filter(Boolean));preview.images=[...new Map([...preview.images,...images.filter(i=>wanted.has(i.ref.sha256))].map(i=>[i.ref.sha256,i])).values()];preview.bytes=preview.images.reduce((n,i)=>n+i.ref.bytes,0);
 return{...preview,files,identity,restoreIdentity,progress:clone(progress),resumeRecords,sourceImages:images.filter(i=>!i.missing).map(i=>i.ref.sha256),manifest:clone(manifest),missingParts,missingImages,waitingRecords,complete:preview.complete&&!missingParts.length&&!missingImages.length&&!waitingRecords.length&&manifest.complete===true};
}
export async function stageRestore({repository,preview,confirm,token}){
 if(repository.uid!==preview.targetUID||token?.uid!==preview.targetUID)throw Error('Tài khoản đích đã đổi.');if(preview.blockedRows.length)throw Error('Còn bản ghi không hợp lệ; chọn lại trước khi nhập.');if(!await confirm(preview))return false;
 if(preview.legacy){const {text}=await readPart(preview.files[0].file);if(await sha256(text)!==preview.files[0].hash)throw Error('File đã đổi sau preview.');return stageMigration({repository,preview,confirm:async()=>true,token});}
 const queued=await repository.pending?.()||[],resumed=new Map((preview.resumeRecords||[]).map(r=>[r.targetKey,r]));
 const affected=new Set([...preview.changes.map(key),...resumed.keys()]);
 for(const op of queued)for(const change of op.changes){if(!affected.has(key(change)))continue;const prior=resumed.get(key(change));if(!prior||op.importPart?.hash!==prior.importHash||await contentHash(change.next)!==prior.contentHash)throw Error('Bản ghi đang có thay đổi chưa gửi; hãy đồng bộ hoặc xử lý trước khi restore.');}
 if(repository.read){const latest=await repository.read();for(const entry of resumed.values()){const record=latest.records.find(r=>key(r)===entry.targetKey);if(!record||await contentHash(record)!==entry.contentHash)throw Error('Bản ghi đã đổi sau preview restore.');}}
 // Save every supplied raw part durably before staging any domain operation.
 for(const descriptor of preview.files){const {value,text}=await readPart(descriptor.file);await validatePart(value);if(await payloadHash(value.payload)!==descriptor.hash||canonical({backupSetId:value.backupSetId,sourceUID:value.sourceUID,total:value.total,manifest:value.manifest,header:value.payload.header})!==preview.identity)throw Error('File/hash đã đổi sau preview.');await repository.saveRecovery({format:'avilog-workspace-recovery',version:1,sourceText:text,sourceName:descriptor.file.name,backupSetId:value.backupSetId,index:value.index},token);}
 let cachedIndex=null,cached=null;
 async function loadImage(image){if(cachedIndex!==image.partIndex){const descriptor=preview.files.find(f=>f.index===image.partIndex),{value}=await readPart(descriptor.file);await validatePart(value);if(await payloadHash(value.payload)!==descriptor.hash)throw Error('Hash ảnh đã đổi sau preview.');cached=value;cachedIndex=image.partIndex;}const entry=cached.payload.entries.find(e=>e.type==='image'&&e.ref.sha256===image.ref.sha256);if(!entry?.dataURL)return null;const blob=blobFromDataURL(entry.dataURL);await verifyEvidence(image.ref,blob);return{ref:image.ref,blob};}
 const progress={identity:preview.restoreIdentity,targetUID:preview.targetUID,entries:clone(preview.progress?.entries||[]),partIndices:[...new Set([...(preview.progress?.partIndices||[]),...preview.files.map(f=>f.index)])],imageHashes:[...new Set([...(preview.progress?.imageHashes||[]),...preview.sourceImages])]},savedHashes=new Set();
 const transfers=images=>images.filter(i=>!i.ref.cloudReady).map(i=>({id:'upload-'+i.ref.sha256,hash:i.ref.sha256,direction:'upload',state:'pending'}));
 for(const part of preview.parts){const images=[];for(const hash of new Set(part.changes.filter(c=>c.next.evidence).map(c=>c.next.evidence.sha256))){const image=preview.images.find(i=>i.ref.sha256===hash&&!i.missing);if(image){const item=await loadImage(image);if(item){images.push(item);savedHashes.add(hash);}}}
  for(let i=0;i<part.changes.length;i++){const change=part.changes[i],entry={sourceKey:part.sourceKeys[i],targetKey:key(change),contentHash:await contentHash(change.next),importHash:part.importPart.hash};if(change.next.evidence)entry.evidence=clone(change.next.evidence);progress.entries=progress.entries.filter(r=>r.sourceKey!==entry.sourceKey);progress.entries.push(entry);}
  await repository.save({changes:part.changes,blobs:images,transfers:transfers(images),importPart:part.importPart,restoreProgress:progress,token});
 }
 // Image-only continuation writes verified originals and progress atomically;
 // the already queued metadata operation is not re-created or replayed.
 let extraSaved=false;for(const image of preview.images.filter(i=>!i.missing&&!savedHashes.has(i.ref.sha256))){const item=await loadImage(image);if(item){await repository.save({changes:[],blobs:[item],transfers:transfers([item]),restoreProgress:progress,token});extraSaved=true;}}
 if(!extraSaved&&!preview.parts.length)await repository.save({changes:[],restoreProgress:progress,token});return true;
}
