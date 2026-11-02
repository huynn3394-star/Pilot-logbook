// First-party aggregate usage only. Never send account, flight, answer, image or URL-query data.
let running=false;
const feature=()=>location.pathname.startsWith('/atpl/')?'atpl':document.querySelector('[data-action="tab"][aria-current="page"]')?.dataset.tab||'weather';
async function start(){
 if(running||location.pathname.startsWith('/admin')||navigator.doNotTrack==='1'||!navigator.onLine)return;
 running=true;
 try{
  const response=await fetch('/api/usage/config',{cache:'no-store',signal:AbortSignal.timeout(4000)});
  if(!response.ok||!(await response.json()).enabled){running=false;return;}
  const id=(store,key)=>{let value=store.getItem(key);if(!/^[a-f0-9-]{36}$/i.test(value||'')){value=crypto.randomUUID();store.setItem(key,value);}return value;};
  const visitorId=id(localStorage,'avilog_usage_browser_v1'),sessionId=id(sessionStorage,'avilog_usage_tab_v1');
  const device=/iPad/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1)?'tablet':/Mobi|Android/i.test(navigator.userAgent)?'mobile':'desktop';
  let current=feature(),lastActivity=Date.now(),lastError=0;
  const send=kind=>{if(!navigator.onLine||document.visibilityState!=='visible')return;fetch('/api/usage/event',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({visitorId,sessionId,eventId:crypto.randomUUID(),kind,feature:current,device}),signal:AbortSignal.timeout(4000)}).catch(()=>{});};
  send('page_view');
  const root=document.getElementById('app');
  if(root)new MutationObserver(()=>{const next=feature();if(['weather','schedule','logbook','crew','statistics','settings'].includes(next)&&next!==current){current=next;send('feature_view');}}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current']});
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){lastActivity=Date.now();send('heartbeat');}});
  setInterval(()=>{if(Date.now()-lastActivity<=5*60000)send('heartbeat');},60000);
  const error=()=>{if(Date.now()-lastError<60000)return;lastError=Date.now();send('runtime_error');};
  window.addEventListener('error',event=>{if(event.error)error();});window.addEventListener('unhandledrejection',error);
 }catch{running=false;}
}
if(typeof window!=='undefined'){start();window.addEventListener('online',start);}
