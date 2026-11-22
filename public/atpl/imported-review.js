// Rendering only: original source keys and the shared quiz engine own scoring.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=s=>String(s||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
export function status(q){
 const kind=q.review.status,label=kind==='conflict'?'Có điểm không khớp với key nguồn':kind==='limited'?'Có hướng dẫn giải · cần đối chiếu điều kiện nguồn':'Có lời giải và phương pháp tính';
 return `<div class="status ${esc(kind)}">${label}</div>`;
}
export function explanation(q,language,imageBlock){
 const r=q.review;
 return `<section class="explanation" aria-label="Giải thích ${esc(q.uid)}"><div class="answer-focus"><div class="eyebrow">Đáp án được in đậm trong Word · dùng để chấm điểm</div><div class="key">${esc(q.answer)} — ${esc(q.options[q.answer])}</div></div>${status(q)}<div class="eyebrow">Giải thích tiếng Việt</div>${paragraphs(r.vi)}${r.noteVi?`<div class="callout warning">${esc(r.noteVi)}</div>`:''}${r.status==='limited'||r.status==='conflict'?'<p class="muted">Key nguồn vẫn được giữ. Câu có thiếu dữ kiện hoặc mâu thuẫn không nằm trong đề thi thử mặc định; bạn có thể chủ động chọn học.</p>':''}<details class="sourcebox"><summary>Nguồn câu hỏi, hình và tài liệu tham khảo</summary><p>${esc(q.sourceFile)} · câu ${q.sourceNumber} · ${esc(q.uid)}</p><p>Đáp án được nhập từ định dạng in đậm; phần lời giải được biên soạn riêng. Liên kết dưới hỗ trợ nguyên lý hoặc phương pháp, không phải chứng nhận độc lập cho key của từng câu.</p>${(r.referenceRecords||[]).map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${s.section?' · '+esc(s.section):''}</p>`).join('')}${(q.sourceScreenshots||[]).map(key=>imageBlock(key,'Ảnh đầy đủ trong Word · có thể chứa đáp án nguồn')).join('')}</details></section>`;
}
