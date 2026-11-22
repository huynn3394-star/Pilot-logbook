// Additive explanatory sources: published Word payloads and progress identities stay unchanged.
import {citationsFor} from './book-citations.js';
import {bookPageImage} from './book-page-viewer.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=s=>String(s||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
export function status(q){
 const kind=q.review.status,label=kind==='conflict'?'Có điểm không khớp với key nguồn':kind==='limited'?'Có hướng dẫn giải · cần đối chiếu điều kiện nguồn':'Có lời giải và phương pháp tính';
 return `<div class="status ${esc(kind)}">${label}</div>`;
}
export function bookSources(uid){
 const sources=citationsFor(uid);if(!sources.length)return '';const shown=new Set();
 return `<section class="book-sources" aria-label="Trích nguồn sách" data-book-sources="${esc(uid)}"><h3>Trích nguồn sách liên quan</h3><p class="book-sources-intro">Nguồn chính: CAE Oxford EASA ATPL 2014. Đoạn sách hỗ trợ nguyên lý hoặc cách làm. Đáp án chấm điểm vẫn theo Word; trị số trên chart phải đối chiếu đúng hình của đề.</p>${sources.map(s=>`<article class="book-source" data-citation="${esc(s.id)}"><div class="eyebrow">${s.role==='primary'?'Nguồn chính · sách EASA ATPL':'Tài liệu bổ trợ'}</div><div class="book-source-title">${esc(s.title)}</div><p class="book-source-location">${esc(s.edition)}<br>${s.chapter?`Chương ${s.chapter} · `:''}${esc(s.section)} · trang sách ${esc(s.printedPage)} · PDF ${s.pdfPage}/${s.pdfPages}</p>${s.quote?`<blockquote lang="en">${esc(s.quote)}${/[.!?]$/.test(s.quote)?'':' …'}</blockquote>`:''}<p class="book-source-connection"><strong>${s.quote?'Liên hệ với lời giải':'Điểm liên quan (diễn giải)'}:</strong> ${esc(s.summaryVi)}</p>${s.image&&!shown.has(s.image.url)?(shown.add(s.image.url),bookPageImage(s)):''}${s.noteVi?`<p class="book-source-note">${esc(s.noteVi)}</p>`:''}${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="book-source-link">Mở tài liệu tại trang này ↗</a>`:`<p class="book-source-note">Tệp nguồn: ${esc(s.sourceFile)}</p>`}</article>`).join('')}<p class="book-source-note">Trích đoạn, diễn giải và ảnh trang sách xem được sau khi tải offline môn này. Liên kết tài liệu bổ trợ cần kết nối mạng.</p></section>`;
}
export function explanation(q,language,imageBlock){
 const r=q.review;
 return `<section class="explanation" aria-label="Giải thích ${esc(q.uid)}"><div class="answer-focus"><div class="eyebrow">Đáp án được in đậm trong Word · dùng để chấm điểm</div><div class="key">${esc(q.answer)} — ${esc(q.options[q.answer])}</div></div>${status(q)}<div class="eyebrow">Giải thích tiếng Việt</div>${paragraphs(r.vi)}${r.noteVi?`<div class="callout warning">${esc(r.noteVi)}</div>`:''}${r.status==='limited'||r.status==='conflict'?'<p class="muted">Key nguồn vẫn được giữ. Câu có thiếu dữ kiện hoặc mâu thuẫn không nằm trong đề thi thử mặc định; bạn có thể chủ động chọn học.</p>':''}${bookSources(q.uid)}<details class="sourcebox"><summary>Đề Word và ảnh gốc</summary><p>${esc(q.sourceFile)} · câu ${q.sourceNumber} · ${esc(q.uid)}</p><p>Đáp án được nhập từ định dạng in đậm; phần lời giải và trích nguồn sách được biên soạn riêng.</p>${(q.sourceScreenshots||[]).map(key=>imageBlock(key,'Ảnh đầy đủ trong Word · có thể chứa đáp án nguồn')).join('')}</details></section>`;
}
