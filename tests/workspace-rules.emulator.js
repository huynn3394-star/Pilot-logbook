import {test,before,after} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,deleteDoc,serverTimestamp} from 'firebase/firestore';
let env,alice,bob,guest,password;
const root='users/alice/workspaces/main';
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-atpl-sync',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firebase/firestore.rules','utf8')}});await env.clearFirestore();alice=env.authenticatedContext('alice',{firebase:{sign_in_provider:'google.com'}}).firestore();bob=env.authenticatedContext('bob',{firebase:{sign_in_provider:'google.com'}}).firestore();guest=env.unauthenticatedContext().firestore();password=env.authenticatedContext('alice',{firebase:{sign_in_provider:'password'}}).firestore();});after(()=>env?.cleanup());
test('workspace belongs only to its Google UID; other identities and collection enumeration are denied',async()=>{
 await assertSucceeds(setDoc(doc(alice,root),{schemaVersion:1,revision:1,updatedAt:serverTimestamp()}));await assertSucceeds(getDoc(doc(alice,root)));await assertSucceeds(getDocs(collection(alice,root+'/records')));
 for(const db of [bob,guest,password]){await assertFails(getDoc(doc(db,root)));await assertFails(getDocs(collection(db,root+'/records')));await assertFails(setDoc(doc(db,root),{schemaVersion:1,revision:2,updatedAt:serverTimestamp()}));}
 await assertFails(getDocs(collection(alice,'users')));await assertFails(deleteDoc(doc(alice,root)));await assertFails(setDoc(doc(alice,root),{schemaVersion:9,revision:2,updatedAt:serverTimestamp()}));await assertFails(setDoc(doc(alice,root),{schemaVersion:1,revision:2,updatedAt:serverTimestamp(),extra:'secret'}));
});
test('malformed records, private binary data, forged receipts and immutable overwrites are denied',async()=>{
 const path=root+'/records/'+'a'.repeat(64);for(const data of [{schemaVersion:1,kind:'other',id:'p1',revision:1,archived:false,data:{}},{schemaVersion:1,kind:'person',id:'p1',revision:1,archived:false,data:{id:'p1',name:'QA',rank:'Captain',attachment:'data:image/png;base64,AAAA'}},{schemaVersion:1,kind:'person',id:'p1',revision:1,archived:false,data:{id:'p1',name:42,rank:'Captain'}}])await assertFails(setDoc(doc(alice,path),data));
 const receipt=doc(alice,root+'/receipts/first');await assertFails(setDoc(receipt,{schemaVersion:1,uid:'bob',operationId:'first',operationHash:'a'.repeat(64),priorRevision:0,revision:1,results:[]}));
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),receipt.path),{schemaVersion:1,uid:'alice',operationId:'first',operationHash:'a'.repeat(64),priorRevision:0,revision:1,results:[]}));await assertFails(setDoc(receipt,{schemaVersion:1,uid:'alice',operationId:'first',operationHash:'b'.repeat(64),priorRevision:0,revision:1,results:[]}));await assertFails(deleteDoc(receipt));await assertFails(getDoc(doc(bob,receipt.path)));
});
test('bounded unique airport preferences remain private to the Google owner',async()=>{
 const path=root+'/records/'+'b'.repeat(64),record={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{weatherAirports:['VVTS','VVNB']}};
 await assertSucceeds(setDoc(doc(alice,path),record));await assertSucceeds(getDoc(doc(alice,path)));await assertFails(getDoc(doc(bob,path)));
 for(const weatherAirports of[['VVTS','VVTS'],Array(41).fill('VVTS'),'VVTS'])await assertFails(setDoc(doc(alice,path),{...record,data:{weatherAirports}}));
});
test('owner can save bounded airport groups; malformed groups and cross-UID access fail',async()=>{
 const ref=doc(alice,root+'/records/'+'c'.repeat(64)),record={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{weatherAirports:['VVTS'],weatherGroups:[{id:'domestic',name:'Quốc nội',airports:['VVTS']}]}};
 await assertSucceeds(setDoc(ref,record));await assertFails(getDoc(doc(bob,ref.path)));
 for(const weatherGroups of[null,'wrong',[{id:'bad id',name:'Bad',airports:[]}],[{id:'empty',name:'',airports:[]}],[{id:'extra',name:'Extra',airports:[],extra:'no'}],Array.from({length:9},(_,i)=>({id:'g'+i,name:'N'+i,airports:[]})),[{id:'bad',name:'Bad',airports:['VVNB']}],[{id:'duplicates',name:'Duplicate',airports:['VVTS','VVTS']}],[{id:'oversize',name:'Oversize',airports:Array(41).fill('VVTS')}]])await assertFails(setDoc(ref,{...record,data:{...record.data,weatherGroups}}));

 await assertSucceeds(setDoc(ref,{...record,data:{...record.data,tomorrow:true,beforeDuty:true,missingActual:true,leadMinutes:120,eveningHour:18,weatherGroups:Array.from({length:8},(_,i)=>({id:'g'+i,name:'N'+i,airports:['VVTS']}))}}));
});

// V14 release gate: execute with the Firebase emulator before enabling the cloud flag.
test('V14 owner can save bounded categories; invalid types and another UID are denied',async()=>{
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),root),{schemaVersion:1,revision:1,updatedAt:serverTimestamp()}));
 const ref=doc(alice,root+'/records/'+'d'.repeat(64));
 const r={schemaVersion:1,kind:'flight',id:'v14-flight',revision:1,archived:false,data:{id:'v14-flight',date:'2026-10-24',flightNo:'VN506',dep:'HAN',dest:'CAN',actual:{},logbook:{version:1,sicMinutes:0,instrumentMinutes:0,landingDay:1}}};
 await assertSucceeds(setDoc(ref,r));await assertFails(getDoc(doc(bob,ref.path)));
 for(const logbook of[{version:2},{version:1,sicMinutes:-1},{version:1,sicMinutes:1441},{version:1,landingDay:21},{version:1,sicMinutes:'10'},{version:1,unexpected:true}])await assertFails(setDoc(ref,{...r,data:{...r.data,logbook}}));
});
test('V14 audit entries cannot be removed or overwritten in owner updates',async()=>{
 await env.withSecurityRulesDisabled(context=>setDoc(doc(context.firestore(),root),{schemaVersion:1,revision:1,updatedAt:serverTimestamp()}));
 const ref=doc(alice,root+'/records/'+'e'.repeat(64)),entry={id:'v14-first',at:'2026-10-24T07:00:00Z',action:'confirmed',reason:'',before:{},after:{confirmed:true}};
 const r={schemaVersion:1,kind:'flight',id:'v14-history',revision:1,archived:false,data:{id:'v14-history',date:'2026-10-24',flightNo:'VN507',dep:'CAN',dest:'HAN',actual:{},auditTrail:{version:1,entries:[entry]}}};
 await assertSucceeds(setDoc(ref,r));
 const {auditTrail,...data}=r.data;await assertFails(setDoc(ref,{...r,data}));
 await assertFails(setDoc(ref,{...r,data:{...data,auditTrail:{version:1,entries:[]}}}));
 await assertFails(setDoc(ref,{...r,data:{...data,auditTrail:{version:1,entries:[{...entry,reason:'changed'}]}}}));
 await assertSucceeds(setDoc(ref,{...r,data:{...data,auditTrail:{version:1,entries:[entry,{...entry,id:'v14-second',action:'edited'}]}}}));
});
