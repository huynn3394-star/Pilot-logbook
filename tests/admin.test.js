import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from '../server.js';
import {readAdminConfig,createUsageStore,createAdminService} from '../lib/admin.js';

const firebaseConfig={enabled:true,projectId:'demo-avilog',apiKey:'public-test-key',appId:'test-app',appOrigin:'http://127.0.0.1',authDomain:'127.0.0.1'};
const owner={localId:'owner-uid',email:'owner@example.test',emailVerified:true,displayName:'Owner',providerUserInfo:[{providerId:'google.com'}]};
const token=(claims={})=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify({aud:'demo-avilog',iss:'https://securetoken.google.com/demo-avilog',sub:'owner-uid',exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url')+'.testsignature';
const event=(overrides={})=>({visitorId:randomUUID(),sessionId:randomUUID(),eventId:randomUUID(),kind:'page_view',feature:'weather',device:'desktop',...overrides});
async function fixture(run,{account=owner,lookupStatus=200}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'avilog-admin-test-'));let lookups=0;
 const admin=createAdminService({config:{enabled:true,emails:['owner@example.test'],directory},firebaseConfig,fetchImpl:async(url,options)=>{lookups++;assert(url.startsWith('https://identitytoolkit.googleapis.com/v1/accounts:lookup?'));assert.equal(options.redirect,'error');assert(JSON.parse(options.body).idToken);return new Response(JSON.stringify({users:[account]}),{status:lookupStatus});}});
 const server=createServer({firebaseConfig:{enabled:false},adminService:admin});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{await run({origin,lookups:()=>lookups,post:body=>fetch(origin+'/api/usage/event',{method:'POST',headers:{Origin:firebaseConfig.appOrigin,'Content-Type':'application/json'},body:JSON.stringify(body)}),get:(route='/api/admin/overview',idToken=token())=>fetch(origin+route,{headers:idToken?{Authorization:'Bearer '+idToken}:{}})});}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await rm(directory,{recursive:true,force:true});}
}

test('admin defaults locked and Railway requires a private persistent volume and owner',()=>{
 assert.deepEqual(readAdminConfig({}),{enabled:false});
 assert.throws(()=>readAdminConfig({AVILOG_ADMIN_ENABLED:'true'}));
 assert.throws(()=>readAdminConfig({AVILOG_ADMIN_ENABLED:'true',AVILOG_ADMIN_EMAILS:'owner@example.test',AVILOG_ADMIN_DATA_DIR:'/tmp/data',RAILWAY_ENVIRONMENT_ID:'production'}));
 assert.throws(()=>readAdminConfig({AVILOG_ADMIN_ENABLED:'true',AVILOG_ADMIN_EMAILS:'owner@example.test',AVILOG_ADMIN_DATA_DIR:'/app/public/admin'}));
 assert.equal(readAdminConfig({AVILOG_ADMIN_ENABLED:'true',AVILOG_ADMIN_EMAILS:' Owner@Example.test ',RAILWAY_VOLUME_MOUNT_PATH:'/data',RAILWAY_ENVIRONMENT_ID:'production'}).directory,'/data/avilog-admin');
});
test('durable usage deduplicates events and browsers across days, preserves internal report text, and expires presence',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'avilog-usage-store-'));let time=Date.parse('2026-11-01T16:59:00Z');let store;
 try{
  store=createUsageStore({directory,now:()=>time});const first=event();store.record(first);store.record(first);store.record({...first,eventId:randomUUID(),kind:'feature_view',feature:'atpl'});
  assert.equal(store.overview().summary.today,1);assert.equal(store.overview().summary.views,1);assert.equal(store.overview().features.length,2);
  time+=2*60000;store.record({...first,eventId:randomUUID(),kind:'page_view'});
  let report=store.overview();assert.equal(report.summary.today,1);assert.equal(report.summary.week,1);assert.equal(report.daily.filter(d=>d.visitors===1).length,2,'Vietnam midnight separates daily rows');
  time+=6*60000;assert.equal(store.overview().summary.active5,0);assert.equal(store.overview().summary.active30,1);
  const before=store.overview();store.close();store=createUsageStore({directory,now:()=>time});assert.deepEqual(store.overview(),before,'Restart must preserve statistics and identifiers');
  const bytes=await readFile(path.join(directory,'avilog-usage.sqlite'));assert(!bytes.includes(first.visitorId),'Original browser IDs are not retained');
  time+=91*86400000;report=store.overview(90);assert.equal(report.summary.month,0);assert.equal(report.summary.views,0);assert.equal(report.features.length,0);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});
test('only the verified Google owner can read metrics, with private cache headers',async()=>fixture(async({get})=>{
 assert.equal((await get('/api/admin/overview',null)).status,401);
 const response=await get();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('access-control-allow-origin'),null);const value=await response.json();assert.equal(value.account.email,owner.email);assert.equal(value.retentionDays,90);
}));
test('a different valid Google account is denied by the server',async()=>fixture(async({get})=>{assert.equal((await get()).status,403);},{account:{...owner,email:'someone@example.test'}}));
test('unverified and disabled owner accounts cannot read statistics',async()=>{
 for(const account of [{...owner,emailVerified:false},{...owner,disabled:true},{...owner,providerUserInfo:[{providerId:'password'}]}])await fixture(async({get})=>assert.equal((await get()).status,403),{account});
});
test('expired or foreign tokens are rejected before lookup, and forged owner claims do not bypass verification',async()=>{
 await fixture(async({get,lookups})=>{assert.equal((await get('/api/admin/overview',token({aud:'other-project'}))).status,401);assert.equal((await get('/api/admin/overview',token({exp:1}))).status,401);assert.equal(lookups(),0);});
 await fixture(async({get})=>assert.equal((await get()).status,401),{lookupStatus:400});
});
test('public event collection accepts only bounded anonymous fields and never exposes stored metrics',async()=>fixture(async({origin,post,get})=>{
 const first=event();assert.equal((await post(first)).status,204);assert.equal((await post(first)).status,204);
 assert.equal((await post({...first,eventId:randomUUID(),email:'private@example.test'})).status,400);
 assert.equal((await post({...first,eventId:randomUUID(),feature:'<img onerror=alert(1)>'})).status,400);
 assert.equal((await post({...first,visitorId:[first.visitorId]})).status,400);
 assert.equal((await fetch(origin+'/api/usage/event',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(event())})).status,403);
 assert.equal((await fetch(origin+'/api/usage/event',{method:'POST',headers:{Origin:firebaseConfig.appOrigin,'Content-Type':'text/plain'},body:'text'})).status,415);
 assert.equal((await fetch(origin+'/api/usage/event',{method:'POST',headers:{Origin:firebaseConfig.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({data:'x'.repeat(3000)})})).status,413);
 const value=await(await get()).json();assert.equal(value.summary.today,1);assert.equal(value.summary.views,1);assert.equal((await get('/api/admin/overview?days=999')).status,400);
}));
test('admin landing is index-excluded and uncached; an unconfigured deployment stays locked',async()=>{
 const server=createServer({firebaseConfig:{enabled:false},adminService:createAdminService({config:{enabled:false}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{const landing=await fetch(base+'/admin/');assert.equal(landing.status,200);assert.match(landing.headers.get('cache-control'),/no-store/);assert.match(landing.headers.get('x-robots-tag'),/noindex/);assert.equal((await fetch(base+'/api/admin/overview')).status,503);assert.deepEqual(await(await fetch(base+'/api/usage/config')).json(),{enabled:false,heartbeatMs:60000});assert.equal((await fetch(base+'/api/health')).status,200);}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});}
});
