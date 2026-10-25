// Temporary source preparation for hosted verification. Removed before release.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='f65d73f467a10b4a6865ed8acefc12febf0577ae';
function once(source,before,after){assert.equal(source.split(before).length-1,1,'Expected unique source anchor: '+before.slice(0,110));return source.replace(before,()=>after);}
function edit(path,change){const before=readFileSync(path,'utf8');assert.equal(before,execFileSync('git',['show',BASE+':'+path],{encoding:'utf8',maxBuffer:2*1024*1024}),path+' baseline mismatch');const after=change(before);assert.notEqual(before,after,path+' unchanged');writeFileSync(path,after);console.log('Prepared '+path);}
edit('public/lib/flight-editor.js',s=>{
 const anchor='     <div class="fe-time-caption">';
 const button="     ${original?`<button type=\"button\" class=\"fe-inline-button\" data-action=\"image\" data-id=\"${esc(original.id)}\" data-flight-log-scan>${icon('camera')} Nhập ảnh Flight Log</button>`:'<p class=\"fe-help fe-inset\">Lưu chuyến bay trước khi nhập ảnh Flight Log.</p>'}\n";
 s=once(s,anchor,button+anchor);
 return once(s,'Đính kèm ảnh ở đây không chạy OCR. Để đọc giờ từ ảnh, dùng Nhập từ ảnh trong Logbook.','Đính kèm ảnh ở đây không chạy OCR. Để đọc giờ, chọn Nhập ảnh Flight Log ngay trong tab Log của chuyến này.');
});
edit('public/app.js',s=>{
 s=once(s,'function openModal(title, body, footer = "") {','function openModal(title, body, footer = "") {\n  modal._imageTarget=null;');
 s=once(s,'function imageImport(targetId) {',`function imageImport(targetId) {
  const target=targetId?find(targetId):null;
  if(targetId&&(!target||!workspaceSession.view().flights.some(f=>f.id===targetId)))throw Error('Chuyến bay không còn trong dữ liệu. Mở lại chuyến trước khi nhập ảnh.');
  const editor=modal.open?modal.querySelector('#flight-form'):null;
  if(editor&&(formDirty||editor._imported||editor._saving)){
    modal._flightEditor?.show('log');
    throw Error('Hãy lưu các thay đổi của chuyến bay trước khi nhập ảnh Flight Log. Nội dung đang nhập vẫn được giữ.');
  }
  const targetCapture=target?(editor?.dataset.id===targetId?modal._formCapture:workspaceSession.captureForm()):null;
  if(target&&(!targetCapture||!coordinator.isCurrent(targetCapture.token)))throw Error('Phiên đã thay đổi; mở lại chuyến bay trước khi nhập ảnh.');
  const family=target?.aircraft==='A321'?'A320':families[target?.aircraft]?target.aircraft:'A320';`);
 s=once(s,'    "Nhập từ ảnh FLT LOG",','    target ? "Nhập ảnh Flight Log · " + e(target.flightNo) : "Nhập từ ảnh FLT LOG",');
 s=once(s,'`<div class="modal-body"><div class="steps"><b>01 · Chọn ảnh</b>',"`<div class=\"modal-body\">${target?`<div class=\"source-card\" data-image-flight-target><strong>${e(target.flightNo)} · ${e(target.dep)} → ${e(target.dest)}</strong><p>${e(target.date)} · UTC · ${e(target.aircraft||'Chưa ghi loại tàu bay')}</p><p>Ảnh chỉ cập nhật chuyến này sau khi bạn kiểm tra và bấm Lưu.</p></div>`:''}<div class=\"steps\"><b>01 · Chọn ảnh</b>");
 s=once(s,'      "Aircraft family",\n      "A320",','      "Aircraft family",\n      family,');
 s=once(s,'targetId ? find(targetId).date : todayInputDate()','target ? target.date : todayInputDate()');
 s=once(s,'${btn("close", "Hủy", null, "ghost")}${btn("image-parse",','${btn(target ? "image-cancel" : "close", target ? "Quay lại chuyến bay" : "Hủy", null, "ghost")}${btn("image-parse",');
 s=once(s,'  modal.querySelector("#image-file").onchange',`  if(target){
    modal._imageTarget={id:target.id,record:structuredClone(target),capture:targetCapture};
    modal._formCapture=targetCapture;
    modal.querySelector('.modal-head [data-action="close"]').dataset.action='image-cancel';
  }
  modal.querySelector("#image-file").onchange`);
 s=once(s,'function previewImage(targetId) {',`function cancelFlightImage(){
  const target=modal._imageTarget;
  if(!target){modal.close();return;}
  if(!coordinator.isCurrent(target.capture.token))throw Error('Phiên đã thay đổi; mở lại chuyến bay.');
  if(!workspaceSession.view().flights.some(f=>f.id===target.id))throw Error('Chuyến bay không còn trong dữ liệu. Đóng cửa sổ và mở lại danh sách.');
  imageScanGeneration++;imageFile=null;imageAttachment=null;imageCropRect=null;
  editFlight(target.record);modal._formCapture=target.capture;
}
function previewImage(targetId) {`);
 s=once(s,'    const show=old=>{','    const show=(old,targetCapture=null)=>{');
 s=once(s,'      editFlight(old,imported,f.note,f);','      editFlight(old,imported,f.note,f);\n      if(targetCapture)modal._formCapture=targetCapture;');
 s=once(s,'    if(targetId){show(find(targetId));return;}',`    if(targetId){
      const target=modal._imageTarget;
      if(!target||target.id!==targetId||!coordinator.isCurrent(target.capture.token))throw Error('Phiên nhập ảnh đã thay đổi; mở lại đúng chuyến bay.');
      if(!workspaceSession.view().flights.some(record=>record.id===targetId))throw Error('Chuyến bay không còn trong dữ liệu. Không tạo chuyến mới từ cửa sổ này.');
      show(target.record,target.capture);return;
    }`);
 s=once(s,'      case "image-sample":','      case "image-cancel":\n        cancelFlightImage();\n        break;\n      case "image-sample":');
 return s;
});
for(const path of ['public/sw.js','tests/v14-build-cache.test.js','tests/workspace-service-worker.test.js'])edit(path,s=>{assert(s.includes('weather-attention-sf-ui'));return s.replaceAll('weather-attention-sf-ui','weather-attention-sf-ui-flight-scan');});
