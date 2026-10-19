import {validateState} from './model.js';
import {legacyMax,hash} from './common.js';
function unwrap(value,identity){if(value?.state){if(value.subject&&value.subject!==identity.code)throw new Error('Ngân hàng sao lưu không khớp.');if(value.bankSHA256&&value.bankSHA256!==identity.bankSHA256)throw new Error('Định danh ngân hàng đã cũ.');return value.state;}return value;}
export function mergeLegacy(account,guest,identity){return legacyMax(validateState(account,identity),validateState(unwrap(guest,identity),identity));}
export function previewImport(account,guest,identity){const a=validateState(account,identity),g=validateState(unwrap(guest,identity),identity);return {guestDone:Object.keys(g.progress).length,accountDone:Object.keys(a.progress).length,guestReports:g.examHistory.length,guestBookmarks:g.bookmarks.length,counterPolicy:'maxima',merged:mergeLegacy(a,g,identity)};}
export const importHash=(code,guest)=>hash({code,state:guest?.state||guest});
