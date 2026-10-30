// Exercise the real PDF.js browser module and worker after the security update.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');

function rosterPDF(pages=1){
 const text='09/10 VN7388 SGN-DLI 07:14-08:06';
 const stream=`BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${i+3} 0 R`).join(' ')}] /Count ${pages} >>`,
  ...Array.from({length:pages},()=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${pages+3} 0 R >> >> /Contents ${pages+4} 0 R >>`),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
 ];
 let data='%PDF-1.4\n',offsets=[0];
 objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(data);
 data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))data+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 return data+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

(async()=>{
 const {createServer}=await import('../server.js');
 const server=createServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const [name,engine] of Object.entries({chromium,webkit})){
   const browser=await engine.launch({headless:true});
   try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    const text=await page.evaluate(async pdf=>{
     const {extractPDF}=await import('/lib/importers.js');
     return extractPDF(new File([pdf],'synthetic-roster.pdf',{type:'application/pdf'}));
    },rosterPDF());
    assert.equal(text.trim(),'09/10 VN7388 SGN-DLI 07:14-08:06',name+' real PDF extraction');
    const recovery=await page.evaluate(async ({oversized,valid})=>{
     const {extractPDF}=await import('/lib/importers.js');
     let message;try{await extractPDF(new File([oversized],'too-many-pages.pdf'));}catch(error){message=error.message;}
     const text=await extractPDF(new File([valid],'retry.pdf'));
     return {message,text};
    },{oversized:rosterPDF(61),valid:rosterPDF()});
    assert.match(recovery.message,/PDF tối đa 60 trang/,name+' page limit retained');
    assert.equal(recovery.text.trim(),text.trim(),name+' worker can reopen after rejection');
    assert.deepEqual(errors,[],name+' browser errors');
    console.log('PASS '+name+' PDF extraction, 60-page limit and recovery using real PDF.js worker');
   }finally{await browser.close();}
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
