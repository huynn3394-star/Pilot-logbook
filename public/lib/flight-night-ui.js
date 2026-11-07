import {calculateFlightNight} from './flight-night.js';

const states=new WeakMap();
const groups={night:['nightMinutes'],takeoff:['log_takeoffDay','log_takeoffNight'],landing:['log_landingDay','log_landingNight']};
export function updateAutomaticNight(form,{actual,changedField='',recalculate=false}={}){
 const input=name=>form.elements.namedItem(name);
 let state=states.get(form);
 if(!state){
  const existing=form.dataset.existingFlight==='true';
  state={enabled:Object.fromEntries(Object.entries(groups).map(([group,names])=>[group,!existing&&names.every(name=>{
   const field=input(name);return field&&!field.disabled&&(field.value===''||(group==='night'&&field.value==='0'));
  })])),signature:null,result:null};states.set(form,state);
 }
 if(recalculate)for(const [group,names]of Object.entries(groups))state.enabled[group]=names.every(name=>input(name)&&!input(name).disabled);
 else for(const [group,names]of Object.entries(groups))if(names.includes(changedField))state.enabled[group]=false;
 const flight={actual,dep:input('dep').value,dest:input('dest').value,takeoffBy:input('takeoffBy').value,landingBy:input('landingBy').value};
 const signature=JSON.stringify(flight);
 if(signature!==state.signature){state.signature=signature;state.result=calculateFlightNight(flight);}
 const result=state.result;
 const set=(name,value)=>{const field=input(name);if(field&&!field.disabled)field.value=value===null?'':String(value);};
 if(state.enabled.night)set('nightMinutes',result.nightMinutes);
 for(const group of ['takeoff','landing'])if(state.enabled[group]){
  set('log_'+group+'Day',result[group]?.day??null);set('log_'+group+'Night',result[group]?.night??null);
 }
 const status=form.querySelector('[data-night-status]'),messages=[];
 if(!Object.values(state.enabled).some(Boolean))messages.push('Giữ số liệu đã lưu / nhập tay. Bấm Tính lại để tự điền.');
 else{
  const errors={'missing-block':'Nhập OUT và IN cùng ngày UTC chính xác để tính Night.','invalid-times':'Kiểm tra ngày và thứ tự OUT ≤ OFF ≤ ON ≤ IN; Block tối đa 24 giờ.','unknown-airport':'Chưa có tọa độ sân bay này; nhập Night thủ công.','ambiguous-route':'Không xác định được tuyến ước tính; nhập Night thủ công.','unsupported-timezone':'Thiết bị chưa hỗ trợ múi giờ này; nhập Night thủ công.'};
  if(state.enabled.night)messages.push(result.status==='estimated'?`Night ước tính theo tuyến ${flight.dep.toUpperCase()} → ${flight.dest.toUpperCase()}${result.routeEstimated?' từ OUT → IN; thêm OFF / ON để tách taxi':''}.`:errors[result.status]);
  else messages.push('Night: giữ số liệu đã lưu / nhập tay.');
  messages.push(`DEP ${result.depTimeZone||'chưa rõ'} · DEST ${result.destTimeZone||'chưa rõ'}.`);
  if(['takeoff','landing'].some(group=>state.enabled[group]&&!result[group]))messages.push('Số lần của tôi cần OFF / ON và chọn Takeoff / Landing by = Tôi (hoặc crew khác = 0).');
  if(['takeoff','landing'].some(group=>!state.enabled[group]))messages.push('Số lần đã lưu / nhập tay được giữ nguyên.');
 }
 if(status)status.textContent=messages.filter(Boolean).join(' ');
 return state;
}
