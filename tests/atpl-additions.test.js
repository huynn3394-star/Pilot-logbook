import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {requiredAtplCodes} from '../public/account/coordinator.js';
import {explanation} from '../public/atpl/imported-review.js';
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const source=read('data/atpl-additions/source-questions.json'),reviews=read('data/atpl-additions/reviews.json'),catalog=read('public/atpl/catalog.json');
const payload=code=>{const bank=catalog.banks.find(b=>b.code===code),html=readFileSync('public'+bank.url,'utf8');return{bank,html,data:JSON.parse(html.match(/<script id="bank-data" type="application\/json">(.*?)<\/script>/s)[1])[code]}};
test('two additive Word banks preserve all 1103 stems, options, bold source keys and chapter numbering',()=>{
 assert.equal(Object.keys(reviews).length,1103);const expected={FPL:[74,156,120,69,15,69],GNAV:[308,93,47,115,37]},manifests=read('data/atpl-additions/source-manifest.json');assert.equal(manifests.length,11);
 for(const [code,counts] of Object.entries(expected)){
  const {bank,data}=payload(code);assert.equal(data.questions.length,counts.reduce((a,b)=>a+b));assert.equal(bank.reference,false);assert(requiredAtplCodes.includes(code));
  counts.forEach((count,i)=>{assert.equal(source[code].filter(q=>q.section===i+1).length,count);assert.equal(manifests.find(m=>m.code===code&&m.section===i+1).questions,count)});
  for(const s of source[code]){const q=data.questions.find(q=>q.uid===s.uid);assert(q);for(const k of ['id','sourceNumber','section','sourceFile','question','options'])assert.deepEqual(q[k],s[k],s.uid+':'+k);assert.equal(q.answer,s.sourceKey);assert.deepEqual(s.keyCandidates,[s.sourceKey]);assert(s.boldEvidence[s.sourceKey].boldChars/s.boldEvidence[s.sourceKey].chars>.6);assert.equal(Object.keys(q.options).length,4);assert(q.review.vi.trim().length>30);assert(['derived','limited','conflict'].includes(q.review.status));assert(!q.review.en,'no unreviewed English translation');assert(q.review.referenceRecords.length>0);assert.equal(q.sourceScreenshots.length,s.images.length+Object.values(s.optionImages).flat().length);assert.equal(q.importedFigures.length,q.sourceScreenshots.length);}
 }
 assert.equal(payload('FPL').data.questions.find(q=>q.uid==='FPL-02-156').sourceNumber,156);
});
test('all 63 recorded wind triangle calculations satisfy independent east/north vector addition',()=>{
 const rad=d=>d*Math.PI/180;let checked=0;
 for(const [uid,r] of Object.entries(reviews))if(r.calculation){const c=r.calculation,east=c.TAS*Math.sin(rad(c.heading))-c.windSpeed*Math.sin(rad(c.windFrom)),north=c.TAS*Math.cos(rad(c.heading))-c.windSpeed*Math.cos(rad(c.windFrom));assert(Math.abs(Math.hypot(east,north)-c.GS)<.03,uid+' GS');const track=(Math.atan2(east,north)*180/Math.PI+360)%360,delta=((track-c.track+540)%360)-180;assert(Math.abs(delta)<.03,uid+' track');checked++;}
 assert.equal(checked,63);
});
test('source contradictions remain explicit and never change the Word grading key',()=>{
 for(const uid of ['FPL-04-063','FPL-06-014','FPL-06-039','GNAV-01-112','GNAV-04-115']){assert.equal(reviews[uid].status,'conflict');assert(reviews[uid].noteVi);}
 for(const code of Object.keys(source)){const {html}=payload(code);assert.match(html,/if\(q.importedDOCX\)return imported.explanation/);assert.match(html,/if\(q.importedDOCX\)return false/);}
});
test('cropped figures and full source screenshots are separately hashed and included in offline manifests',()=>{
 const map=read('data/atpl-additions/media-map.json'),index=read('data/atpl-media/index.json');assert.equal(Object.keys(map).length,98);const cache=new Map();
 for(const [sourceName,m] of Object.entries(map)){assert.match(sourceName,/^[a-f0-9]{64}\.png$/);assert.notEqual(m.sourceAsset,m.cropAsset);assert(m.box[0]>=0&&m.box[1]>=0&&m.box[2]<=m.sourceSize[0]&&m.box[3]<=m.sourceSize[1]);for(const name of [m.sourceAsset,m.cropAsset]){const pack=index[name];assert(pack,name);if(!cache.has(pack))cache.set(pack,read('data/atpl-media/'+pack));const bytes=Buffer.from(cache.get(pack)[name],'base64');assert.equal(sha(bytes),name.split('.')[0]);assert.equal(bytes.toString('ascii',8,12),'WEBP');}}
 for(const code of Object.keys(source)){const {bank,data}=payload(code),manifest=read('public'+bank.manifest),urls=new Set(manifest.assets.map(a=>a.url));for(const q of data.questions)for(const name of [...q.importedFigures,...q.sourceScreenshots])assert(urls.has('/atpl/media/'+name));}
});
test('review renderer escapes Word content and only reveals full source images in the answer explanation',()=>{
 const q={uid:'FPL-01-001',answer:'A',options:{A:'<script>bad</script>'},sourceFile:'file.docx',sourceNumber:1,review:{status:'limited',vi:'<img onerror=x>\nBước thứ hai',noteVi:'<unsafe>',referenceRecords:[]},sourceScreenshots:['full.webp']};
 const html=explanation(q,'en',(key)=>'<img data-proof="'+key+'">');assert(!html.includes('<script>'));assert(!html.includes('<img onerror'));assert(html.includes('&lt;unsafe&gt;'));assert(html.includes('Giải thích tiếng Việt'));assert(html.includes('<details class="sourcebox">'));assert(html.includes('full.webp'));
});

test('new subjects keep guest, account and other-subject progress in separate durable stores',async()=>{
 const {openAccountBank,blankState}=await import('../public/atpl/sync/store.js');const identities=read('public/atpl/identities.json'),map=new Map([['atpl_mb_v2_state','legacy-untouched'],['atpl_fpl_v2_state','guest-untouched']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},locks={request:async(n,o,fn)=>fn({})};
 const fpl=await openAccountBank({storage,uid:'alice',identity:identities.FPL,locks}),gnav=await openAccountBank({storage,uid:'alice',identity:identities.GNAV,locks}),bob=await openAccountBank({storage,uid:'bob',identity:identities.FPL,locks});
 try{const state=blankState();state.bookmarks=[1];fpl.engineStorage.setItem('atpl_fpl_v2_state',JSON.stringify(state));assert.deepEqual(fpl.getEnvelope().state.bookmarks,[1]);assert.deepEqual(gnav.getEnvelope().state.bookmarks,[]);assert.deepEqual(bob.getEnvelope().state.bookmarks,[]);assert.equal(map.get('atpl_mb_v2_state'),'legacy-untouched');assert.equal(map.get('atpl_fpl_v2_state'),'guest-untouched');assert.throws(()=>fpl.engineStorage.setItem('atpl_gnav_v2_state',JSON.stringify(state)));}finally{fpl.release();gnav.release();bob.release();}
});
