import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
test('native WebKit config CORS diagnostic is only a cancellation with a matching recent failed request',()=>{
 const {knownConfigCancellation}=require('../scripts/qa-network.cjs'),event={id:'a',at:10000,message:'/127.0.0.1:1234/atpl/firebase-config.json due to access control checks.'},origin='http://127.0.0.1:1234';
 assert.equal(knownConfigCancellation(event,origin,[]),false);
 assert.equal(knownConfigCancellation(event,origin,[{id:'a',at:9950,error:'cancelled'}]),true);
 for(const failures of [[{id:'b',at:9950,error:'cancelled'}],[{id:'a',at:7000,error:'cancelled'}],[{id:'a',at:9950,error:'CORS policy rejected'}]])assert.equal(knownConfigCancellation(event,origin,failures),false);
 assert.equal(knownConfigCancellation({...event,message:'TypeError in app'},origin,[{id:'a',at:9950,error:'cancelled'}]),false);
 assert.equal(knownConfigCancellation(event,'http://127.0.0.1:9999',[{id:'a',at:9950,error:'cancelled'}]),false);
});
test('verified intentional config refusals retain recent history rather than losing proof to a newer request',()=>{const{knownConfigRefusal}=require('../scripts/qa-network.cjs'),origin='http://127.0.0.1:1234',event={id:'a',at:10000,message:'/127.0.0.1:1234/atpl/firebase-config.json due to access control checks.'};assert.equal(knownConfigRefusal(event,origin,new Map([['a:/atpl/firebase-config.json',[9900,15000]]])),true);for(const map of[new Map(),new Map([['b:/atpl/firebase-config.json',[9900]]]),new Map([['a:/other',[9900]]]),new Map([['a:/atpl/firebase-config.json',[7000,15000]]])])assert.equal(knownConfigRefusal(event,origin,map),false);assert.equal(knownConfigRefusal({...event,message:'TypeError in app'},origin,new Map([['a:/atpl/firebase-config.json',[9900]]])),false);});

test('provider error requires exact deliberate abort proof in this context; a failed sync is never classified',()=>{
 const {knownProviderAbort}=require('../scripts/qa-network.cjs'),event={id:'a',at:1000,message:'/127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?SID=synthetic due to access control checks.'},proof=[{id:'a',at:999,url:'http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?SID=synthetic'}];
 assert.equal(knownProviderAbort(event,proof),true);assert.equal(knownProviderAbort({...event,id:'b'},proof),false);assert.equal(knownProviderAbort({...event,at:9999},proof),false);assert.equal(knownProviderAbort({...event,message:'Sync validation error'},proof),false);assert.equal(knownProviderAbort(event,[]),false);
});

test('WebKit cancelled Firestore channel diagnostics require the same session, database, context and instant',()=>{
 const {knownProviderCancellation}=require('../scripts/qa-network.cjs'),url='http://127.0.0.1:8080/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fdemo%2Fdatabases%2F(default)&SID=session-one&AID=4',event={id:'a',at:1000,message:url.replace('http:','').replace('//','/') .replace('AID=4','AID=6')+' due to access control checks.'},proof=[{id:'a',at:999,url,error:'cancelled'}];
 assert.equal(knownProviderCancellation(event,proof),true);
 for(const item of [{...proof[0],id:'b'},{...proof[0],at:9000},{...proof[0],error:'CORS denied'},{...proof[0],url:url.replace('session-one','session-two')},{...proof[0],url:url.replace('demo','other')},{...proof[0],url:url.replace('8080','9999')}])assert.equal(knownProviderCancellation(event,[item]),false);
 assert.equal(knownProviderCancellation({...event,message:'TypeError in app'},proof),false);
 assert.equal(knownProviderCancellation(event,[]),false);
});
