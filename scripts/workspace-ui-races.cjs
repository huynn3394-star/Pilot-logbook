// Hold only the external parsing/file-read boundary. The production main UI,
// Auth, account transition, modal guards and IDB writes remain unmodified.
// SW is blocked only in these online parser-boundary fixtures so WebKit routes
// can hold the external parser response. Offline/SW uses separate native suites.
const assert=require('node:assert/strict');
module.exports=async function races({browser,origin,name,login}){
 const results={};
 for(const flow of['pdf','ocr','attachment']){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),observer=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   if(flow==='pdf')await context.route('**/vendor/pdfjs/build/pdf.mjs',route=>route.fulfill({contentType:'application/javascript',body:`export const GlobalWorkerOptions={};export function getDocument(){globalThis.raceStarted=true;return {promise:new Promise(resolve=>globalThis.releaseRace=()=>resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'OLD_A_PAYLOAD',transform:[1,0,0,1,0,0]}]})}),destroy:async()=>{}}))};}`}));
   if(flow==='ocr')await context.route('**/vendor/tesseract/tesseract.min.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Tesseract={createWorker:async()=>({recognize:()=>{window.raceStarted=true;return new Promise(resolve=>window.releaseRace=()=>resolve({data:{text:'OLD_A_PAYLOAD'}}));},terminate:async()=>{}})};`}));
   const uidA=await login(page,origin,`${name}-race-${flow}-a@example.test`);
   if(flow==='attachment')await page.evaluate(()=>{const Native=FileReader;window.FileReader=class extends Native{readAsDataURL(blob){if(window.raceStarted)return super.readAsDataURL(blob);window.raceStarted=true;this.addEventListener('load',()=>window.raceLoaded=true);window.releaseRace=()=>super.readAsDataURL(blob);}};});
   async function open(target){await target.locator('[data-action=tab][data-tab=schedule]:visible').first().click();await require('./ui-controls.cjs').pageManage(target);const action=flow==='pdf'?'import':flow==='ocr'?'image':'add';await target.locator(`[data-action=${action}]:visible`).first().click();await target.locator(flow==='pdf'?'#roster-text':flow==='ocr'?'#image-text':'#flight-form').waitFor();}
   await open(page);
   const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;return canvas.toDataURL('image/png').split(',')[1];});
   if(flow==='attachment'){
    await page.locator('#flight-form [name=flightNo]').fill('VN999');await page.locator('#flight-form [name=dep]').fill('SGN');await page.locator('#flight-form [name=dest]').fill('HAN');await require('./ui-controls.cjs').flightTab(page,'tools');await page.locator('#flight-form [name=evidence]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByRole('button',{name:'Lưu chuyến bay',exact:true}).click();
   }else await page.locator(flow==='pdf'?'#roster-file':'#image-file').setInputFiles({name:flow==='pdf'?'synthetic.pdf':'synthetic.png',mimeType:flow==='pdf'?'application/pdf':'image/png',buffer:flow==='pdf'?Buffer.from('%PDF synthetic boundary fixture'):Buffer.from(png,'base64')});
   await page.waitForFunction(()=>window.raceStarted===true);
   const uidB=await login(observer,origin,`${name}-race-${flow}-b@example.test`);assert.notEqual(uidA,uidB);
   await page.getByRole('button',{name:'Bỏ bản nháp rồi tiếp tục',exact:true}).click();await page.locator('[data-workspace-account]').filter({hasText:`${name}-race-${flow}-b@example.test`}).waitFor();await open(page);
   await page.evaluate(()=>window.releaseRace());if(flow==='attachment')await page.waitForFunction(()=>window.raceLoaded===true);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   if(flow==='attachment')assert.equal(await page.locator('#flight-form [name=flightNo]').inputValue(),'');else assert.equal(await page.locator(flow==='pdf'?'#roster-text':'#image-text').inputValue(),'');
   const records=await page.evaluate(uid=>new Promise((resolve,reject)=>{const request=indexedDB.open('avilog-workspaces-v1',1);request.onsuccess=()=>{const db=request.result,read=db.transaction('workspaces').objectStore('workspaces').get(uid);read.onsuccess=()=>{resolve(read.result?.snapshot.records||[]);db.close();};read.onerror=()=>reject(read.error);};request.onerror=()=>reject(request.error);}),uidB);assert.equal(records.length,0);assert.deepEqual(errors,[]);results[flow]=true;console.log(name+': pending '+flow+' callback isolated across real Auth switch');
  }catch(error){console.error('UI_RACE',name,flow,page.url(),await page.locator('body').innerText(),errors);throw error;}finally{await context.close();}
 }
 console.log(name+': actual main PDF/OCR/file-picker callbacks cannot populate the new account modal or write its IDB');return results;
};
