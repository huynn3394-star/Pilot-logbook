// Test readiness for the real weather toolbar. DOMContentLoaded on a cached WebKit
// navigation can precede imported stylesheet application; do not click unlaid-out UI.
async function weatherReady(page){
 try{await page.waitForFunction(()=>{
  const root=getComputedStyle(document.documentElement),search=document.querySelector('.weather-quick-search'),refresh=document.querySelector('[data-watch-refresh]');
  return root.getPropertyValue('--ui-revision').trim()==='avilog-shared-v1'&&search&&refresh&&getComputedStyle(search).display==='flex'&&getComputedStyle(refresh).minHeight==='44px';
 },undefined,{timeout:10000});}catch(error){
  const readiness=await page.evaluate(()=>{const search=document.querySelector('.weather-quick-search'),refresh=document.querySelector('[data-watch-refresh]');return{revision:getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim(),searchDisplay:search&&getComputedStyle(search).display,refreshMinHeight:refresh&&getComputedStyle(refresh).minHeight,styles:[...document.styleSheets].map(s=>s.href),online:navigator.onLine};}).catch(()=>null);
  error.message+='\nWeather readiness: '+JSON.stringify(readiness);throw error;
 }
}
module.exports={weatherReady};
