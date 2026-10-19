import {test,before,after} from 'node:test';import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc} from 'firebase/firestore';
import {empty,identity,report} from './fixtures/atpl-account.js';
let env,alice,bob,guest,password;
const core=()=>({schemaVersion:1,code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',revision:1,state:{...empty(),examHistory:[],study:null,exam:null},selected:{}});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-atpl-sync',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firebase/firestore.rules','utf8')}});await env.clearFirestore();alice=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();bob=env.authenticatedContext('bob',{firebase:{sign_in_provider:'google.com'}}).firestore();guest=env.unauthenticatedContext().firestore();password=env.authenticatedContext('password-user',{firebase:{sign_in_provider:'password'}}).firestore();});
after(async()=>env?.cleanup());
test('owner Google identity can access own valid core; all other identities/paths are denied',async()=>{
 const ref=doc(alice,'users/alice/banks/MB');await assertSucceeds(setDoc(ref,core()));await assertSucceeds(getDoc(ref));
 for(const db of [bob,guest]){await assertFails(getDoc(doc(db,ref.path)));await assertFails(setDoc(doc(db,ref.path),core()));await assertFails(getDocs(collection(db,'users/alice/banks')));}
 await assertFails(setDoc(doc(password,'users/password-user/banks/MB'),core()));await assertFails(getDocs(collection(alice,'users')));
 await assertFails(setDoc(doc(alice,'users/alice/banks/OTHER'),{...core(),code:'OTHER'}));await assertFails(setDoc(ref,{...core(),schemaVersion:9}));await assertFails(setDoc(ref,{...core(),unexpected:'extra'}));await assertFails(deleteDoc(ref));
});
test('reports and receipts are immutable and owner-only',async()=>{
 const data={schemaVersion:1,code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',hash:'f'.repeat(64),report:report()};const ref=doc(alice,`users/alice/banks/MB/exams/initial~${data.hash}`);
 await assertSucceeds(setDoc(ref,data));await assertFails(setDoc(ref,{...data,report:report(2000)}));await assertFails(deleteDoc(ref));await assertFails(getDoc(doc(bob,ref.path)));
 const receipt=doc(alice,'users/alice/banks/MB/receipts/batch-test');const r={schemaVersion:1,code:'MB',bankSHA256:identity.bankSHA256,epoch:'initial',batchId:'batch-test',revision:1,deviceId:'phone',importIds:[]};await assertSucceeds(setDoc(receipt,r));await assertFails(setDoc(receipt,{...r,revision:2}));await assertFails(getDoc(doc(guest,receipt.path)));
});
