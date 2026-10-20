import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFirebaseConfig} from '../lib/firebase-auth.js';
import {getCoordinator as legacyCoordinator} from '../public/atpl/account-bootstrap.js';
const env={ATPL_ACCOUNTS_ENABLED:'true',ATPL_APP_ORIGIN:'https://avilog-preview-preview.up.railway.app',FIREBASE_PROJECT_ID:'avilog-atpl',FIREBASE_API_KEY:'public-key',FIREBASE_APP_ID:'1:123:web:qa'};
test('workspace flags cannot disable existing ATPL or enable evidence without matching project',()=>{
 const config=readFirebaseConfig(env);assert.equal(config.enabled,true);assert.equal(config.workspaceSyncEnabled,false);assert.equal(config.evidenceSyncEnabled,false);
 for(const extra of [{AVILOG_EVIDENCE_SYNC_ENABLED:'true'},{AVILOG_WORKSPACE_SYNC_ENABLED:'true',AVILOG_EVIDENCE_SYNC_ENABLED:'true'},{AVILOG_WORKSPACE_SYNC_ENABLED:'true',AVILOG_EVIDENCE_SYNC_ENABLED:'true',FIREBASE_STORAGE_BUCKET:'other-project.firebasestorage.app'}])assert.throws(()=>readFirebaseConfig({...env,...extra}),/bucket|workspace/i);
 const active=readFirebaseConfig({...env,AVILOG_WORKSPACE_SYNC_ENABLED:'true',AVILOG_EVIDENCE_SYNC_ENABLED:'true',FIREBASE_STORAGE_BUCKET:'avilog-atpl.firebasestorage.app',SECRET_CREDENTIAL:'must-not-expose'});assert.equal(active.workspaceSyncEnabled,true);assert.equal(active.evidenceSyncEnabled,true);assert.equal(active.storageBucket,'avilog-atpl.firebasestorage.app');assert.equal(Object.hasOwn(active,'SECRET_CREDENTIAL'),false);
});
test('emulator Storage is fixed localhost and never accepted on production origin',()=>{
 const local=readFirebaseConfig({...env,ATPL_APP_ORIGIN:'http://127.0.0.1:3000',FIREBASE_PROJECT_ID:'demo-atpl-sync',ATPL_USE_EMULATORS:'true'});assert.deepEqual(local.emulators.storage,{host:'127.0.0.1',port:9199});
 assert.throws(()=>readFirebaseConfig({...env,ATPL_USE_EMULATORS:'true'}),/localhost/);
});
test('bank listener and cached UID guards observe main account logout and switching',async()=>{
 const {createCoordinator,getCoordinator}=await import('../public/account/coordinator.js');
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const coordinator=createCoordinator({storage,eventTarget:new EventTarget()});globalThis.ATPLAccountCoordinator=coordinator;
 try{
  const events=[];legacyCoordinator().subscribe(user=>events.push(user?.uid||null));getCoordinator().selectAuthenticatedUser({uid:'alice',email:'alice@example.test'});const token=legacyCoordinator().capture();
  assert.equal(getCoordinator().isCurrent(token),true);getCoordinator().selectAuthenticatedUser({uid:'bob',email:'bob@example.test'});assert.equal(legacyCoordinator().isCurrent(token),false);getCoordinator().selectGuest();assert.deepEqual(events,['alice','bob',null]);assert.equal(legacyCoordinator().isExplicitGuest(),true);assert.equal(JSON.parse(storage.getItem('atpl_active_account_v1')).mode,'guest');
 }finally{coordinator.dispose();delete globalThis.ATPLAccountCoordinator;}
});
test('disabled workspace transport cannot turn a remembered UID into cloud authorization',async()=>{
 const {createAccountClient}=await import('../public/atpl/firebase-client.js');const client=createAccountClient({config:{enabled:false,workspaceSyncEnabled:true},coordinator:{getCachedSelection:()=>({uid:'alice'}),generation:0}});await client.ready;
 assert.equal(client.currentUser(),null);assert.throws(()=>client.workspaceTransport(),/chưa.*kích hoạt/i);assert.throws(()=>client.evidenceTransport(),/chưa.*kích hoạt/i);await assert.rejects(()=>client.validateSession(),/đăng nhập/i);client.close();
});
