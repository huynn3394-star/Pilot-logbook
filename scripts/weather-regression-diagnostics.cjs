/* Test-only diagnostics for failed real UI regressions. No production hooks. */
const fs=require('node:fs'),path=require('node:path');
const playwright=require('playwright');
const out=path.resolve('test-results/weather-view');fs.mkdirSync(out,{recursive:true});
for(const engineName of ['chromium','webkit']){
 const engine=playwright[engineName],launch=engine.launch.bind(engine);
 engine.launch=async(...args)=>{
  const browser=await launch(...args),newContext=browser.newContext.bind(browser),close=browser.close.bind(browser);
  browser.newContext=async(...params)=>{
   const context=await newContext(...params);
   await context.addInitScript(()=>{
    window.__weatherUIEvents=[];
    const save=value=>{window.__weatherUIEvents.push(value);if(window.__weatherUIEvents.length>40)window.__weatherUIEvents.shift();};
    document.addEventListener('submit',event=>{const f=event.target;if(f.matches('[data-weather-group-form]'))save({type:'submit',group:f.elements.group?.value,valid:f.checkValidity()});},true);
    document.addEventListener('invalid',event=>save({type:'invalid',name:event.target.name,message:event.target.validationMessage}),true);
    document.addEventListener('click',event=>{const b=event.target.closest('button');if(b&&/Tạo nhóm|Thêm sân bay|Sắp xếp|Cập nhật/.test(b.textContent))save({type:'click',text:b.textContent,group:document.querySelector('[data-weather-group-form] input')?.value});},true);
   });
   return context;
  };
  browser.close=async(...params)=>{
   for(const context of browser.contexts())for(const p of context.pages())if(!p.isClosed()){
    try{
     const snapshot=await p.evaluate(()=>({url:location.href,online:navigator.onLine,groups:[...document.querySelectorAll('[data-weather-group]')].map(n=>({id:n.dataset.weatherGroup,hidden:n.hidden,text:n.querySelector('.weather-group-heading')?.textContent})),search:document.querySelector('[data-weather-search]')?.value,groupForm:[...document.querySelectorAll('[data-weather-group-form]')].map(n=>({html:n.outerHTML,value:n.elements.group?.value,valid:n.checkValidity()})),messages:[...document.querySelectorAll('[data-error],#toast,[data-weather-watch-status]')].map(n=>n.textContent),events:window.__weatherUIEvents||[],tail:document.body.innerText.slice(-2500)}));
     console.log('WEATHER_UI_CLOSE_DIAGNOSTICS '+engineName+' '+JSON.stringify(snapshot));
     fs.writeFileSync(path.join(out,engineName+'-weather-close.json'),JSON.stringify(snapshot,null,2));
     await p.screenshot({path:path.join(out,engineName+'-weather-close.png'),fullPage:true}).catch(()=>{});
    }catch(error){console.log('WEATHER_UI_DIAGNOSTICS_ERROR '+String(error));}
   }
   return close(...params);
  };
  return browser;
 };
}
