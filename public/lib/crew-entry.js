import {uid} from './domain.js';
const tidy=s=>String(s||'').normalize('NFC').trim().replace(/\s+/g,' '),key=s=>tidy(s).toLocaleLowerCase('vi');
const searchKey=s=>key(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resolveFlightPeople(people,entries){
 const next=structuredClone(people);
 function resolve(entry,rank){const name=tidy(entry?.name);if(!name)return '';if(name.length>80)throw Error('Tên crew tối đa 80 ký tự.');if(rank!=='Crew'&&(entry.id==='self'||!entry.id&&key(name)===key('Tôi')))return 'self';if(entry.id){const old=next.find(p=>p.id===entry.id);if(!old||key(old.name)!==key(name))throw Error('Crew đã thay đổi; chọn lại tên trong danh sách.');return old.id;}const found=next.filter(p=>key(p.name)===key(name));if(found.length>1)throw Error('Có nhiều người trùng tên; chọn đúng hồ sơ trong gợi ý.');if(found.length)return found[0].id;const p={id:uid(),name,rank,note:''};next.push(p);return p.id;}
 const captainId=resolve(entries.captain,'Captain'),foId=resolve(entries.fo,'FO');if(captainId&&captainId===foId)throw Error('Captain và First Officer cần khác nhau.');
 const crewIds=[...new Set((entries.crew||[]).map(p=>resolve(p,'Crew')).filter(id=>id&&id!==captainId&&id!==foId))];if(crewIds.length>100)throw Error('Tối đa 100 crew trong một chuyến.');return {people:next,captainId,foId,crewIds};
}
export function mountCrewEntry(form,people,flight){
 const chosen=(flight.crewIds||[]).map(id=>people.find(p=>p.id===id)).filter(Boolean).map(p=>({id:p.id,name:p.name}));
 const controls={};
 for(const[role,label,field]of[['captain','Captain','captainId'],['fo','First Officer','foId'],['crew','Crew khác','crewIds']]){
  const options=role==='crew'?people:[{id:'self',name:'Tôi',rank:'Chính tôi'},...people],host=form.querySelector(`[data-crew-field=${role}]`),old=role==='crew'?null:options.find(p=>p.id===flight[field]);
  host.innerHTML=`<label>${label}<input type="text" name="${role==='crew'?'crewName':field}" data-person-input="${role}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="crew-options-${role}" autocomplete="off" maxlength="80" placeholder="Gõ tên để tìm hoặc tạo mới" value="${esc(old?.name||'')}"></label><div class="crew-options" role="listbox" id="crew-options-${role}" hidden></div>${role==='crew'?'<button class="btn small" type="button" data-add-crew>＋ Thêm tên</button><div data-crew-chips></div>':''}`;
  const input=host.querySelector('input'),list=host.querySelector('[role=listbox]');let selected=old?{id:old.id,name:old.name}:null,active=-1,matches=[];
  const hide=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
  const pick=p=>{selected={id:p.id,name:p.name};input.value=p.name;hide();if(role==='crew')add();form.dispatchEvent(new Event('input',{bubbles:true}));};
  function show(){active=-1;const q=searchKey(input.value);matches=options.filter(p=>!q||searchKey(p.name).includes(q)).slice(0,8);list.innerHTML=matches.map((p,i)=>`<button type="button" role="option" aria-selected="false" id="crew-option-${role}-${i}" data-choice="${i}">${esc(p.name)} <small>${esc(p.rank)}</small></button>`).join('');list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));}
  function add(){const value=tidy(input.value);if(!value)return;const entry=selected||{name:value};if(!chosen.some(p=>entry.id?p.id===entry.id:!p.id&&key(p.name)===key(entry.name)))chosen.push({...entry});input.value='';selected=null;hide();chips();form.dispatchEvent(new Event('input',{bubbles:true}));}
  function chips(){const target=host.querySelector('[data-crew-chips]');if(!target)return;target.innerHTML=chosen.map((p,i)=>`<span class="crew-chip">${esc(p.name)}<button type="button" data-remove-crew="${i}" aria-label="Bỏ ${esc(p.name)}">×</button></span>`).join('');}
  input.addEventListener('input',()=>{selected=null;show();});input.addEventListener('focus',show);host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))hide();});list.addEventListener('pointerdown',e=>e.preventDefault());list.addEventListener('click',e=>{const b=e.target.closest('[data-choice]');if(b)pick(matches[Number(b.dataset.choice)]);});
  input.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(list.hidden)show();if(matches.length){active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;for(const[b,i]of[...list.children].map((b,i)=>[b,i]))b.setAttribute('aria-selected',String(i===active));input.setAttribute('aria-activedescendant',list.children[active].id);}}else if(e.key==='Enter'){e.preventDefault();if(!list.hidden&&active>=0)pick(matches[active]);else if(role==='crew')add();else hide();}else if(e.key==='Escape'&&!list.hidden){e.preventDefault();e.stopPropagation();hide();}});
  host.querySelector('[data-add-crew]')?.addEventListener('click',add);host.addEventListener('click',e=>{const b=e.target.closest('[data-remove-crew]');if(b){chosen.splice(Number(b.dataset.removeCrew),1);chips();form.dispatchEvent(new Event('input',{bubbles:true}));}});chips();controls[role]=()=>selected||{name:input.value};
 }
 return {read(){const pending=controls.crew();return {captain:controls.captain(),fo:controls.fo(),crew:[...chosen,...(tidy(pending.name)?[pending]:[])]};}};
}
