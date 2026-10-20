import {ref as storageRef,getBytes,getMetadata,uploadBytesResumable} from 'firebase/storage';
import {validUID,validateEvidence} from './schema.js';
import {verifyEvidence,MAX_EVIDENCE_BYTES} from './evidence.js';
export function createEvidenceTransport({storage,uid,getAuthGeneration=()=>0}){
 if(!validUID(uid))throw Error('UID ảnh không hợp lệ.');const generation=getAuthGeneration(),tasks=new Set();let closed=false;
 const guard=signal=>{if(closed||generation!==getAuthGeneration()||signal?.aborted)throw new Error('Tài khoản đã đổi hoặc truyền ảnh đã hủy.');};
 const object=ref=>{validateEvidence(ref);return storageRef(storage,`users/${uid}/evidence/v1/${ref.sha256}`);};
 async function download(ref,{signal}={}){
  guard(signal);const target=object(ref),metadata=await getMetadata(target);guard(signal);
  if(metadata.size!==ref.bytes||metadata.contentType!==ref.mime||metadata.customMetadata?.sha256!==ref.sha256)throw Error('Metadata ảnh trên cloud không khớp.');
  const data=await getBytes(target,MAX_EVIDENCE_BYTES);guard(signal);const blob=new Blob([data],{type:metadata.contentType});await verifyEvidence(ref,blob);guard(signal);return blob;
 }
 async function upload({ref,blob,onProgress=()=>{},signal}){
  guard(signal);await verifyEvidence(ref,blob);guard(signal);
  try{await download(ref,{signal});return;}catch(error){if(error.code!=='storage/object-not-found')throw error;}
  const data=new Uint8Array(await blob.arrayBuffer());guard(signal);
  const task=uploadBytesResumable(object(ref),data,{contentType:ref.mime,customMetadata:{sha256:ref.sha256,schemaVersion:'1'}});tasks.add(task);
  const cancel=()=>task.cancel();signal?.addEventListener('abort',cancel,{once:true});
  let failure;try{await new Promise((resolve,reject)=>{task.on('state_changed',snapshot=>{try{guard(signal);onProgress(snapshot.bytesTransferred);}catch(error){task.cancel();reject(error);}},reject,resolve);});}catch(error){failure=error;}finally{tasks.delete(task);signal?.removeEventListener('abort',cancel);}
  guard(signal);
  // The upload may have committed before its response was lost. An authenticated,
  // bounded read proves the immutable object; never overwrite to recover a retry.
  try{await download(ref,{signal});}catch(error){throw failure||error;}guard(signal);
 }
 return{upload,download,close(){if(closed)return;closed=true;for(const task of tasks)task.cancel();tasks.clear();}};
}
