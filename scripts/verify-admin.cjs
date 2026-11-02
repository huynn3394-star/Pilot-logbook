/* Isolated synthetic owners and usage; no production login, account records or cloud writes. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {chromium,webkit}=require('playwright');
const output=path.resolve('test-results/admin');
const user={localId:'test-owner',email:'owner@example.test',emailVerified:true,displayName:'Owner <img src=x onerror=alert(1)>',providerUserInfo:[{providerId:'google.com'}]};
const token=sub=>'eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify({aud:'demo-avilog',iss:'https://securetoken.google.com/demo-avilog',sub,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.testsignature';
(async()=>{
 await fs.mkdir(output,{recursive:true});const directory=await fs.mkdtemp(path.join(os.tmpdir(),'avilog-admin-browser-'));
 const {createUsageStore,createAdminService}=await import('../lib/admin.js'),{createServer}=await import('../server.js');
 const ownerToken=token(user.localId),memberToken=token('test-member');
 const store=createUsageStore({directory}),config={enabled:true,projectId:'demo-avilog',apiKey:'public-test-key',appOrigin:'http://127.0.0.1'};
 for(let i=0;i<12;i++)store.record({visitorId:randomUUID(),sessionId:randomUUID(),eventId:randomUUID(),kind:'page_view',feature:i%2?'atpl':'weather',device:i%3?'mobile':'desktop'});
 const admin=createAdminService({config:{enabled:true,emails:[user.email],directory},store,firebaseConfig:config,fetchImpl:async(url,options)=>{const idToken=JSON.parse(options.body).idToken;return new Response(JSON.stringify({users:[idToken===ownerToken?user:{...user,localId:'test-member',email:'member@example.test'}]}));}});
 const server=createServer({firebaseConfig:{enabled:false},adminService:admin});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;config.appOrigin=origin;
 const report={scope:'Synthetic local owner/member identities; no real Google OAuth or production data',checks:[],errors:[]};
 const clientSource=`let user=null;const listeners=new Set();const owner={uid:'test-owner',getIdToken:async()=>${JSON.stringify(ownerToken)}};const emit=()=>listeners.forEach(fn=>fn({user,status:user?'authenticated':'guest'}));window.__adminOther=()=>{user={uid:'test-member',getIdToken:async()=>${JSON.stringify(memberToken)}};emit();};const client={config:{enabled:true},ready:Promise.resolve(),currentUser:()=>user,subscribe(fn){listeners.add(fn);fn({user,status:'guest'});return()=>listeners.delete(fn);},async login(){user=owner;emit();},async logout(){user=null;emit();}};export async function getAccountClient(){return client;}`;
 try{for(const[name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch({headless:true});
  try{
   for(const width of [320,820,1440]){
    const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    try{
     await p.route('**/account/client.js',r=>r.fulfill({contentType:'text/javascript',body:clientSource}));
     await p.goto(origin+'/admin/',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).waitFor();
     assert.equal(await p.locator('#dashboard').isVisible(),false);assert.equal((await context.request.get(origin+'/api/admin/overview')).status(),401);
     await p.getByRole('button',{name:'Đăng nhập bằng Google',exact:true}).click();await p.locator('#dashboard').waitFor();assert.equal(await p.locator('.card').count(),4);assert.equal(await p.locator('#account-name').textContent(),user.displayName);assert.equal(await p.locator('#account-name img').count(),0);
     assert.equal(await p.locator('#chart svg').count(),1);assert(await p.locator('#days').evaluate(n=>n.getBoundingClientRect().height>=44),'Range selector must remain a 44px touch target');await p.locator('#days').selectOption('7');await p.locator('#system').filter({hasText:'7 ngày'}).waitFor();
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Admin must fit the viewport');
     if(width===1440)await p.screenshot({path:path.join(output,name+'-desktop.png'),fullPage:true});if(width===320)await p.screenshot({path:path.join(output,name+'-mobile.png'),fullPage:true});
     const download=p.waitForEvent('download');await p.getByRole('button',{name:'Xuất CSV',exact:true}).click();assert.match((await download).suggestedFilename(),/^avilog-thong-ke-/);
     await p.getByRole('button',{name:'Đăng xuất',exact:true}).click();await p.locator('#gate').waitFor();assert.equal(await p.locator('#cards').textContent(),'');assert.equal(await p.locator('#account-name').textContent(),'');
     await p.evaluate(()=>window.__adminOther());await p.locator('#status').filter({hasText:'không có quyền quản trị'}).waitFor();assert.equal(await p.locator('#dashboard').isVisible(),false);assert.equal(await p.locator('#cards').textContent(),'');assert.deepEqual(errors,[]);
     report.checks.push({browser:name,width,ownerOnly:true,logoutClearsData:true,chart:true,csv:true,noOverflow:true});
    }finally{await context.close();}
   }
   const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
   try{
    const before=store.overview().summary.today,events=[];p.on('request',r=>{if(r.url().endsWith('/api/usage/event'))events.push(JSON.parse(r.postData()));});
    const collected=p.waitForResponse(r=>r.url().endsWith('/api/usage/event')&&r.status()===204);await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('[data-workspace-account]').waitFor();await collected;
    assert.equal(store.overview().summary.today,before+1);const switched=p.waitForResponse(r=>r.url().endsWith('/api/usage/event')&&r.status()===204);await p.locator('.bottom-nav [data-tab=logbook]').click();await switched;
    assert(events.some(e=>e.feature==='logbook'));assert(events.every(e=>Object.keys(e).sort().join(',')==='device,eventId,feature,kind,sessionId,visitorId'));
    report.checks.push({browser:name,anonymousCollection:true,tabUsage:true,privateFieldsAbsent:true});
   }finally{await context.close();}
   const dnt=await browser.newContext(),p2=await dnt.newPage();try{await p2.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'}));await p2.goto(origin,{waitUntil:'domcontentloaded'});await p2.locator('[data-workspace-account]').waitFor();assert.equal(await p2.evaluate(()=>localStorage.getItem('avilog_usage_browser_v1')),null);report.checks.push({browser:name,doNotTrack:true});}finally{await dnt.close();}
  }finally{await browser.close();}
 }}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}finally{await new Promise(r=>{server.close(r);server.closeAllConnections();});await fs.rm(directory,{recursive:true,force:true});await fs.writeFile(path.join(output,'QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
