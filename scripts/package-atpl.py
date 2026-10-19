"""Repackage an audited self-contained trainer for same-origin web/offline use.
No question/answer/scoring edits. Run with the verified source HTML as argv1.
"""
from pathlib import Path
import re,json,hashlib,base64,sys
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/atpl'
SOURCE_HASH='28fbacae42e5b05023c89b077d977e62184a2e916da0dc7d14bd521acd89239f'
def sha(b):return hashlib.sha256(b).hexdigest()
def dump(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def main():
 p=Path(sys.argv[1]);raw=p.read_bytes();assert sha(raw)==SOURCE_HASH,'Use the verified19October bank, not an earlier version';s=raw.decode()
 tags={m[1]:m for m in re.finditer(r'<script[^>]*id="(bank-data|media-data)"[^>]*>(.*?)</script>',s,re.S)}
 banks=json.loads(tags['bank-data'][2]);media=json.loads(tags['media-data'][2]);engine=re.search(r'/\* ATPL state engine.*?</script>',s,re.S)[0];engine_hash=sha(engine.encode())
 for d in ['media','banks','manifests']:(OUT/d).mkdir(parents=True,exist_ok=True)
 assets={};files={};pack={};pack_size=0;pack_no=0;image_index={};pack_dir=ROOT/'data/atpl-media';pack_dir.mkdir(parents=True,exist_ok=True)
 def flush():
  nonlocal pack,pack_size,pack_no
  if not pack:return
  name=f'pack-{pack_no:03}.json';(pack_dir/name).write_text(dump(pack))
  for key in pack:image_index[key]=name
  pack={};pack_size=0;pack_no+=1
 for key,uri in media.items():
  assert uri.startswith('data:image/');head,b64=uri.split(',',1);content=base64.b64decode(b64);ext={'image/webp':'webp','image/png':'png','image/jpeg':'jpg'}[head[5:].split(';')[0]];h=sha(content);url=f'/atpl/media/{h}.{ext}'
  assets[key]=url
  if url not in files:
   if pack_size+len(b64)>8_000_000:flush()
   pack[f'{h}.{ext}']=b64;pack_size+=len(b64)
  files[url]=dict(url=url,bytes=len(content),sha256=h)
 flush();(pack_dir/'index.json').write_text(dump(image_index))
 for old in pack_dir.glob('pack-*.json'):
  if old.name not in set(image_index.values()):old.unlink()
 for old in (OUT/'media').iterdir():old.unlink()
 # Small shell without either large JSON tag; serialize each bank independently.
 template=s
 for name in ['bank-data','media-data']:
  template=re.sub(r'(<script[^>]*id="'+name+r'"[^>]*>).*?(</script>)',lambda m:m[1]+'__'+name+'__'+m[2],template,count=1,flags=re.S)
 scripts=list(re.finditer(r'<script([^>]*)>(.*?)</script>',template,re.S))
 first=scripts[0];template=template[:first.start(2)]+'__BOOT__'+template[first.end(2):]
 scripts=list(re.finditer(r'<script([^>]*)>(.*?)</script>',template,re.S));last=scripts[-1];template=template[:last.start()]+'<script type="module" src="/atpl/bank-bridge.js"></script>'+template[last.end():]
 template=template.replace('nội dung và ảnh nguồn nằm trong file này.','nội dung học và ảnh nguồn có thể tải trước bằng nút Offline. Tiến độ vẫn lưu riêng trên trình duyệt này.')
 entries=[]
 for code,bank in banks.items():
  payload=dump({code:bank});needed={k:v for k,v in assets.items() if json.dumps(k,ensure_ascii=False) in payload or (code=='POF' and re.fullmatch(r'p\d+',k)) or (code in ['MB','MBR'] and k=='mb_textbook_pdf_54')};html=template.replace('__bank-data__',payload).replace('__media-data__',dump(needed)).replace('__BOOT__',f"window.ATPL_SUBJECT='{code}';document.body.dataset.screen='study';")
  assert sha(re.search(r'/\* ATPL state engine.*?</script>',html,re.S)[0].encode())==engine_hash
  assert json.loads(re.search(r'<script[^>]*id="bank-data"[^>]*>(.*?)</script>',html,re.S)[1])=={code:bank}
  html=html.replace('<title>ATPL Trainer · 11 bộ đề · Rà soát bổ sung 422 câu · Giữ key gốc</title>',f'<title>{bank["info"]["name"]} · ATPL · AviLog</title>')
  content=html.encode();h=sha(content);url=f'/atpl/banks/{code}-{h[:16]}.html';(ROOT/'public'/url.lstrip('/')).write_bytes(content)
  items=[dict(url=url,bytes=len(content),sha256=h)]+[files[u] for u in sorted(set(needed.values()))]
  manifest=dict(code=code,sourceSHA256=SOURCE_HASH,assets=items);blob=dump(manifest).encode();mh=sha(blob);mp=f'/atpl/manifests/{code}-{mh[:16]}.json';(ROOT/'public'/mp.lstrip('/')).write_bytes(blob)
  entries.append(dict(code=code,name=bank['info']['name'],count=sum(q['valid'] for q in bank['questions']),reference=code=='MBR',url=url,manifest=mp,manifestSHA256=mh,offlineBytes=sum(a['bytes'] for a in items),assetCount=len(items),bankSHA256=sha(payload.encode())))
 catalog=dict(version=SOURCE_HASH[:12]+'-offline-v1',sourceSHA256=SOURCE_HASH,engineSHA256=engine_hash,banks=entries)
 (OUT/'catalog.json').write_text(dump(catalog))
 keep={x['url'].split('/')[-1] for x in entries}|{x['manifest'].split('/')[-1] for x in entries}
 for sub in ['banks','manifests']:
  for old in (OUT/sub).iterdir():
   if old.name not in keep:old.unlink()
 print('Packaged',len(entries),'banks;',len(files),'deduplicated images;',round(sum(x['bytes'] for x in files.values())/1e6,1),'MB images')
 print('Per bank:',[(b['code'],b['count'],round(b['offlineBytes']/1e6,1)) for b in entries])
if __name__=='__main__':main()
