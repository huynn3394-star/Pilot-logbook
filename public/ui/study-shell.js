/** Put the existing library/quiz DOM in the Avilog frame. Never opens a workspace writer. */
import {navigationIcon,renderNavigation,renderBottomNavigation} from './navigation.js';
import {applyAppearance} from '../lib/appearance.js';

export function mountStudyShell(content,{bank=false}={}){
 if(content.closest('.study-shell'))return;
 const shell=document.createElement('div');shell.className='app-shell study-shell';
 shell.innerHTML=`<aside class="sidebar study-sidebar"><a href="/?tab=logbook" class="brand" aria-label="AviLog · về Logbook"><img class="nv21-brand-img" src="/brand/avl-logo.svg" alt="AVL AVILOG"></a><button type="button" class="sidebar-toggle" data-action="appearance-sidebar" aria-label="Thu gọn hoặc mở rộng thanh điều hướng">☰</button><div class="nav-caption">YOUR FLIGHT COMPANION</div><nav class="nav" aria-label="Điều hướng">${renderNavigation({active:'atpl',links:true})}</nav><div class="study-sidebar-note">Ôn thi cùng Avilog<small>Tiến độ và bản offline được giữ theo tài khoản đang chọn.</small></div></aside><section class="workspace study-workspace"></section>${renderBottomNavigation({active:'atpl',links:true})}`;
 content.before(shell);shell.querySelector('.study-workspace').append(content);document.body.classList.add('avilog-study-page');
 if(!bank){const header=content.querySelector('.atpl-header');shell.querySelector('.study-workspace').prepend(header);header.classList.add('study-header');header.querySelector('.ui-back').textContent='AviLog.';header.querySelector('.ui-back').href='/?tab=logbook';header.querySelector('[data-account-menu]>summary').textContent='☰';}
 else{
  const header=content.querySelector('.topbar');header.classList.add('study-header');
  const brand=header.querySelector('.brand');brand.replaceChildren();const logo=document.createElement('img');logo.className='nv21-study-subject-logo';logo.src='/brand/avl-logo.svg';logo.alt='AVL AVILOG';brand.append(logo);const name=document.createElement('strong');name.textContent='AviLog · Ôn thi';const title=document.createElement('small');title.dataset.studySubject='';title.textContent=globalThis.ATPL_SUBJECT||'Môn học';brand.append(name,title);
  const theme=document.createElement('button');theme.type='button';theme.className='iconbtn study-theme';theme.dataset.appearanceToggle='';theme.setAttribute('aria-label','Chuyển giao diện ngày / đêm');header.querySelector('.top-tools').append(theme);
  const menu=document.createElement('details');menu.className='library-account-menu study-account-menu';menu.dataset.accountMenu='';menu.innerHTML='<summary aria-label="Tài khoản và đồng bộ">☰</summary><div data-account-content aria-busy="true"><p data-account-loading role="status">Đang chuẩn bị tài khoản…</p></div>';header.querySelector('.top-tools').append(menu);
  const dock=document.querySelector('#dock');if(dock){const update=()=>document.body.classList.toggle('study-question-active',!dock.hidden);update();new MutationObserver(update).observe(dock,{attributes:true,attributeFilter:['hidden']});}
 }
 const more=document.createElement('dialog');more.className='study-more-sheet';more.setAttribute('aria-label','More · Điều hướng Avilog');more.innerHTML=`<header><h2>More · Avilog</h2><button type="button" class="btn" data-study-close aria-label="Đóng điều hướng">✕</button></header><nav aria-label="Các chức năng Avilog">${renderNavigation({active:'atpl',links:true})}</nav>`;document.body.append(more);
 shell.querySelector('[data-study-more]').onclick=()=>more.showModal();more.querySelector('[data-study-close]').onclick=()=>more.close();
 more.addEventListener('click',event=>{if(event.target!==more)return;const r=more.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)more.close();});
 document.addEventListener('click',event=>{for(const menu of shell.querySelectorAll('[data-account-menu][open]'))if(!event.composedPath().includes(menu))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of shell.querySelectorAll('[data-account-menu][open]')){menu.open=false;menu.querySelector('summary').focus();}});
 applyAppearance();
 return {shell,accountElement:shell.querySelector('[data-account-menu]')};
}
