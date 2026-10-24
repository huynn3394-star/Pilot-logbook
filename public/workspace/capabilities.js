/** Keep imports local until the owner has deployed the matching cloud rules. */
export function assertImportCapability(preview,{uid,enabled=false}={}){
 if(!uid||enabled)return;
 const records=[...(preview?.changes||[]).flatMap(c=>[c.base,c.next]),...(preview?.parts||[]).flatMap(p=>(p.changes||[]).flatMap(c=>[c.base,c.next])),...(preview?.resumeRecords||[]).map(r=>r.record)];
 if(records.some(r=>r?.kind==='flight'&&(r.data?.logbook!==undefined||r.data?.auditTrail!==undefined)))throw Error('Nguồn có dữ liệu V14. Chưa nhập vào tài khoản: cần cập nhật Firebase rules và bật V14 trước. Bản nguồn vẫn giữ nguyên trên máy.');
}
