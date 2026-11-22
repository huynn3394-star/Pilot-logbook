"""Read-only OOXML import; preserve wording, bold source key and image relationships.
Run with the bundled Python runtime and an explicit source directory.
"""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
import hashlib,json,re,sys,posixpath,base64
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS={'w':W,'a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':R,'v':'urn:schemas-microsoft-com:vml'}
sha=lambda b:hashlib.sha256(b).hexdigest()
dump=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
def extract(src,out):
 out.mkdir(parents=True,exist_ok=True);allq={};sources=[];media={}
 for prefix,code in [('FLIGHT PLAN-','FPL'),('GNAV-','GNAV')]:
  questions=[]
  for file in sorted(src.glob(prefix+'*.docx')):
   section=int(re.search(r'-(\d+)',file.name)[1]);raw=file.read_bytes()
   with ZipFile(file) as z:
    x=E.fromstring(z.read('word/document.xml'));rels={n.get('Id'):posixpath.normpath('word/'+n.get('Target')) for n in E.fromstring(z.read('word/_rels/document.xml.rels')) if n.get('TargetMode')!='External'}
    source={'file':file.name,'sha256':sha(raw),'code':code,'section':section,'questions':0,'embeddedImages':0};current=None;lastoption=None
    for pi,p in enumerate(x.xpath('//w:body//w:p',namespaces=NS)):
     text=''.join(p.xpath('.//w:t/text()',namespaces=NS)).strip()
     images=[]
     for rid in p.xpath('.//a:blip/@r:embed|.//v:imagedata/@r:id',namespaces=NS):
      target=rels[rid];content=z.read(target);suffix=Path(target).suffix.lower().replace('.jpeg','.jpg');key=sha(content)+suffix
      media[key]=content;images.append(key);source['embeddedImages']+=1
     m=re.match(r'^(\d+)[.\)]\s+',text);opt=re.match(r'^([a-hA-H])[.)]\s*',text)
     if m:
      current={'id':len(questions)+1,'uid':f'{code}-{section:02}-{int(m[1]):03}','sourceNumber':int(m[1]),'section':section,'sourceFile':file.name,'question':text[m.end():],'options':{},'sourceKey':None,'sourceKeyMethod':'bold-in-user-docx','images':images,'optionImages':{},'paragraph':pi,'boldEvidence':{}};questions.append(current);source['questions']+=1;lastoption=None
     elif opt and current:
      key=opt[1].upper();assert key not in current['options'],(file.name,current['uid'],key)
      current['options'][key]=text[opt.end():];current['optionImages'][key]=images;lastoption=key
      total=bold=0
      for run in p.xpath('./w:r|./w:hyperlink/w:r',namespaces=NS):
       t=''.join(run.xpath('.//w:t/text()',namespaces=NS));n=len(re.sub(r'\s','',t));total+=n
       b=run.find('w:rPr/w:b',NS)
       if b is None:b=p.find('w:pPr/w:rPr/w:b',NS)
       if b is not None and b.get('{'+W+'}val','1') not in ['0','false','off']:bold+=n
      current['boldEvidence'][key]={'chars':total,'boldChars':bold}
     elif current:
      if text:
       if lastoption:current['options'][lastoption]+='\n'+text
       else:current['question']+='\n'+text
      if images:
       if lastoption:current['optionImages'][lastoption]+=images
       else:current['images']+=images
    sources.append(source)
  for q in questions:
   bold=[k for k,v in q['boldEvidence'].items() if v['chars'] and v['boldChars']/v['chars']>.6]
   q['sourceKey']=bold[0] if len(bold)==1 else None
   q['keyCandidates']=bold
  allq[code]=questions
 (out/'source-questions.json').write_text(dump(allq));(out/'source-manifest.json').write_text(dump(sources))
 mediaout=out/'source-media';mediaout.mkdir(exist_ok=True)
 for key,b in media.items():(mediaout/key).write_bytes(b)
 print(dump({'counts':{k:len(v) for k,v in allq.items()},'uniqueImages':len(media),'missingKeys':[(q['uid'],q['keyCandidates']) for qs in allq.values() for q in qs if q['sourceKey'] is None],'optionCounts':{str(n):sum(len(q['options'])==n for qs in allq.values() for q in qs) for n in range(2,9)},'sources':sources}))
if __name__=='__main__':extract(Path(sys.argv[1]),Path(sys.argv[2]))
