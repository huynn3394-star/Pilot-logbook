import {normalizeAirports} from './weather-watch.js';
import {icaoFor} from '../lib/parsers.js';
import {savedReportTiming} from './weather-report.js';
import {formatTAFReport,highlightWeatherReport,collectSpeciAlerts,renderSpeciAlerts,renderWeatherStationIdentity} from './weather-attention.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// View-only helpers. Never query a provider or change saved airport membership.
export function matchesWeatherStation(station,query){
 const code=String(station??'').trim().toUpperCase(),term=String(query??'').trim().toUpperCase();
 return !term||code.includes(term)||(/^[A-Z]{3}$/.test(term)&&icaoFor(term)===code);
}
export function weatherGroupProduct(viewState,groupId){
 const products=viewState?.products;
 return products&&Object.hasOwn(products,groupId)&&products[groupId]==='taf'?'taf':'metar';
}
export function mountWeatherWatch({element,watch,getGroups,onGroups,viewState={},isCurrent=()=>true,onError=()=>{}}){
 let disposed=false,optionsKey='',searchActive=false;
 viewState.open??={};viewState.editing??=false;viewState.products??={};
 viewState.search=typeof viewState.search==='string'?viewState.search:'';
 element.innerHTML='<section class="weather-speci-panel" data-weather-speci hidden aria-label="Bản tin SPECI cần chú ý"></section><div class="weather-watch-toolbar"><div class="weather-quick-search" role="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 6 6"></path></svg><input type="search" data-weather-search aria-label="Tìm nhanh sân bay đã lưu" placeholder="ICAO / IATA" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false"><button type="button" class="weather-search-clear" data-weather-search-clear aria-label="Xóa tìm kiếm sân bay" hidden>×</button></div><button class="btn small" type="button" data-watch-refresh>Cập nhật tất cả</button><details data-weather-manage'+(viewState.manageOpen?' open':'')+'><summary>＋ Quản lý</summary><section class="panel weather-watch-tools"><form data-weather-group-form><label>Tên nhóm mới<input name="group" maxlength="60" autocomplete="off" placeholder="Quốc nội, Quốc tế…" required></label><button class="btn" type="submit">Tạo nhóm</button></form><form data-weather-airport-form><label>Nhóm sân bay<select name="group" aria-label="Nhóm sân bay"></select></label><label>Thêm sân bay (ICAO hoặc IATA)<input name="airport" maxlength="4" autocomplete="off" placeholder="VVTS / SGN" required></label><button class="btn primary" type="submit">Thêm sân bay</button></form><button class="btn" type="button" data-watch-edit>Sắp xếp</button></section></details></div><p class="weather-search-status" data-weather-search-status role="status" aria-live="polite" hidden></p><div data-weather-cards></div><p class="weather-watch-status" data-weather-watch-status role="status"></p>';
 const manage=element.querySelector('[data-weather-manage]'),speciHost=element.querySelector('[data-weather-speci]');
 const groupForm=element.querySelector('[data-weather-group-form]'),airportForm=element.querySelector('[data-weather-airport-form]'),input=airportForm.elements.airport,groupInput=groupForm.elements.group,select=airportForm.elements.group,cards=element.querySelector('[data-weather-cards]'),status=element.querySelector('[data-weather-watch-status]'),refreshButton=element.querySelector('[data-watch-refresh]'),editButton=element.querySelector('[data-watch-edit]');
 const searchInput=element.querySelector('[data-weather-search]'),clearSearchButton=element.querySelector('[data-weather-search-clear]'),searchStatus=element.querySelector('[data-weather-search-status]');
 groupInput.value=viewState.groupDraft||'';input.value=viewState.airportDraft||'';searchInput.value=viewState.search;
 const open=(key,defaultValue=false)=>Object.hasOwn(viewState.open,key)?viewState.open[key]:defaultValue;
 function rememberOpen(){
  for(const node of cards.querySelectorAll('details[data-open-key]')){
   // Search may reveal a collapsed folder temporarily. Do not persist that forced state.
   if(searchActive&&node.dataset.openKey.startsWith('group:'))continue;
   viewState.open[node.dataset.openKey]=node.open;
  }
 }
 function applySearch(){
  if(disposed||!isCurrent())return;
  const term=searchInput.value.trim(),wasActive=searchActive;
  if(term&&!searchActive)rememberOpen();
  searchActive=Boolean(term);viewState.search=searchInput.value;
  const matched=new Set();
  for(const group of cards.querySelectorAll('[data-weather-group]')){
   let count=0;
   for(const row of group.querySelectorAll('[data-weather-station]')){
    const matches=matchesWeatherStation(row.dataset.weatherStation,term);
    row.hidden=!matches;if(matches){count++;matched.add(row.dataset.weatherStation);}
   }
   group.hidden=searchActive&&!count;
   const folder=group.querySelector(':scope>details');
   if(searchActive)folder.open=count>0;
   else if(wasActive)folder.open=open(folder.dataset.openKey,true);
  }
  clearSearchButton.hidden=!searchInput.value;
  searchStatus.hidden=!searchActive;
  searchStatus.textContent=!searchActive?'':matched.size?matched.size+' sân bay phù hợp trong danh sách đã lưu.':'Không tìm thấy sân bay trong danh sách đã lưu. Tìm bằng ICAO hoặc IATA có hỗ trợ.';
 }
 function paint(data){if(disposed||!isCurrent())return;
  rememberOpen();
  const groups=getGroups(),offline=navigator.onLine===false;
  // Alerts always inspect every saved airport, independently of search/product selection.
  const speciAlerts=collectSpeciAlerts(groups,data,{offline}),speciStations=new Set(speciAlerts.map(a=>a.station)),speciHTML=renderSpeciAlerts(speciAlerts);
  speciHost.hidden=!speciAlerts.length;if(speciHost.innerHTML!==speciHTML)speciHost.innerHTML=speciHTML;
  if(!groups.some(g=>g.id===viewState.selectedGroup))viewState.selectedGroup=groups[0]?.id||'legacy';
  const options=groups.length?groups:[{id:'legacy',name:'Danh sách hiện tại'}],key=JSON.stringify(options.map(g=>[g.id,g.name]));if(key!==optionsKey){optionsKey=key;select.innerHTML=options.map(g=>'<option value="'+esc(g.id)+'"'+(g.id===viewState.selectedGroup?' selected':'')+'>'+esc(g.name)+'</option>').join('');}select.value=viewState.selectedGroup;
  status.textContent=(offline?'Offline · xem bản tin chữ đã lưu. ':data.loading.length?'Đang cập nhật '+data.loading.length+' sân bay… ':'Đang xem bản tin chữ đã lưu. Tự cập nhật mỗi 5 phút khi có mạng và mở mục này. ')+(data.cacheError||'Chạm sân bay để xem đầy đủ METAR/TAF. Luôn kiểm tra giờ phát hành và thời hạn.');refreshButton.disabled=offline||data.loading.length>0;editButton.setAttribute('aria-pressed',String(viewState.editing));editButton.textContent=viewState.editing?'Xong':'Sắp xếp';
  const stationRow=(group,station,index)=>{
   const r=data.reports[station],key=group.id+':'+station,preview=weatherGroupProduct(viewState,group.id),hasSpeci=speciStations.has(station),age=r?Date.now()-Date.parse(r.productFetchedAt?.[preview]||r.fetchedAt):0;
   const saved=Boolean(r?.[preview])&&(offline||age>=300000||r.stale||r.staleProducts?.[preview]||Boolean(data.errors[station]));
   const product=name=>{const raw=r?.[name],timing=raw&&savedReportTiming(r,name),expired=timing?.validTo&&Date.parse(timing.validTo)<Date.now(),old=timing&&name==='metar'&&Date.now()-Date.parse(timing.issuedAt)>7200000;
    const flags=[r?.staleProducts?.[name]?'CHƯA CẬP NHẬT ĐƯỢC · GIỮ BẢN CŨ':'',expired?'HẾT HIỆU LỰC':old?'BẢN TIN CŨ':'',timing?.cancelled?'BẢN TIN HỦY':''].filter(Boolean);
    const display=raw?(name==='taf'?formatTAFReport(raw):raw):'Chưa có bản tin hiện hành.';
    return '<section class="weather-product"><h3>'+(name==='metar'&&hasSpeci?'SPECI':name.toUpperCase())+'</h3>'+(flags.length?'<p class="weather-error">'+esc(flags.join(' · '))+'</p>':'')+'<pre class="weather-report">'+highlightWeatherReport(display)+'</pre></section>';};
   const button=(action,label,text,disabled=false)=>'<button class="btn small ghost" type="button" data-weather-action="'+action+'" data-group-id="'+esc(group.id)+'" data-station="'+station+'" aria-label="'+esc(label)+'"'+(disabled?' disabled':'')+'>'+text+'</button>';
   return '<details class="weather-station-row'+(hasSpeci?' weather-has-speci':'')+'" data-weather-station="'+station+'" data-open-key="'+esc(key)+'"'+(open(key)?' open':'')+'><summary>'+renderWeatherStationIdentity(station,{saved,hasSpeci})+'<span class="weather-row-brief" data-weather-preview="'+preview+'">'+highlightWeatherReport(r?.[preview]?.replace(/\s+/g,' ')||'Chưa có '+preview.toUpperCase()+' đã lưu')+'</span></summary><div class="weather-station-detail">'+(viewState.editing?'<div class="weather-row-actions">'+button('station-up','Đưa '+station+' lên','↑',index===0)+button('station-down','Đưa '+station+' xuống','↓',index===group.airports.length-1)+button('station-remove','Bỏ theo dõi '+station,'Bỏ khỏi nhóm')+(groups.length>1?'<label>Chuyển tới<select aria-label="Chuyển '+station+' tới nhóm" data-weather-transfer data-group-id="'+esc(group.id)+'" data-station="'+station+'"><option value="">Chọn nhóm…</option>'+groups.filter(g=>g.id!==group.id).map(g=>'<option value="'+esc(g.id)+'">'+esc(g.name)+'</option>').join('')+'</select></label>':'')+'</div>':'')+(data.errors[station]?'<p class="weather-error" role="status">'+esc(data.errors[station])+' Bản đã lưu được giữ lại.</p>':'')+product('metar')+product('taf')+'</div></details>';
  };
  const groupSources=group=>{const links=new Map();for(const station of group.airports){const report=data.reports[station];for(const product of ['metar','taf']){const url=report?.[product]&&(report.sources?.[product]||report.source);if(!url)continue;if(!links.has(url))links.set(url,[]);links.get(url).push(station+' '+product.toUpperCase());}}return links.size?'<details class="weather-group-sources" data-weather-sources data-open-key="sources:'+esc(group.id)+'"'+(open('sources:'+group.id)?' open':'')+'><summary>Nguồn dữ liệu</summary><ul>'+[...links].map(([url,labels])=>'<li><a target="_blank" rel="noopener" href="'+esc(url)+'">'+esc(new URL(url).host+' · '+labels.join(' · '))+'</a></li>').join('')+'</ul></details>':'';};
  const productSwitch=group=>'<span class="weather-group-products" role="group" aria-label="Bản tin xem nhanh của '+esc(group.name)+'">'+['metar','taf'].map(product=>'<button type="button" data-weather-product="'+product+'" data-group-id="'+esc(group.id)+'" aria-pressed="'+(weatherGroupProduct(viewState,group.id)===product)+'">'+product.toUpperCase()+'</button>').join('')+'</span>';
  cards.innerHTML=groups.length?groups.map((group,index)=>'<section class="panel weather-group" data-weather-group="'+esc(group.id)+'"><details data-open-key="group:'+esc(group.id)+'"'+(open('group:'+group.id,true)?' open':'')+'><summary class="weather-group-heading"><span>'+esc(group.name)+'</span><small>'+group.airports.length+' sân bay</small>'+productSwitch(group)+'</summary>'+(viewState.editing?'<div class="weather-group-actions">'+[['group-up','Đưa nhóm '+group.name+' lên','↑',index===0],['group-down','Đưa nhóm '+group.name+' xuống','↓',index===groups.length-1],['group-rename','Đổi tên nhóm '+group.name,'Đổi tên'],['group-delete','Xóa nhóm '+group.name,'Xóa nhóm']].map(([action,label,text,disabled])=>'<button class="btn small ghost" type="button" data-weather-action="'+action+'" data-group-id="'+esc(group.id)+'" aria-label="'+esc(label)+'"'+(disabled?' disabled':'')+'>'+text+'</button>').join('')+'</div>':'')+group.airports.map((s,i)=>stationRow(group,s,i)).join('')+groupSources(group)+(!group.airports.length?'<p class="weather-empty">Nhóm chưa có sân bay. Mở ＋ Quản lý để thêm sân bay vào nhóm.</p>':'')+'</details></section>').join(''):'<section class="panel weather-watch-card"><p>Mở ＋ Quản lý để tạo nhóm và thêm sân bay bạn muốn theo dõi.</p></section>';
  applySearch();
 }
 async function change(groups,{clearGroup=false,clearAirport=false}={}){if(viewState.busy||disposed)return;viewState.busy=true;const oldGroup=viewState.groupDraft,oldAirport=viewState.airportDraft;if(clearGroup)viewState.groupDraft='';if(clearAirport)viewState.airportDraft='';try{await onGroups(groups);if(disposed||!isCurrent())return;if(clearAirport)input.value='';if(clearGroup)groupInput.value='';await watch.refresh();}catch(error){if(isCurrent()){if(clearGroup)viewState.groupDraft=oldGroup;if(clearAirport)viewState.airportDraft=oldAirport;onError(error.message);}}finally{viewState.busy=false;}}
 const clearSearch=()=>{searchInput.value='';applySearch();searchInput.focus();};
 const searchKey=event=>{if(event.key==='Escape'&&searchInput.value){event.preventDefault();event.stopPropagation();clearSearch();}};
 const openSpeci=event=>{const button=event.target.closest('[data-speci-open]');if(!button||disposed||!isCurrent())return;searchInput.value='';applySearch();const row=[...cards.querySelectorAll('[data-weather-station]')].find(n=>n.dataset.weatherStation===button.dataset.speciOpen);if(!row)return;for(let n=row;n&&n!==cards;n=n.parentElement)if(n.tagName==='DETAILS'){n.open=true;if(n.dataset.openKey)viewState.open[n.dataset.openKey]=true;}row.scrollIntoView({block:'start'});row.querySelector('summary').focus({preventScroll:true});};
 speciHost.addEventListener('click',openSpeci);
 const create=event=>{event.preventDefault();const name=groupInput.value.trim();viewState.selectedGroup=crypto.randomUUID();change([...getGroups(),{id:viewState.selectedGroup,name,airports:[]}],{clearGroup:true});};
 const add=event=>{event.preventDefault();try{const groups=getGroups(),id=select.value;let group=groups.find(g=>g.id===id);if(!group){group={id:'legacy',name:'Danh sách hiện tại',airports:[]};groups.push(group);}group.airports=normalizeAirports([...group.airports,input.value]);viewState.open['group:'+group.id]=true;change(groups,{clearAirport:true});}catch(error){onError(error.message);}};
 const edit=()=>{viewState.editing=!viewState.editing;paint(watch.snapshot());};
 const click=event=>{
  const productButton=event.target.closest('[data-weather-product]');
  if(productButton){
   event.preventDefault();event.stopPropagation();if(disposed||!isCurrent())return;
   const id=productButton.dataset.groupId,product=productButton.dataset.weatherProduct;
   if(!getGroups().some(g=>g.id===id)||!['metar','taf'].includes(product))return;
   viewState.products={...viewState.products,[id]:product};paint(watch.snapshot());
   [...cards.querySelectorAll('[data-weather-product]')].find(n=>n.dataset.groupId===id&&n.dataset.weatherProduct===product)?.focus({preventScroll:true});return;
  }
  const button=event.target.closest('[data-weather-action]');if(!button)return;const groups=getGroups(),index=groups.findIndex(g=>g.id===button.dataset.groupId),group=groups[index];if(!group)return;const station=button.dataset.station,at=group.airports.indexOf(station),action=button.dataset.weatherAction;
  if(action==='group-rename'){const name=prompt('Tên nhóm mới',group.name);if(name===null)return;group.name=name.trim();}
  else if(action==='group-delete'){if(!confirm('Xóa nhóm “'+group.name+'” và bỏ các sân bay khỏi nhóm này?'))return;groups.splice(index,1);}
  else if(action==='group-up'||action==='group-down'){const target=index+(action==='group-up'?-1:1);if(target<0||target>=groups.length)return;[groups[index],groups[target]]=[groups[target],groups[index]];}
  else if(action==='station-remove'){group.airports=group.airports.filter(s=>s!==station);}
  else if(action==='station-up'||action==='station-down'){const target=at+(action==='station-up'?-1:1);if(at<0||target<0||target>=group.airports.length)return;[group.airports[at],group.airports[target]]=[group.airports[target],group.airports[at]];}
  else return;change(groups);
 };
 const transfer=event=>{const select=event.target.closest('[data-weather-transfer]');if(!select?.value)return;const groups=getGroups(),source=groups.find(g=>g.id===select.dataset.groupId),target=groups.find(g=>g.id===select.value);if(!source||!target)return;source.airports=source.airports.filter(s=>s!==select.dataset.station);if(!target.airports.includes(select.dataset.station))target.airports.push(select.dataset.station);viewState.open['group:'+target.id]=true;viewState.open[target.id+':'+select.dataset.station]=true;change(groups);};
 const drafts=()=>{viewState.groupDraft=groupInput.value;viewState.airportDraft=input.value;};groupForm.addEventListener('input',drafts);airportForm.addEventListener('input',drafts);
 const selectGroup=()=>{viewState.selectedGroup=select.value;};const refresh=()=>watch.refresh({force:true});groupForm.addEventListener('submit',create);airportForm.addEventListener('submit',add);select.addEventListener('change',selectGroup);cards.addEventListener('click',click);cards.addEventListener('change',transfer);editButton.addEventListener('click',edit);refreshButton.addEventListener('click',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
 searchInput.addEventListener('input',applySearch);searchInput.addEventListener('search',applySearch);searchInput.addEventListener('keydown',searchKey);clearSearchButton.addEventListener('click',clearSearch);
 const unsubscribe=watch.subscribe(paint),timer=setInterval(()=>{if(!document.hidden)watch.refresh();},300000);watch.ready.then(()=>{if(!disposed)watch.refresh();});
 return{dispose(){rememberOpen();disposed=true;speciHost.removeEventListener('click',openSpeci);viewState.manageOpen=manage.open;searchInput.removeEventListener('input',applySearch);searchInput.removeEventListener('search',applySearch);searchInput.removeEventListener('keydown',searchKey);clearSearchButton.removeEventListener('click',clearSearch);groupForm.removeEventListener('input',drafts);airportForm.removeEventListener('input',drafts);clearInterval(timer);unsubscribe();groupForm.removeEventListener('submit',create);airportForm.removeEventListener('submit',add);select.removeEventListener('change',selectGroup);cards.removeEventListener('click',click);cards.removeEventListener('change',transfer);editButton.removeEventListener('click',edit);refreshButton.removeEventListener('click',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);}};
}
