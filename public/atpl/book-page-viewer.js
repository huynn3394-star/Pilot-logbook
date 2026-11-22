import {bookPageFor} from './book-citations.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bookPageImage(source){
 const p=bookPageFor(source.id);if(!p)return '';
 return `<figure class="figure book-page"><button type="button" class="imagebutton" data-book-page="${esc(source.id)}" aria-label="Phóng to ${esc(p.caption)}"><img data-book-preview src="${esc(p.url)}" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" alt="${esc(p.caption)}"></button><p class="book-page-missing" role="status" hidden>Chưa tải được ảnh trang sách. Kết nối mạng rồi mở lại hoặc tải offline môn này.</p><figcaption>Ảnh trang sách ${esc(source.printedPage)} · Chạm hình để phóng to</figcaption></figure>`;
}
// Reuse the existing bank viewer and its zoom/close/keyboard controls. The
// immutable quiz engine and all progress/account payloads remain untouched.
if(globalThis.document){
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-book-page]');if(!button||button.disabled)return;
  const page=bookPageFor(button.dataset.bookPage),dialog=document.getElementById('image-dialog');if(!page||!dialog)return;
  event.preventDefault();event.stopPropagation();
  dialog.innerHTML=`<div class="dialog-header"><h3>${esc(page.caption)}</h3><div class="image-tools"><button type="button" data-action="image-zoom" class="quiet">Phóng to</button><button type="button" data-action="image-close" class="quiet">Đóng</button></div></div><div class="image-stage"><img src="${esc(page.url)}" alt="${esc(page.caption)}"></div>`;
  dialog.classList.add('image-dialog');if(!dialog.open)dialog.showModal();
 },true);
 document.addEventListener('error',event=>{
  const img=event.target;if(!img.matches?.('img[data-book-preview]'))return;
  const figure=img.closest('.book-page');img.hidden=true;figure.querySelector('button').disabled=true;figure.querySelector('.book-page-missing').hidden=false;
 },true);
}
