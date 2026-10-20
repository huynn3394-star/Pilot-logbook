import {test,before,beforeEach,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,uploadBytes,getBytes,deleteObject,updateMetadata,listAll} from 'firebase/storage';
import {createEvidenceTransport} from '../public/workspace/evidence-transport.js';
import {prepareEvidence} from '../public/workspace/evidence.js';
let env,a,b,guest,nonGoogle;const hash='a'.repeat(64),path='users/alice/evidence/v1/'+hash,metadata={contentType:'image/png',customMetadata:{sha256:hash,schemaVersion:'1'}};
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==','base64'));
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-atpl-sync',storage:{host:'127.0.0.1',port:9199,rules:await readFile('firebase/storage.rules','utf8')}});a=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).storage()._delegate;b=env.authenticatedContext('bob',{firebase:{sign_in_provider:'google.com'}}).storage()._delegate;guest=env.unauthenticatedContext().storage()._delegate;nonGoogle=env.authenticatedContext('alice',{firebase:{sign_in_provider:'password'}}).storage()._delegate;});
beforeEach(()=>env.withSecurityRulesDisabled(async context=>{async function clear(prefix){const listing=await prefix.listAll();for(const nested of listing.prefixes)await clear(nested);await Promise.all(listing.items.map(item=>item.delete()));}await clear(context.storage().ref());}));after(()=>env?.cleanup());
test('only owning Google UID can create/read; cross-user, guest, non-Google, path tampering and listing fail',async()=>{
 await assertSucceeds(uploadBytes(ref(a,path),png,metadata));assert.equal((await assertSucceeds(getBytes(ref(a,path)))).byteLength,png.length);
 for(const storage of[b,guest,nonGoogle]){await assertFails(getBytes(ref(storage,path)));await assertFails(uploadBytes(ref(storage,'users/alice/evidence/v1/'+'b'.repeat(64)),png,{...metadata,customMetadata:{...metadata.customMetadata,sha256:'b'.repeat(64)}}));}
 await assertFails(listAll(ref(a,'users/alice/evidence/v1')));await assertFails(uploadBytes(ref(a,'users/alice/other/'+hash),png,metadata));
});
test('immutable objects reject overwrite metadata/delete and 0/6MiB+1, wrong MIME or digest metadata',async()=>{
 await assertSucceeds(uploadBytes(ref(a,path),new Uint8Array(6*1024*1024),metadata));await assertFails(uploadBytes(ref(a,path),png,metadata));await assertFails(updateMetadata(ref(a,path),{customMetadata:{sha256:hash,schemaVersion:'1',extra:'no'}}));await assertFails(deleteObject(ref(a,path)));
 for(const [id,body,meta]of[['b',new Uint8Array(0),metadata],['c',new Uint8Array(6*1024*1024+1),metadata],['d',png,{...metadata,contentType:'image/svg+xml'}],['e',png,metadata]]){const digest=id.repeat(64);const md={...meta,customMetadata:{...meta.customMetadata,sha256:id==='e'?hash:digest}};await assertFails(uploadBytes(ref(a,'users/alice/evidence/v1/'+digest),body,md));}
});
test('real SDK transport retries existing immutable bytes, verifies digest and honors account guard',async()=>{
 const prepared=await prepareEvidence(new Blob([png],{type:'image/png'}));let generation=1;const transport=createEvidenceTransport({storage:a,uid:'alice',getAuthGeneration:()=>generation});await transport.upload(prepared);await transport.upload(prepared);assert.deepEqual(new Uint8Array(await(await transport.download(prepared.ref)).arrayBuffer()),png);
 // Rules enforce MIME/metadata only; corrupted byte proof belongs to the client.
 const wrong='f'.repeat(64);await uploadBytes(ref(a,'users/alice/evidence/v1/'+wrong),png,{contentType:'image/png',customMetadata:{sha256:wrong,schemaVersion:'1'}});await assert.rejects(()=>transport.download({...prepared.ref,sha256:wrong}),/SHA-256/);
 generation++;await assert.rejects(()=>transport.download(prepared.ref),/Tài khoản/);transport.close();
});
test('interrupted completion retries the already committed object, without replacing immutable bytes',async()=>{
 const prepared=await prepareEvidence(new Blob([png],{type:'image/png'})),transport=createEvidenceTransport({storage:a,uid:'alice'}),controller=new AbortController();
 await assert.rejects(()=>transport.upload({...prepared,signal:controller.signal,onProgress:bytes=>{if(bytes===prepared.ref.bytes)controller.abort();}}),/hủy|canceled/);
 await transport.upload(prepared);assert.deepEqual(new Uint8Array(await(await transport.download(prepared.ref)).arrayBuffer()),png);transport.close();
});
