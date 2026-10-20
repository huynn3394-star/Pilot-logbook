import {emptySnapshot} from './model.js';
import {validateRecord,recordKey,PAGE_SIZE,MAX_PULL_ATTEMPTS} from './schema.js';
import {flightKey} from '../lib/domain.js';
export function references(record){
 if(record.kind!=='flight')return [];
 const d=record.data,refs=[...new Set([d.captainId,d.foId,...(d.crewIds||[])].filter(id=>id&&id!=='self'))].map(id=>({kind:'person',id}));
 if(d.dutyId)refs.push({kind:'duty',id:d.dutyId});return refs;
}
export function validateGraph(records){
 const index=new Set(records.map(r=>r.kind+'\0'+r.id)),keys=new Set();
 for(const r of records){for(const ref of references(r))if(!index.has(ref.kind+'\0'+ref.id))throw new Error('Tham chiếu crew/duty không tồn tại.');if(r.kind==='flight'&&!r.archived){const key=flightKey(r.data);if(keys.has(key))throw new Error('Chuyến bay active bị trùng.');keys.add(key);}}
}
export async function pullStableWorkspace({uid,readHead,readPage,guard=()=>{}}){
 for(let attempt=0;attempt<MAX_PULL_ATTEMPTS;attempt++){
  guard();const head=await readHead();guard();
  if(head!==null&&(head.schemaVersion!==1||!Number.isSafeInteger(head.revision)||head.revision<1))throw new Error('Workspace cloud sai schema/revision.');
  let after=null;const records=[],seen=new Set();
  if(head)for(;;){
   const page=await readPage({after,limit:PAGE_SIZE});guard();if(!Array.isArray(page)||page.length>PAGE_SIZE)throw new Error('Trang workspace không hợp lệ.');
   for(const item of page){validateRecord(item.data);if(item.key!==await recordKey(item.data.kind,item.data.id)||seen.has(item.key))throw new Error('Định danh trang workspace không hợp lệ.');guard();seen.add(item.key);records.push(item.data);}
   if(page.length<PAGE_SIZE)break;after=page.at(-1).key;
  }
  const end=await readHead();guard();if((head?.revision||0)!==(end?.revision||0))continue;
  if(!head)return emptySnapshot(uid);
  if(records.some(r=>r.revision<1||r.revision>head.revision))throw new Error('Revision bản ghi cloud không hợp lệ.');validateGraph(records);
  return {schemaVersion:1,uid,cloudRevision:head.revision,localVersion:0,records};
 }
 throw Object.assign(new Error('Workspace đang thay đổi; giữ bản máy và thử lượt sau.'),{code:'workspace/unstable-snapshot'});
}
