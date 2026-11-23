// Keep one already-open companion document. Quiz engines and workspace writers
// retain their own DOM/lifecycle; no question HTML, answers or user data are copied.
import {getCoordinator} from '../account/coordinator.js';
const channel='avilog-companion-v1',eventName='avilog-view-visibility';
const appTabs=new Set(['schedule','logbook','weather','notes','crew','statistics','settings']);
let instance;
export function companionDestination(value,origin=globalThis.location?.origin){
 try{
  const url=new URL(value,origin);
  if(url.origin!==origin||url.username||url.password||url.hash)return null;
  if(url.pathname==='/'){
   if([...url.searchParams.keys()].some(k=>!['tab','compose'].includes(k)))return null;
   const tab=url.searchParams.get('tab')||'weather';
   if(!appTabs.has(tab)||url.searchParams.has('compose')&&url.searchParams.get('compose')!=='flight')return null;
   return {area:'app',path:'/?tab='+tab+(url.searchParams.has('compose')?'&compose=flight':'')};
  }
  if(!url.search&&['/atpl/','/atpl/index.html'].includes(url.pathname))return {area:'study',path:'/atpl/'};
  // Only existing public bank paths are accepted as a route announcement.
  if(!url.search&&/^\/atpl\/banks\/[A-Za-z0-9._-]+\.html$/.test(url.pathname))return {area:'study',path:url.pathname};
 }catch{}
 return null;
}
export function isViewVisible(){return !document.hidden&&!document.documentElement.hasAttribute('data-companion-hidden');}
function visibility(visible){
 const changed=document.documentElement.hasAttribute('data-companion-hidden')===visible;
 document.documentElement.toggleAttribute('data-companion-hidden',!visible);
 if(changed)window.dispatchEvent(new CustomEvent(eventName,{detail:{visible}}));
}
export function setupCompanionNavigation({area,onNavigate=()=>{},onLogin}={}){
 if(instance)return instance;
 if(!document.querySelector('link[href="/ui/companion-navigation.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/ui/companion-navigation.css';document.head.append(style);}
 const embedded=window.parent!==window,origin=location.origin,nativeRoute=companionDestination(location.pathname+location.search,origin)?.path;
 let frame=null,ready=false,active=false,pending=null,lastRoute=null,initialRequest=null,shown=false,scroll=[0,0],lastFocus=null,notice=null,fallback;
 const send=(target,message)=>target.postMessage({channel,...message},origin);
 const route=()=>companionDestination(location.pathname+location.search,origin)?.path;
 const setURL=path=>{if(path&&location.pathname+location.search!==path)history.replaceState(history.state,'',path);};
 const announce=()=>{if(embedded)send(parent,{type:'ready',area,path:route(),title:document.title});};
 const showNative=async target=>{
  pending=null;clearTimeout(fallback);notice?.remove();notice=null;
  frame?.setAttribute('aria-hidden','true');if(frame){frame.inert=true;frame.tabIndex=-1;send(frame.contentWindow,{type:'visibility',visible:false});}
  document.body.classList.remove('companion-active');const wasActive=active;active=false;visibility(true);
  const result=await onNavigate(target.path);
  setURL(result?.path||(area==='study'?nativeRoute:target.path));document.title=area==='app'?'AviLog · Pilot Logbook':document.querySelector('[data-study-subject]')?'AviLog · Ôn thi':'Ôn thi ATPL · Pilot Logbook';
  if(wasActive){if(result?.preserveScroll!==false)window.scrollTo(...scroll);if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
 };
 const showCompanion=()=>{
  if(!ready||!pending||!frame)return;
  const target=pending;pending=null;clearTimeout(fallback);notice?.remove();notice=null;
  const initial=!shown&&initialRequest===target.path;shown=true;
  if(!active){scroll=[scrollX,scrollY];lastFocus=document.activeElement;}
  active=true;visibility(false);document.body.classList.add('companion-active');
  frame.inert=false;frame.tabIndex=0;frame.setAttribute('aria-hidden','false');
  send(frame.contentWindow,{type:'visibility',visible:true});
  // Returning to study resumes the loaded subject/question. App destinations may
  // request a different local tab or a new unsaved flight form.
  if(target.area==='app'&&!initial)send(frame.contentWindow,{type:'navigate',path:target.path});
  setURL(target.area==='study'||initial?(lastRoute?.path||target.path):target.path);
  if(lastRoute?.title)document.title=lastRoute.title;
  frame.focus({preventScroll:true});
 };
 const open=async value=>{
  const target=companionDestination(value,origin);if(!target)return false;
  if(embedded){send(parent,{type:'navigate',path:target.path});return true;}
  if(target.area===area){await showNative(target);return true;}
  pending=target;
  document.querySelector('.study-more-sheet[open]')?.close();
  if(!frame){
   frame=document.createElement('iframe');frame.dataset.companionFrame='';frame.title=target.area==='study'?'Ôn thi AviLog':'AviLog · Logbook';frame.setAttribute('aria-hidden','true');frame.inert=true;frame.tabIndex=-1;
   initialRequest=target.path;frame.src=target.path;document.body.append(frame);
  }
  // If the browser cannot open a framed shell, keep ordinary navigation usable.
  if(!ready){clearTimeout(fallback);fallback=setTimeout(()=>{if(!ready&&pending)location.assign(pending.path);},10000);}
  if(ready)showCompanion();
  else if(!notice){notice=document.createElement('p');notice.dataset.companionLoading='';notice.setAttribute('role','status');notice.textContent=target.area==='study'?'Đang mở Ôn thi lần đầu…':'Đang mở AviLog lần đầu…';document.body.append(notice);}
  return true;
 };
 getCoordinator().subscribe(()=>{
  // A parked page must never be restored under another account. Active pages
  // keep their existing account-transition guards and writer-release behavior.
  if(active||!frame)return;
  const wanted=pending?.path;
  frame.remove();frame=null;ready=false;pending=null;lastRoute=null;initialRequest=null;shown=false;
  clearTimeout(fallback);notice?.remove();notice=null;
  if(wanted)Promise.resolve().then(()=>open(wanted));
 });
 window.addEventListener('message',async event=>{
  const data=event.data;
  if(event.origin!==origin||data?.channel!==channel)return;
  if(embedded){
   if(event.source!==parent)return;
   if(data.type==='visibility')visibility(data.visible===true);
   if(data.type==='navigate'){
    const target=companionDestination(data.path,origin);if(target?.area===area){await onNavigate(target.path);announce();}
   }
   if(data.type==='login-error'){
    const status=document.createElement('p');status.dataset.companionLoading='';status.setAttribute('role','alert');status.textContent=typeof data.message==='string'?data.message.slice(0,500):'Chưa đăng nhập được. Vui lòng thử lại.';document.body.append(status);
   }
   return;
  }
  if(!frame||event.source!==frame.contentWindow)return;
  if(data.type==='ready'){
   const target=companionDestination(data.path,origin);if(!target||target.area===area)return;
   ready=true;lastRoute={...target,title:typeof data.title==='string'?data.title.slice(0,160):''};
   if(pending)showCompanion();else if(active){setURL(target.path);if(lastRoute.title)document.title=lastRoute.title;}
   send(frame.contentWindow,{type:'visibility',visible:active});
  }else if(data.type==='navigate'&&active)await open(data.path);
  else if(data.type==='login'&&active){
   // Mobile Google redirect must run in the top document, never in an iframe.
   try{
    if(onLogin)await onLogin();
    else{const {getAccountClient}=await import('../account/client.js');await(await getAccountClient()).login({redirect:true});}
   }catch(error){send(frame.contentWindow,{type:'login-error',message:error.message});}
  }
 });
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  const link=event.target.closest('a[href]');if(!link||link.target&&link.target!=='_self'||link.hasAttribute('download'))return;
  const target=companionDestination(link.href,origin);
  if(!target){
   if(embedded){const url=new URL(link.href);if(!(url.origin===origin&&url.pathname===location.pathname&&url.search===location.search&&url.hash))link.target='_top';}
   return;
  }
  if(target.area===area){
   if(embedded&&area==='study'){event.preventDefault();location.replace(target.path);}
   return;
  }
  event.preventDefault();event.stopPropagation();open(target.path);
 });
 if(embedded)visibility(false);
 instance={open,announce,isActive:()=>active,isEmbedded:()=>embedded};
 return instance;
}
export function companionReady(){instance?.announce();}
export function topLevelLogin(){
 if(window.parent===window)return false;
 window.parent.postMessage({channel,type:'login'},location.origin);return true;
}
export function replaceEmbeddedStudy(value){
 const target=companionDestination(value,location.origin);
 if(window.parent===window||target?.area!=='study')return false;
 location.replace(target.path);return true;
}
