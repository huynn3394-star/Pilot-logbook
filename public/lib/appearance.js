// Device-local display preferences, isolated from flight/quiz data and per account.
import {getCoordinator} from '../account/coordinator.js';
const coordinator=getCoordinator(),key=()=>`avilog_appearance_v1:${coordinator.capture().uid||'guest'}`;
const memory=new Map();
const effectiveTheme=value=>value.theme==='dark'||value.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
export function appearance(){try{return JSON.parse(localStorage.getItem(key())||'null')||memory.get(key())||{};}catch{return memory.get(key())||{};}}
export function applyAppearance(){const value=appearance();const theme=effectiveTheme(value);if(document.documentElement.dataset.theme!==theme)document.documentElement.dataset.theme=theme;document.documentElement.dataset.sidebar=value.sidebar==='collapsed'?'collapsed':'compact';for(const b of document.querySelectorAll('[data-appearance-toggle],[data-action=appearance-theme],[data-action=theme]')){b.textContent=theme==='dark'?'☀':'☾';b.setAttribute('aria-label',theme==='dark'?'Chuyển sang ban ngày':'Chuyển sang ban đêm');b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',String(theme==='dark'));}for(const b of document.querySelectorAll('[data-action=appearance-sidebar]')){b.setAttribute('aria-expanded',String(value.sidebar!=='collapsed'));b.title=value.sidebar==='collapsed'?'Mở rộng thanh điều hướng':'Thu gọn thanh điều hướng';}}
export function setAppearance(patch){const next={...appearance(),...patch};memory.set(key(),next);try{localStorage.setItem(key(),JSON.stringify(next));}catch{}applyAppearance();}
document.addEventListener('click',event=>{const b=event.target.closest('[data-appearance-toggle],[data-action=appearance-theme],[data-action=appearance-sidebar]');if(!b)return;if(b.dataset.action==='appearance-sidebar')setAppearance({sidebar:appearance().sidebar==='collapsed'?'compact':'collapsed'});else setAppearance({theme:document.documentElement.dataset.theme==='dark'?'light':'dark'});});
window.addEventListener('storage',event=>{if(event.key===key())applyAppearance();});coordinator.subscribe(applyAppearance);applyAppearance();

matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(appearance().theme==='system')applyAppearance();});
