import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {citationsFor,bookPageFor,BOOK_CITATIONS_VERSION} from '../public/atpl/book-citations.js';
import {bookAssetsFor} from '../public/atpl/book-page-assets.js';
import {downloadSize} from '../public/atpl/offline.js';
import {readATPLImage} from '../lib/atpl-media.js';
import {bookSources,explanation} from '../public/atpl/imported-review.js';
const read=p=>JSON.parse(readFileSync(p,'utf8')),db=read('data/atpl-additions/book-sources.json'),map=read('data/atpl-additions/question-book-sources.json'),qs=read('data/atpl-additions/source-questions.json');
test('each of the 1103 Word questions has visible, page-specific book evidence',()=>{
 assert.match(BOOK_CITATIONS_VERSION,/^[a-f0-9]{64}$/);const source=Object.values(qs).flat();assert.equal(Object.keys(map).length,1103);assert.deepEqual(Object.keys(map).sort(),source.map(q=>q.uid).sort());
 for(const q of source){const refs=citationsFor(q.uid);assert(refs.length>0&&refs.length<=2,q.uid);assert.equal(refs[0].role,'primary',q.uid);assert.match(refs[0].title,/CAE Oxford/);assert.match(refs[0].edition,/2014/);const html=bookSources(q.uid);assert.match(html,/Trích nguồn sách liên quan/);assert(!html.startsWith('<details'),'book evidence is expanded');assert(!html.includes('href="null"'));for(const s of refs){assert(s.title&&s.edition&&s.section&&s.printedPage&&s.summaryVi);assert(Number.isInteger(s.pdfPage)&&s.pdfPage>=1&&s.pdfPage<=s.pdfPages);if(s.url){assert.equal(new URL(s.url).hash,'#page='+s.pdfPage);assert.equal(new URL(s.url).protocol,'https:');}else{assert(s.providedByUser&&s.sourceFile);assert(Number.isInteger(s.chapter)&&s.chapter>0);assert.equal(s.pdfPage,Number(s.printedPage)+6);}assert.match(s.pdfSHA256,/^[a-f0-9]{64}$/);assert.match(s.pageTextSHA256,/^[a-f0-9]{64}$/);assert(s.quote.split(/\s+/).filter(Boolean).length<=25);}}
 assert.deepEqual(citationsFor('UNKNOWN-01-001'),[]);
});
test('book locators follow the actual question topic, including ICAO fields and PSR versus ETP',()=>{
 const has=(uid,id)=>assert(citationsFor(uid).some(c=>c.id===id),uid+':'+id);
 has('FPL-01-001','altitude');has('FPL-05-002','fpl-speed');has('FPL-05-004','fpl-wake');has('FPL-05-009','fpl-destination');has('FPL-05-012','fpl-supplement');has('FPL-05-013','fpl-status');
 has('GNAV-01-015','wind');has('GNAV-04-001','lambert-convergence');has('GNAV-04-027','mercator');has('GNAV-05-011','twilight');has('GNAV-05-015','longitude-time');
 for(const q of qs.FPL.filter(q=>/point of safe return|\bPSR\b/i.test(q.question))){has(q.uid,'psr');assert(!map[q.uid].includes('etp'),q.uid);}
 assert.equal(citationsFor('GNAV-05-011')[0].pdfPage,430);assert.equal(citationsFor('FPL-05-002')[0].pdfPage,237);
 has('GNAV-02-003','pilotage');has('GNAV-02-034','stereographic');has('GNAV-02-065','relief');has('FPL-06-009','mass');has('FPL-06-028','course-correction');
 assert(!map['GNAV-02-003'].includes('compressibility'),'case must not match CAS');
});
test('short copyrighted manual extracts have bounded quotations and use explicit paraphrase labels',()=>{
 for(const [key,b]of Object.entries(db.books))if(!b.publicDomain&&!b.providedByUser){const n=Object.values(db.citations).filter(c=>c.book===key).reduce((n,c)=>n+c.quote.split(/\s+/).filter(Boolean).length,0);assert(n<=25,key);}
 const q=qs.FPL.find(q=>q.uid==='FPL-05-004'),review=read('data/atpl-additions/reviews.json')[q.uid],html=explanation({...q,answer:q.sourceKey,review},'vi',()=>'<img>');assert.match(html,/Liên hệ với lời giải/);assert.match(html,/Đáp án chấm điểm vẫn theo Word/);assert(html.indexOf('book-sources')<html.indexOf('<details class="sourcebox">'));
 const mixed=bookSources('FPL-05-013');assert(mixed.indexOf('Nguồn chính · sách EASA ATPL')<mixed.indexOf('Tài liệu bổ trợ'));assert.match(mixed,/Điểm liên quan \(diễn giải\)/);assert.match(mixed,/rel="noopener noreferrer"/);
});
test('adding book sources never changes published banks, keys, manifests, identities or guest progress namespaces',()=>{
 const baseline=read('data/atpl-additions/published-bank-baseline.json'),catalog=read('public/atpl/catalog.json'),files=['public/atpl/catalog.json','public/atpl/identities.json',...catalog.banks.flatMap(b=>['public'+b.url,'public'+b.manifest])];
 assert.equal(baseline.releaseCommit,'01f7fcc9aaf7e77b4e3875ad7ffd63ed641a263d');assert.deepEqual(Object.keys(baseline.files).sort(),files.sort());
 for(const file of files)assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),baseline.files[file],file);
});
test('book excerpts are deterministic and bundled in the public offline shell without network waits',()=>{
 const before=readFileSync('public/atpl/book-citations.js'),assets=readFileSync('public/atpl/book-page-assets.js'),mapping=readFileSync('data/atpl-additions/question-book-sources.json');execFileSync('python3',['scripts/atpl-import/map_book_sources.py']);assert(mapping.equals(readFileSync('data/atpl-additions/question-book-sources.json')));execFileSync('python3',['scripts/atpl-import/build_book_citations.py']);assert(before.equals(readFileSync('public/atpl/book-citations.js')));assert(assets.equals(readFileSync('public/atpl/book-page-assets.js')));
 const sw=readFileSync('public/sw.js','utf8');assert.match(sw,/"\/atpl\/book-citations\.js"/);const module=readFileSync('public/atpl/imported-review.js','utf8');assert(!/\bfetch\s*\(/.test(module));assert(!/\bawait\b/.test(module));
});
test('every new question shows its actual cited Oxford page, with duplicate pages shown only once',()=>{
 const pages=read('data/atpl-additions/book-page-images.json').pages;assert.equal(Object.keys(pages).length,81);
 for(const uid of Object.keys(map)){
  const refs=citationsFor(uid),images=refs.filter(c=>c.providedByUser).map(c=>{
   const p=pages[c.book+':'+c.pdfPage];assert(p,uid);assert.equal(p.pdfSHA256,c.pdfSHA256);assert.equal(p.printedPage,c.printedPage);assert.equal(c.image.url,p.url);assert.equal(bookPageFor(c.id).url,p.url);return p.url;
  });assert(images.length>0,uid);const html=bookSources(uid);assert.equal((html.match(/data-book-page=/g)||[]).length,new Set(images).size,uid);assert.match(html,/loading="lazy"/);assert.match(html,/width="\d+" height="2400"/);
 }
 assert.equal(bookPageFor('unknown'),null);
});
test('all rendered source-page bytes are served from the existing immutable media store',async()=>{
 const pages=read('data/atpl-additions/book-page-images.json').pages;
 for(const p of Object.values(pages)){
  const bytes=await readATPLImage(p.url.split('/').pop());assert(bytes,p.url);assert.equal(bytes.length,p.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(p.height,2400);assert(p.width>1000);
 }
});
test('offline image requirements and displayed download sizes include exactly each bank’s cited pages',()=>{
 const catalog=read('public/atpl/catalog.json');
 for(const bank of catalog.banks){
  const expected=new Set(Object.keys(map).filter(uid=>uid.startsWith(bank.code+'-')).flatMap(uid=>citationsFor(uid).flatMap(c=>c.image?[c.image.url]:[])));
  const assets=bookAssetsFor(bank.code);assert.deepEqual(new Set(assets.map(a=>a.url)),expected);assert.equal(assets.length,expected.size);assert.equal(downloadSize(bank),bank.offlineBytes+assets.reduce((n,a)=>n+a.bytes,0));
 }
 const sw=readFileSync('public/sw.js','utf8');for(const file of ['book-page-assets.js','book-page-viewer.js'])assert(sw.includes('"/atpl/'+file+'"'));assert(!sw.includes('/atpl/media/'),'full page images are not bulk-loaded by the shell');
});
