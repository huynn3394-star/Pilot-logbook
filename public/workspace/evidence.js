import {validateEvidence,sha256} from './schema.js';
export const MAX_EVIDENCE_BYTES=6*1024*1024;
function signature(data){
 if(data.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v))return'image/png';
 if(data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255)return'image/jpeg';
 if(data.length>=12&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP')return'image/webp';return null;
}
async function decode(blob){
 if(typeof globalThis.createImageBitmap==='function'){let bitmap;try{bitmap=await createImageBitmap(blob);if(!bitmap.width||!bitmap.height)throw Error();}catch{throw new Error('Không giải mã được ảnh minh chứng.');}finally{bitmap?.close();}return;}
 if(!globalThis.Image||!globalThis.URL?.createObjectURL)throw new Error('Trình duyệt chưa hỗ trợ giải mã ảnh.');
 const url=URL.createObjectURL(blob);try{await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth&&img.naturalHeight?resolve():reject(Error('Không giải mã được ảnh.'));img.onerror=()=>reject(Error('Không giải mã được ảnh.'));img.src=url;});}finally{URL.revokeObjectURL(url);}
}
export async function prepareEvidence(blob){
 if(!(blob instanceof Blob)||blob.size<=0||blob.size>MAX_EVIDENCE_BYTES||!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error('Chỉ nhận ảnh JPG/PNG/WebP lớn hơn 0 và tối đa 6 MiB.');
 const data=await blob.arrayBuffer();if(signature(new Uint8Array(data))!==blob.type)throw new Error('Nội dung ảnh khác MIME đã khai báo.');await decode(blob);
 return{blob,ref:{sha256:await sha256(data),mime:blob.type,bytes:blob.size,cloudReady:false}};
}
export async function verifyEvidence(ref,blob){validateEvidence(ref);if(!(blob instanceof Blob)||blob.size!==ref.bytes||blob.type!==ref.mime)throw new Error('Số byte/loại ảnh không khớp.');const prepared=await prepareEvidence(blob);if(prepared.ref.sha256!==ref.sha256)throw new Error('SHA-256 ảnh không khớp.');return blob;}
