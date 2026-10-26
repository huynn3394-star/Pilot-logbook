/** Presentation-only entry points. The existing app.js image action owns scanning,
 * target validation, review, conflict handling and all storage writes.
 */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const camera='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4v15H4Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8"/></svg>';
const mounted=new WeakMap();

export function renderFlightScanShortcut(id,label,placement){
 if(!['schedule','list'].includes(placement))throw new TypeError('Unsupported shortcut placement');
 if(typeof id!=='string'||!id.trim())return '';
 return `<button type="button" class="flight-scan-shortcut" data-action="image" data-id="${esc(id)}" data-flight-scan-shortcut="${placement}" aria-label="Scan Flight Log · ${esc(label||'chuyến bay')}">${camera}<span>Scan Flight Log</span></button>`;
}

export function mountFlightScanShortcuts(root){
 if(!root)return {refresh(){},dispose(){}};
 if(mounted.has(root))return mounted.get(root);
 let disposed=false;
 const add=(host,edit,label,placement,before=null)=>{
  if(!host)return;
  const id=edit?.dataset.id;
  const previous=host.querySelector(':scope > [data-flight-scan-shortcut="'+placement+'"]');
  if(!id){previous?.remove();return;}
  const accessible='Scan Flight Log · '+(label||'chuyến bay');
  if(previous&&previous.dataset.id===id&&previous.getAttribute('aria-label')===accessible)return;
  const template=root.ownerDocument.createElement('template');
  template.innerHTML=renderFlightScanShortcut(id,label,placement);
  const button=template.content.firstElementChild;
  if(previous)previous.replaceWith(button);
  else if(before)before.before(button);
  else host.append(button);
 };
 const paint=()=>{
  if(disposed)return;
  for(const card of root.querySelectorAll('.day-route')){
   const footer=card.querySelector('.flight-bottom');
   if(!footer)continue;
   add(card,footer.querySelector('[data-action="edit"][data-id]'),card.querySelector('.flight-top>strong')?.textContent.trim(),'schedule',footer);
  }
  for(const row of root.querySelectorAll('.data-table tbody tr')){
   const cell=row.firstElementChild;
   if(!cell||cell.tagName!=='TD')continue;
   add(cell,row.querySelector('[data-action="edit"][data-id]'),cell.querySelector('strong')?.textContent.trim(),'list');
  }
 };
 const Observer=root.ownerDocument.defaultView.MutationObserver;
 const observer=new Observer(paint);
 const handle={refresh:paint,dispose(){disposed=true;observer.disconnect();mounted.delete(root);}};
 mounted.set(root,handle);
 paint();
 // Scope observation to the main app, not modal drafts. Repeated paints are idempotent.
 observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-id']});
 return handle;
}
if(typeof document!=='undefined')mountFlightScanShortcuts(document.querySelector('#app'));
