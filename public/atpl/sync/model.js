import {clone,canonical,bytes,hash,legacyMax,unionReports} from './common.js';
export {canonical,bytes};
export const CORE_LIMIT=800*1024,REPORT_LIMIT=256*1024,BATCH_LIMIT=8*1024*1024;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const plain=o=>Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&[Object.prototype,null].includes(Object.getPrototypeOf(o)));
const fail=message=>{throw new Error(message);};
const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min&&n<=1e9;
const timestamp=t=>t==null||(Number.isSafeInteger(t)&&t>=0)||(typeof t==='string'&&t.length<=40&&Number.isFinite(Date.parse(t)));
export function validateState(input,identity){
 if(!identity?.questions||!plain(input)||input.version!==2||!plain(input.progress)||!Array.isArray(input.examHistory)||!plain(input.settings))fail('Cấu trúc tiến độ không hợp lệ.');
 const qid=id=>int(Number(id),1)&&String(Number(id))===String(id)&&own(identity.questions,id);
 const selection=(id,v)=>v===null||identity.questions[id].choices.includes(v);
 const ids=a=>{if(!Array.isArray(a)||a.some(i=>!Number.isInteger(i)||!qid(i))||new Set(a).size!==a.length)fail('Số câu không có trong ngân hàng.');return clone(a);};
 const out={version:2,progress:{},wrong:ids(input.wrong),bookmarks:ids(input.bookmarks),examHistory:[],study:null,exam:null,settings:clone(input.settings),updatedAt:input.updatedAt??null};
 if(!['light','dark','system'].includes(input.settings.theme)||!['vi','en','both'].includes(input.settings.language)||Object.keys(input.settings).some(k=>!['theme','language'].includes(k)))fail('Tùy chọn không hợp lệ.');
 for(const [id,p]of Object.entries(input.progress)){
  if(!qid(id)||!plain(p)||!int(p.attempts,1)||!int(p.correct)||p.correct>p.attempts||!selection(id,p.lastSelected??null)||!timestamp(p.lastAt))fail('Lượt làm hoặc lựa chọn không hợp lệ.');
  out.progress[id]={attempts:p.attempts,correct:p.correct,lastSelected:p.lastSelected??null,lastAt:p.lastAt??null};
 }
 function report(r){
  if(!plain(r)||!int(r.size)||!int(r.correct)||r.correct>r.size||!timestamp(r.at))fail('Báo cáo thi không hợp lệ.');
  const c={at:r.at??null,size:r.size,correct:r.correct,percent:r.size?Math.round(100*r.correct/r.size):0};
  if(r.results!=null){
   if(!Array.isArray(r.results)||r.results.length!==r.size)fail('Báo cáo thiếu câu.');const seen=new Set();
   c.results=r.results.map(t=>{if(!plain(t)||!qid(t.id)||seen.has(t.id)||!selection(t.id,t.selected??null)||t.answer!==identity.questions[t.id].answer||t.correct!==(t.selected===t.answer))fail('Đáp án báo cáo khác đáp án gốc.');seen.add(t.id);return {id:t.id,selected:t.selected??null,answer:t.answer,correct:t.correct};});
   if(c.results.filter(t=>t.correct).length!==r.correct)fail('Điểm bài thi không khớp.');
  }
  if(r.percent!=null&&r.percent!==c.percent)fail('Tỷ lệ điểm không khớp.');
  if(bytes(c)>REPORT_LIMIT)fail('Báo cáo vượt giới hạn; giữ bản sao lưu tại máy.');return c;
 }
 function session(s,kind){
  if(s==null)return null;if(!plain(s))fail('Phiên học không hợp lệ.');const list=ids(s.ids);
  if(!list.length||!list.includes(s.qid)||!plain(s.answers))fail('Vị trí phiên học không hợp lệ.');const answers={};
  for(const [id,v]of Object.entries(s.answers)){if(!list.includes(Number(id))||v==null||!selection(id,v))fail('Lựa chọn phiên không hợp lệ.');answers[id]=v;}
  let result;
  if(kind==='study'){
   if(!(s.resumeQid===null||list.includes(s.resumeQid))||typeof s.finished!=='boolean'||typeof s.mode!=='string'||s.mode.length>128)fail('Vị trí tiếp tục không hợp lệ.');
   result={ids:list,qid:s.qid,mode:s.mode,answers,resumeQid:s.resumeQid,finished:s.finished};
  }else{
   if(typeof s.submitted!=='boolean'||!timestamp(s.startedAt))fail('Bài thi không hợp lệ.');
   result={ids:list,qid:s.qid,answers,submitted:s.submitted,startedAt:s.startedAt??null};if(s.report)result.report=report(s.report);
  }
  if(bytes(result)>CORE_LIMIT)fail('Phiên học quá lớn.');return result;
 }
 out.study=session(input.study,'study');out.exam=session(input.exam,'exam');out.examHistory=input.examHistory.map(report);
 if(!timestamp(out.updatedAt)||bytes({...out,examHistory:[]})>CORE_LIMIT)fail('Tiến độ quá lớn hoặc thời gian không hợp lệ.');return out;
}
export function diffState(base,next,identity){
 if(identity){base=validateState(base,identity);next=validateState(next,identity);}
 const delta={progress:{},bookmarks:{},wrong:{},settings:{},sessions:{}};
 for(const [id,p]of Object.entries(next.progress)){
  const old=base.progress[id]||{attempts:0,correct:0};const attempts=p.attempts-old.attempts,correct=p.correct-old.correct;
  if(attempts<0||correct<0||correct>attempts)fail('Giảm lượt làm cần đặt lại epoch có xác nhận.');
  if(attempts||correct||p.lastSelected!==old.lastSelected||p.lastAt!==old.lastAt)delta.progress[id]={attempts,correct,lastSelected:p.lastSelected,lastAt:p.lastAt};
 }
 for(const id of Object.keys(base.progress))if(!own(next.progress,id))fail('Xóa tiến độ cần đặt lại epoch.');
 for(const key of ['bookmarks','wrong']){const a=new Set(base[key]),b=new Set(next[key]);for(const id of new Set([...a,...b]))if(a.has(id)!==b.has(id))delta[key][id]=b.has(id);}
 // Every newly accepted answer updates wrong status, even if it was unchanged locally.
 for(const id of Object.keys(delta.progress))delta.wrong[id]=next.wrong.includes(Number(id));
 for(const [key,value]of Object.entries(next.settings))if(base.settings[key]!==value)delta.settings[key]=value;
 for(const kind of ['study','exam'])if(canonical(base[kind])!==canonical(next[kind]))delta.sessions[kind]={id:null,before:clone(base[kind]),after:clone(next[kind])};
 if(base.updatedAt!==next.updatedAt)delta.updatedAt=next.updatedAt;return delta;
}
function changedSession(current,before,after){
 if(after==null)return null;if(!current||!before||canonical(before.ids)!==canonical(after.ids))return clone(after);
 const result=clone(current);
 for(const [key,value]of Object.entries(after))if(key!=='answers'&&canonical(before[key])!==canonical(value))result[key]=clone(value);
 for(const id of new Set([...Object.keys(before.answers||{}),...Object.keys(after.answers||{})]))if(before.answers?.[id]!==after.answers?.[id]){if(own(after.answers,id))result.answers[id]=after.answers[id];else delete result.answers[id];}
 return result;
}
export function applyDelta(remote,delta,revision){
 const out=clone(remote);if(revision<=(out._sync?.revision||0))return out;
 out._sync??={revision:0,sessions:{},selected:{}};out._sync.sessions??={};out._sync.selected??={};
 for(const [id,p]of Object.entries(delta.progress||{})){
  if(!int(p.attempts)||!int(p.correct)||p.correct>p.attempts)fail('Delta không hợp lệ.');
  const old=out.progress[id]||{attempts:0,correct:0};const attempts=old.attempts+p.attempts,correct=old.correct+p.correct;if(!int(attempts)||!int(correct)||correct>attempts)fail('Lượt làm vượt giới hạn.');
  out.progress[id]={attempts,correct,lastSelected:p.lastSelected,lastAt:p.lastAt};
 }
 for(const key of ['bookmarks','wrong']){const members=new Set(out[key]);for(const [id,on]of Object.entries(delta[key]||{})){if(on)members.add(Number(id));else members.delete(Number(id));}out[key]=[...members].sort((a,b)=>a-b);}
 Object.assign(out.settings,delta.settings||{});
 for(const [kind,change]of Object.entries(delta.sessions||{})){
  const id=change.id;if(!id)fail('Thiếu định danh phiên học.');
  const current=out._sync.sessions[id]?.state;
  const state=changedSession(current,change.before,change.after);
  out._sync.sessions[id]={kind,state,revision};out._sync.selected[kind]=id;out[kind]=clone(state);
 }
 if(own(delta,'updatedAt'))out.updatedAt=delta.updatedAt;out._sync.revision=revision;return out;
}
const importedBase=(base,list)=>(list||[]).reduce((out,item)=>legacyMax(out,item.state),clone(base));
export function prepareBatch(envelope,{batchId,deviceId}){
 const out=clone(envelope);if(out.inflight)return out;
 if(!batchId||!deviceId)fail('Thiếu batch/device ID.');
 const delta=diffState(importedBase(out.baseline,out.pendingImports),out.state);
 for(const [kind,change]of Object.entries(delta.sessions))change.id=out.sessionIds[kind];
 const known=new Set((out.baseline.examHistory||[]).map(canonical));const reports=unionReports(out.state.examHistory||[]).filter(r=>!known.has(canonical(r))).slice(0,20);
 const batch={schemaVersion:1,uid:out.uid,code:out.code,bankSHA256:out.bankSHA256,epoch:out.epoch,batchId,deviceId,baseRevision:out.cloudRevision,sentLocalVersion:out.localVersion,delta,sessions:clone(delta.sessions),reports,imports:(out.pendingImports||[]).map(i=>({...clone(i),state:{...clone(i.state),examHistory:[]}})),importIds:(out.pendingImports||[]).map(i=>i.id)};
 if(out.resetFromEpoch)batch.resetFromEpoch=out.resetFromEpoch;
 if(batch.imports.length>10||bytes(batch)>BATCH_LIMIT||reports.some(r=>bytes(r)>REPORT_LIMIT))fail('Lô đồng bộ quá lớn; hãy xuất sao lưu.');
 out.inflight={batch,sentState:clone(out.state)};return out;
}
export function acknowledge(envelope,ack){
 if(!envelope.inflight||['uid','code','bankSHA256'].some(k=>envelope[k]!==ack[k])||envelope.inflight.batch.batchId!==ack.batchId)fail('Ack khác tài khoản/ngân hàng/lô.');
 if(envelope.epoch!==ack.epoch)fail('Xung đột epoch: dữ liệu đã đặt lại trên máy khác. Hãy xuất bản lưu.');
 if(!Number.isSafeInteger(ack.cloudRevision)||ack.cloudRevision<envelope.cloudRevision)fail('Ack cũ không hợp lệ.');
 const out=clone(envelope),remaining=(out.pendingImports||[]).filter(i=>!(ack.importIds||[]).includes(i.id));
 const tail=diffState(importedBase(out.inflight.sentState,remaining),out.state);
 for(const [kind,change]of Object.entries(tail.sessions))change.id=out.sessionIds[kind];
 out.baseline=clone(ack.state);out.cloudRevision=ack.cloudRevision;
 const rebased=importedBase(ack.state,remaining);
 // Local synthetic application is not a cloud acknowledgement.
 out.state=applyDelta(rebased,tail,(rebased._sync?.revision||0)+1);
 out.state.examHistory=unionReports(ack.state.examHistory||[],out.state.examHistory||[],envelope.state.examHistory||[]);
 out.pendingImports=remaining;out.importReceipts=[...new Set([...(out.importReceipts||[]),...(ack.importIds||[])])];out.inflight=null;delete out.resetFromEpoch;
 return out;
}
export const canonicalReportHash=(code,report)=>hash({code,report});
