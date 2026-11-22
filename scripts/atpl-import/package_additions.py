"""Package the two additive DOCX banks without modifying any published source bank.
The source-questions and authored reviews are checked in; media comes from a
read-only extraction directory. Re-running preserves existing unrelated packs.
"""
from pathlib import Path
import json,re,hashlib,base64,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'public/atpl';DATA=ROOT/'data/atpl-additions'
sha=lambda b:hashlib.sha256(b).hexdigest()
dump=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
def write(p,b):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b.encode() if isinstance(b,str) else b)
def main(extracted):
 source=json.loads((DATA/'source-questions.json').read_text());reviews=json.loads((DATA/'reviews.json').read_text());refs=json.loads((DATA/'references.json').read_text());catalog=json.loads((OUT/'catalog.json').read_text());identities=json.loads((OUT/'identities.json').read_text())
 template=(OUT/'banks/POF-c6d80dbfb53b7678.html').read_text()
 template=re.sub(r'<title>.*?</title>','<title>__TITLE__ · ATPL · AviLog</title>',template,count=1)
 template=template.replace("window.ATPL_SUBJECT='POF'","window.ATPL_SUBJECT='__CODE__'",1)
 template=re.sub(r'(<script id="bank-data" type="application/json">).*?(</script>)',lambda m:m[1]+'__PAYLOAD__'+m[2],template,count=1,flags=re.S)
 template=re.sub(r'(<script id="media-data" type="application/json">).*?(</script>)',lambda m:m[1]+'__MEDIA__'+m[2],template,count=1,flags=re.S)
 template=re.sub(r'window.ATPL_ACCOUNT_READY=import\("/atpl/account-ui.js"\).then\(m=>m.prepareBank\(.*?\)\);', 'window.ATPL_ACCOUNT_READY=import("/atpl/account-ui.js").then(m=>m.prepareBank(__IDENTITY__));',template,count=1)
 template=template.replace('const DATA=JSON.parse',"const imported=await import('/atpl/imported-review.js');\nconst DATA=JSON.parse",1)
 template=template.replace('function sourceOnly(q){','function sourceOnly(q){if(q.importedDOCX)return false;',1)
 template=template.replace('function status(q){','function status(q){if(q.importedDOCX)return imported.status(q);',1)
 template=template.replace('function explanation(q){','function explanation(q){if(q.importedDOCX)return imported.explanation(q,state.settings.language,imageBlock);',1)
 template=template.replace("${q.figure?imageBlock(q.figure,`Hình nguồn · ${disp(q)}${q.figureStatus==='partial'?' · Ảnh gốc bị cắt':''}`,true):''}","${(q.importedFigures||[]).map(key=>imageBlock(key,`Hình trong câu ${disp(q)} · vùng trích từ Word`,true)).join('')}")
 assert '__PAYLOAD__' in template and '__MEDIA__' in template and '__IDENTITY__' in template
 packdir=ROOT/'data/atpl-media';index=json.loads((packdir/'index.json').read_text());packno=max(int(p.stem.split('-')[1]) for p in packdir.glob('pack-*.json'))+1
 assets={};media={};pack={};size=0;media_map={};crop_index=json.loads((DATA/'image-crops.json').read_text())
 def flush():
  nonlocal pack,packno,size
  if pack:
   name=f'pack-{packno:03}.json';write(packdir/name,dump(pack));index.update({k:name for k in pack});packno+=1;pack={};size=0
 def asset(content,suffix):
  nonlocal size
  h=sha(content);name=h+suffix;url='/atpl/media/'+name
  if name not in index and name not in pack:
   encoded=base64.b64encode(content).decode()
   if size+len(encoded)>6_000_000:flush()
   pack[name]=encoded;size+=len(encoded)
  assets[name]={'url':url,'bytes':len(content),'sha256':h};media[name]=url;return name
 import io
 for name,box in crop_index.items():
  raw=(extracted/'source-media'/name).read_bytes();im=Image.open(io.BytesIO(raw)).convert('RGB');crop=im.crop(tuple(box))
  assert 0<=box[0]<box[2]<=im.width and 0<=box[1]<box[3]<=im.height,name
  def encoded(image,tag):
   cached=extracted/'optimized-media'/(sha((name+str(box)+tag).encode())+'.webp')
   if not cached.exists():
    b=io.BytesIO();image.save(b,format='WEBP',lossless=True,method=3);write(cached,b.getvalue())
   content=cached.read_bytes();decoded=Image.open(io.BytesIO(content)).convert('RGB');assert decoded.size==image.size and decoded.tobytes()==image.tobytes()
   return content
  original=asset(encoded(im,'source'),'.webp');cropped=asset(encoded(crop,'crop'),'.webp')
  media_map[name]={'sourceAsset':original,'cropAsset':cropped,'sourceSize':list(im.size),'box':box,'sourcePixelSHA256':sha(im.tobytes()),'cropPixelSHA256':sha(crop.tobytes())}
  crop_index[name]={'original':original,'crop':cropped,'box':box}
 entries=[]
 topics={'FPL':['Flight plan for VFR','Flight plan for IFR','Fuel planning','Pre-flight preparation','ICAO flight plan','Flight monitoring and replanning'],'GNAV':['Basic navigation','Visual navigation','Great circles and rhumb lines','Charts and projections','Time']}
 for code,questions in source.items():
  qs=[];needed=set()
  for s in questions:
   assert s['uid'] in reviews,s['uid'];review=reviews[s['uid']].copy();review['referenceRecords']=[refs[r] for r in review['references']];review.setdefault('noteVi','');review['lesson']='imported'
   names=s['images']+[v for group in s['optionImages'].values() for v in group];figures=[crop_index[n]['crop'] for n in names];originals=[crop_index[n]['original'] for n in names];needed.update(figures+originals)
   blocked=bool(review.get('missingFigure'))
   qs.append(dict(id=s['id'],uid=s['uid'],sourceNumber=s['sourceNumber'],section=s['section'],sourceFile=s['sourceFile'],question=s['question'],options=s['options'],answer=s['sourceKey'],valid=True,red=False,topic=topics[code][s['section']-1],review=review,importedDOCX=True,importedFigures=figures,sourceScreenshots=originals,figureBlocked=blocked))
  info=dict(subjectId=code,name={'FPL':'Flight Planning & Monitoring','GNAV':'General Navigation'}[code],nameVi={'FPL':'Lập kế hoạch và giám sát bay','GNAV':'Dẫn đường tổng quát'}[code],version='Word import · 22.11.2026',questionCount=len(qs),redCount=0,conflictCount=sum(q['review']['status']=='conflict' for q in qs),limitedCount=sum(q['review']['status']=='limited' for q in qs),missing=[],source='Word do người dùng cung cấp',hasExplanations=True,isExplanationComplete=True,countAuthored=len(qs),importedDOCX=True)
  payload=dump({code:dict(info=info,questions=qs,lessons={})});identity=dict(code=code,bankSHA256=sha(payload.encode()),questions={str(q['id']):dict(uid=q['uid'],choices=list(q['options']),answer=q['answer']) for q in qs});identities[code]=identity
  html=template.replace('__TITLE__',info['name']).replace('__CODE__',code).replace('__PAYLOAD__',payload.replace('</','<\\/')).replace('__MEDIA__',dump({k:media[k] for k in sorted(needed)})).replace('__IDENTITY__',dump(identity))
  blob=html.encode();h=sha(blob);url=f'/atpl/banks/{code}-{h[:16]}.html';write(ROOT/'public'/url.lstrip('/'),blob)
  manifest=dict(code=code,sourceSHA256=sha(dump([s for s in json.loads((DATA/'source-manifest.json').read_text()) if s['code']==code]).encode()),assets=[dict(url=url,bytes=len(blob),sha256=h)]+[assets[k] for k in sorted(needed)])
  raw=dump(manifest).encode();mh=sha(raw);mp=f'/atpl/manifests/{code}-{mh[:16]}.json';write(ROOT/'public'/mp.lstrip('/'),raw)
  entries.append(dict(code=code,name=info['name'],count=len(qs),reference=False,url=url,manifest=mp,manifestSHA256=mh,offlineBytes=sum(a['bytes'] for a in manifest['assets']),assetCount=len(manifest['assets']),bankSHA256=identity['bankSHA256']))
 flush();write(DATA/'media-map.json',dump(media_map));write(packdir/'index.json',dump(index));catalog['banks']=[b for b in catalog['banks'] if b['code'] not in source]+entries;catalog['version']=catalog['sourceSHA256'][:12]+'-account-v1-fpl-gnav';write(OUT/'catalog.json',dump(catalog));write(OUT/'identities.json',dump(identities));print([(e['code'],e['count'],e['offlineBytes']) for e in entries])
if __name__=='__main__':main(Path(sys.argv[1]))
