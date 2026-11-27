// Read the published bank without opening a study session or changing progress.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();

export function questionList(questions,{search='',topic=''}={}){
 const terms=normalize(search).trim().split(/\s+/).filter(Boolean);
 return questions.filter(q=>q.valid&&(!topic||q.topic===topic)&&terms.every(term=>normalize([q.id,q.uid,q.question,q.displayQuestion,...Object.values(q.options)].join(' ')).includes(term)));
}

function figure(url,caption){
 if(!url)return '<p class="quick-review-note">Chưa có ảnh nguồn cho hình này.</p>';
 return `<figure><a href="${esc(url)}" target="_blank" rel="noopener" aria-label="Mở hình: ${esc(caption)}"><img src="${esc(url)}" alt="${esc(caption)}" loading="lazy" decoding="async"></a><figcaption>${esc(caption)} · Chạm để mở hình</figcaption></figure>`;
}

export function questionRow(q,media={}){
 const figures=q.questionFigures||[],stemFigures=figures.filter(f=>f.role!=='option');
 const images=stemFigures.map(f=>figure(media[f.imageKey],f.captionVi||f.captionEn||f.title||'Hình câu hỏi'));
 if(q.figure&&!stemFigures.some(f=>f.imageKey===q.figure))images.push(figure(media[q.figure],'Hình nguồn · '+q.uid));
 for(const file of q.importedFigures||[])if(/^[a-f0-9]{64}\.(webp|png|jpg)$/.test(file))images.push(figure('/atpl/media/'+file,'Hình câu hỏi · '+q.uid));
 const conflict=q.review?.status==='conflict'||q.audit?.status==='conflict'||q.sourceKeyAudit?.status==='conflict'||['key_conflict','stem_defect','source_missing'].includes(q.resolution?.kind);
 return `<li class="quick-review-question" data-review-id="${esc(q.id)}"><article aria-labelledby="review-question-${esc(q.id)}"><div class="quick-review-meta"><span>${esc(q.uid||q.id)}</span><span>STT ${esc(q.id)}${q.topic?' · '+esc(q.topic):''}</span></div><h2 id="review-question-${esc(q.id)}" lang="en">${esc(q.displayQuestion||q.question)}</h2>${images.join('')}${q.figureBlocked?'<p class="quick-review-note">Hình nguồn còn thiếu hoặc chưa đầy đủ.</p>':''}<ul class="quick-review-options" aria-label="Các lựa chọn">${Object.entries(q.options).map(([key,text])=>{
  const content=`<span class="quick-review-letter">${esc(key)}.</span> <span lang="en">${esc(text)}</span>`;
  const optionFigures=figures.filter(f=>f.role==='option'&&f.option===key).map(f=>figure(media[f.imageKey],'Hình đáp án '+key)).join('');
  return `<li${key===q.answer?' class="quick-review-correct"':''}>${key===q.answer?`<strong>${content}<span class="quick-review-answer-label"> ✓ Đáp án theo đề</span></strong>`:content}${optionFigures}</li>`;
 }).join('')}</ul>${conflict?'<p class="quick-review-note">Có điểm cần đối chiếu trong đề hoặc đáp án nguồn.</p>':''}</article></li>`;
}

export function mountQuickReview(){
 const view=document.getElementById('view');
 const data=JSON.parse(document.getElementById('bank-data').textContent)[window.ATPL_SUBJECT];
 const media=JSON.parse(document.getElementById('media-data').textContent);
 const panel=document.createElement('section');panel.id='quick-review';panel.hidden=true;panel.setAttribute('aria-labelledby','quick-review-title');view.after(panel);
 const topics=[...new Set(data.questions.filter(q=>q.valid).map(q=>q.topic).filter(Boolean))];
 const total=data.questions.filter(q=>q.valid).length;
 panel.innerHTML=`<div class="quick-review-header"><button type="button" class="quiet" data-review-back>← Luyện tập</button><div class="eyebrow">QUICK REVIEW</div><h1 id="quick-review-title" tabindex="-1">Ôn nhanh · ${esc(data.info.name)}</h1><p>Toàn bộ ${total} câu hỏi · Đáp án theo bộ đề được in đậm.</p><p class="quick-review-note">${window.ATPL_SUBJECT==='MBR'?'Bộ tham khảo hiệu chỉnh.':'Giữ nguyên đáp án gốc dùng để chấm thi.'} Các điểm cần đối chiếu được ghi dưới từng câu.</p></div><div class="quick-review-filters"><label>Tìm câu hỏi<input type="search" data-review-search placeholder="Mã câu, nội dung hoặc đáp án…" autocomplete="off"></label><label>Chủ đề<select data-review-topic><option value="">Tất cả chủ đề</option>${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label><button type="button" class="quiet" data-review-clear>Xóa bộ lọc</button><p data-review-count role="status" aria-live="polite"></p></div><ol class="quick-review-list" aria-label="Danh sách câu hỏi"></ol><p data-review-empty hidden>Không tìm thấy câu hỏi phù hợp. Hãy thử từ khóa khác hoặc xóa bộ lọc.</p>`;
 const search=panel.querySelector('[data-review-search]'),topic=panel.querySelector('[data-review-topic]');
 let rendered=false,previousScroll=0,opener;
 function render(){
  const questions=questionList(data.questions,{search:search.value,topic:topic.value});
  panel.querySelector('.quick-review-list').innerHTML=questions.map(q=>questionRow(q,media)).join('');
  panel.querySelector('[data-review-count]').textContent=`${questions.length} / ${total} câu hỏi`;
  panel.querySelector('[data-review-empty]').hidden=questions.length>0;
 }
 function open(button){
  opener=button;previousScroll=window.scrollY;
  if(!rendered){render();rendered=true;}
  view.hidden=true;panel.hidden=false;
  panel.querySelector('h1').focus({preventScroll:true});window.scrollTo(0,0);
 }
 function addEntry(){
  const modes=view.querySelector('.modes');if(!modes||modes.querySelector('[data-quick-review]'))return;
  const button=document.createElement('button');button.type='button';button.className='mode';button.dataset.quickReview='';button.innerHTML='<strong>Ôn nhanh</strong><small>Danh sách toàn bộ câu hỏi · In đậm đáp án theo đề.</small>';button.addEventListener('click',()=>open(button));modes.prepend(button);
 }
 addEntry();new MutationObserver(addEntry).observe(view,{childList:true});
 panel.querySelector('[data-review-back]').addEventListener('click',()=>{panel.hidden=true;view.hidden=false;opener?.focus({preventScroll:true});window.scrollTo(0,previousScroll);});
 search.addEventListener('input',render);topic.addEventListener('change',render);
 panel.querySelector('[data-review-clear]').addEventListener('click',()=>{search.value='';topic.value='';render();search.focus();});
 panel.addEventListener('error',event=>{const img=event.target;if(img.tagName!=='IMG')return;img.hidden=true;img.closest('figure').querySelector('figcaption').textContent='Chưa tải được hình. Kết nối mạng hoặc tải offline môn này.';},true);
}
