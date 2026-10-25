// Test readiness for the real weather toolbar. DOMContentLoaded on a cached WebKit
// navigation can precede imported stylesheet application; do not click unlaid-out UI.
async function weatherReady(page){
 await page.waitForFunction(()=>{
  const root=getComputedStyle(document.documentElement),search=document.querySelector('.weather-quick-search'),refresh=document.querySelector('[data-watch-refresh]');
  return root.getPropertyValue('--ui-revision').trim()==='avilog-shared-v1'&&search&&refresh&&getComputedStyle(search).display==='flex'&&getComputedStyle(refresh).minHeight==='44px';
 },undefined,{timeout:10000});
}
module.exports={weatherReady};
