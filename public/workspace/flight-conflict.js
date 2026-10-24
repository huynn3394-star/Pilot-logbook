import {recordFlightRevision} from '../lib/flight-audit.js';
/** Build an explicit conflict choice. The repository retains the losing branch in recovery. */
export function resolveFlightConflict(row,choice,options={}){
 if(!['local','remote'].includes(choice)||!row?.[choice])throw Error('Không có phiên bản để chọn.');
 const next=structuredClone(row[choice]);
 if(choice==='remote'||next.kind!=='flight'||!row.remote||!(next.data.auditTrail||row.remote.data.auditTrail||next.data.logbook||row.remote.data.logbook))return next;
 if(!String(options.reason||'').trim())throw Error('Chọn bản đã sửa của chuyến V14 cần ghi lý do.');
 // Audit forks cannot be concatenated as if sequential. Keep the current server
 // chain and record this choice on top; the original local fork stays in recovery.
 if(row.remote.data.auditTrail)next.data.auditTrail=structuredClone(row.remote.data.auditTrail);
 else delete next.data.auditTrail;
 next.data=recordFlightRevision(row.remote.data,next.data,{...options,replaceConfirmed:true,beforeEvidence:row.remote.evidence?.sha256||'',afterEvidence:next.evidence?.sha256||''});
 return next;
}
