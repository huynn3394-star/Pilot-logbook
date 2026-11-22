"""Verify edited book excerpts against exact source PDFs supplied in a directory.
Read-only: no source document is modified and no PDF is shipped to the app.
"""
from pathlib import Path
from pypdf import PdfReader
import hashlib,json,logging,sys
logging.disable(logging.CRITICAL)
ROOT=Path(__file__).resolve().parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
def main(folder):
 data=json.loads((ROOT/'data/atpl-additions/book-sources.json').read_text());byhash={}
 for p in folder.glob('*.pdf'):
  with p.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
  byhash[digest]=p
 checked=0
 for code,b in data['books'].items():
  assert b['pdfSHA256'] in byhash,'Missing exact source PDF for '+code
  reader=PdfReader(byhash[b['pdfSHA256']]);assert len(reader.pages)==b['pdfPages'],code
  for key,c in data['citations'].items():
   if c['book']!=code:continue
   page=' '.join(reader.pages[c['pdfPage']-1].extract_text().split())
   assert sha(page.encode())==c['pageTextSHA256'],key+' page text differs'
   assert not c['quote'] or c['quote'] in page,key+' quotation missing'
   checked+=1
 print('Verified',checked,'page references against',len(data['books']),'exact PDF files')
if __name__=='__main__':main(Path(sys.argv[1]))
