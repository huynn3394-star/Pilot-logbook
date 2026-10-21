/* Native UI coverage: compact first view, complete wrapping reports and shared folder provenance. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({browser,origin,name})=>{for(const width of [390,1024]){const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();try{
 await page.goto(origin);await page.locator('[data-workspace-account]').waitFor();
 assert.equal(await page.getByLabel('Thêm sân bay (ICAO hoặc IATA)').isVisible(),false,'Opening Weather must prioritize reports, not management forms');
 assert.equal(await page.getByRole('button',{name:'Tiếp tục với Google',exact:true}).isVisible(),false,'Account actions must stay inside the closed corner menu');
 await page.locator('[data-weather-manage]>summary').click();
 for(const airport of ['SGN','HAN','BKK']){await page.getByLabel('Thêm sân bay (ICAO hoặc IATA)').fill(airport);await page.getByRole('button',{name:'Thêm sân bay',exact:true}).click();await page.locator('[data-weather-station='+({SGN:'VVTS',HAN:'VVNB',BKK:'VTBS'}[airport])+']').filter({hasText:'Q1013 NOSIG='}).waitFor();}
 await page.locator('[data-weather-manage]>summary').click();
 const row=page.locator('[data-weather-station=VVTS]'),brief=row.locator('.weather-row-brief');
 assert.match(await brief.innerText(),/VRB03KT 9999 SCT037 34\/26 Q1013 NOSIG=$/);
 const bounds=await brief.evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth,height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),white:getComputedStyle(n).whiteSpace,overflow:getComputedStyle(n).textOverflow}));
 assert.notEqual(bounds.white,'nowrap');assert.notEqual(bounds.overflow,'ellipsis');assert.ok(bounds.scroll<=bounds.width+2,'Complete METAR must wrap inside the card');if(width===390)assert.ok(bounds.height>=bounds.line*1.5,'Long mobile METAR must span multiple lines');
 assert.equal(await page.locator('[data-weather-watch]').innerText().then(t=>/20\d{2}-\d{2}-\d{2}|Phát hành|Lấy lúc/.test(t)),false,'No separate calendar timestamps in weather folders');
 const out=path.resolve('test-results/weather-compact');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,name+'-'+width+'.png')});
 await row.locator('summary').click();assert.equal(await row.locator('a').count(),0,'Individual reports must not repeat source links');
 const sources=page.locator('[data-weather-group] [data-weather-sources]');assert.equal(await sources.count(),1);assert.equal(await sources.evaluate(n=>n.open),false);await sources.locator('summary').click();
 assert.equal(await sources.locator('a').count(),4,'Shared primary and fallback product URLs appear once per folder');assert.equal(await sources.locator('a[href^="https://aviationweather.gov/"]').count(),2);assert.match(await sources.innerText(),/VVTS/);assert.match(await sources.innerText(),/VVNB/);
 assert.ok((await row.boundingBox()).y<400,'First weather card must be visible near the top');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 await page.evaluate(()=>localStorage.setItem('atpl_active_account_v1',JSON.stringify({uid:'compact-alice',email:'compact@example.test'})));await page.reload();await page.locator('[data-workspace-account]').filter({hasText:'compact@example.test'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).isVisible(),false);
 await page.locator('[data-account-menu]>summary').click();for(const label of ['Đồng bộ ngay','Đăng nhập tài khoản khác','Đăng xuất / về khách','Xem xung đột'])assert.equal(await page.getByRole('button',{name:label,exact:true}).isVisible(),true);
 await page.evaluate(()=>new Promise(resolve=>{const observer=new MutationObserver(()=>{observer.disconnect();resolve();});observer.observe(document.querySelector('#app'),{childList:true});dispatchEvent(new Event('avilog-workspace-update'));}));assert.equal(await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).isVisible(),true,'Background render must keep the open account menu');await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).isVisible(),false);await page.locator('[data-account-menu]>summary').click();await page.locator('.topbar-main').click({position:{x:1,y:1}});assert.equal(await page.getByRole('button',{name:'Đồng bộ ngay',exact:true}).isVisible(),false);await page.locator('[data-account-menu]>summary').click();
 await page.screenshot({path:path.join(out,name+'-'+width+'-menu.png')});await page.getByRole('button',{name:'Xem xung đột',exact:true}).click();await page.locator('#modal').filter({hasText:'Không có xung đột.'}).waitFor();await page.locator('#modal [data-action=close]').first().click();
 console.log(name+' '+width+'px: compact weather first, full wrapping METAR, shared source links and corner account menu passed');
 }finally{await context.close();}}};
