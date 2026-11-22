"""Render only cited pages from the supplied Oxford books; keep bank identities intact.

Usage: python render_book_pages.py SOURCE_DIR --pdftoppm /path/to/pdftoppm
Full PDF pages (including figures and printed page numbers) are retained. Images
are deduplicated and appended to the existing content-addressed media packs.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse,base64,hashlib,io,json,subprocess
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'data/atpl-additions'
sha=lambda b:hashlib.sha256(b).hexdigest()
dump=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':'))
def main(args):
 db=json.loads((D/'book-sources.json').read_text());mapping=json.loads((D/'question-book-sources.json').read_text())
 used={i for ids in mapping.values() for i in ids}
 pages=sorted({(c['book'],c['pdfPage']) for i,c in db['citations'].items() if i in used and db['books'][c['book']].get('providedByUser')})
 cache=Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True)
 sources={}
 for book,_ in pages:
  b=db['books'][book];p=Path(args.source_dir)/b['sourceFile']
  if book not in sources:assert sha(p.read_bytes())==b['pdfSHA256'],book;sources[book]=p
 def render(item):
  book,page=item;b=db['books'][book];prefix=cache/f'{book}-{page:03}'
  if not prefix.with_suffix('.png').exists():
   subprocess.run([args.pdftoppm,'-f',str(page),'-l',str(page),'-r','180','-scale-to','2400','-png','-singlefile',str(sources[book]),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  with Image.open(prefix.with_suffix('.png')) as original:
   im=original.convert('RGB');buf=io.BytesIO();im.save(buf,format='WEBP',quality=88,method=6);raw=buf.getvalue()
   record=dict(book=book,pdfPage=page,printedPage=str(page-6),pdfSHA256=b['pdfSHA256'],renderPixelSHA256=sha(im.tobytes()),width=im.width,height=im.height,url='/atpl/media/'+sha(raw)+'.webp',bytes=len(raw),sha256=sha(raw))
  prefix.with_suffix('.webp').write_bytes(raw)
  return book+':'+str(page),record,raw
 with ThreadPoolExecutor(max_workers=4) as pool:rendered=list(pool.map(render,pages))
 directory=ROOT/'data/atpl-media';index=json.loads((directory/'index.json').read_text());number=max(int(p.stem.split('-')[1]) for p in directory.glob('pack-*.json'))+1
 pack={};length=0;records={}
 def flush():
  nonlocal number,pack,length
  if not pack:return
  name=f'pack-{number:03}.json';(directory/name).write_text(dump(pack));index.update({key:name for key in pack});number+=1;pack={};length=0
 for key,record,raw in rendered:
  records[key]=record;name=record['url'].split('/')[-1]
  if name in index or name in pack:continue
  encoded=base64.b64encode(raw).decode()
  if length+len(encoded)>6_000_000:flush()
  pack[name]=encoded;length+=len(encoded)
 flush();(directory/'index.json').write_text(dump(index))
 (D/'book-page-images.json').write_text(json.dumps({'version':1,'render':{'dpi':180,'maxSide':2400,'webpQuality':88,'wholePage':True},'pages':records},ensure_ascii=False,indent=2)+'\n')
 # Contact sheets are authoring evidence only, never included in the app bundle.
 for offset in range(0,len(rendered),24):
  sheet=Image.new('RGB',(1400,2200),'#ddd');draw=ImageDraw.Draw(sheet)
  for pos,(key,record,raw) in enumerate(rendered[offset:offset+24]):
   with Image.open(io.BytesIO(raw)) as im:thumb=ImageOps.contain(im,(320,330))
   x=(pos%4)*350+(350-thumb.width)//2;y=(pos//4)*365
   sheet.paste(thumb,(x,y+22));draw.text(((pos%4)*350+8,y+4),key,fill='black')
  sheet.save(cache/f'contact-{offset//24+1}.jpg',quality=90)
 print('Rendered',len(records),'unique pages;',sum(r['bytes'] for r in records.values()),'image bytes')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source_dir');p.add_argument('--pdftoppm',default='pdftoppm');p.add_argument('--cache-dir',default='/tmp/avilog-book-page-images-render');main(p.parse_args())
