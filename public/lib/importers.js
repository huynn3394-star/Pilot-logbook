import { readA320Scan } from "./a320-scan.js";
import { findMCDUScreen, validScanCrop } from "./scan-screen.js";
export async function extractPDF(file, onProgress = () => {}) {
  if (file.size > 20 * 1024 * 1024) throw Error("PDF tối đa 20 MB");
  const pdfjs = await import("/vendor/pdfjs/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/build/pdf.worker.mjs";
  const doc = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false,
  }).promise;
  if (doc.numPages > 60) {
    await doc.destroy();
    throw Error("PDF tối đa 60 trang. Chọn roster theo tháng.");
  }
  let text = "";
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(`Đang đọc trang ${n}/${doc.numPages}`);
      const p = await doc.getPage(n),
        c = await p.getTextContent();
      let y = null;
      for (const i of c.items) {
        if (!("str" in i)) continue;
        if (y !== null && Math.abs(i.transform[5] - y) > 3) text += "\n";
        text += i.str + " ";
        y = i.transform[5];
      }
      text += "\n";
    }
  } finally {
    await doc.destroy();
  }
  if (!text.trim())
    throw Error("PDF dạng scan chưa có chữ. Hãy nhập văn bản roster thủ công.");
  return text;
}
let script;
export async function extractImage(file, onProgress = () => {}, {family, crop, onRegion, mode='auto'} = {}) {
  if (file.size > 6 * 1024 * 1024) throw Error("Ảnh tối đa 6 MB");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Dùng ảnh JPG, PNG hoặc WebP (HEIC cần đổi sang JPG).");
  if (mode === 'manual' && !validScanCrop(crop)) throw Error('Khoanh vùng màn hình đủ rộng trước khi đọc lại.');
  script ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/tesseract/tesseract.min.js";
    s.onload = resolve;
    s.onerror = () => {
      script = null;
      reject(Error("Không tải được OCR"));
    };
    document.head.append(s);
  });
  await script;
  const w = await window.Tesseract.createWorker("eng", 1, {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract-core",
    logger: m => onProgress(m.status + " " + Math.round((m.progress || 0) * 100) + "%"),
  });
  try {
    if (family === 'A320') {
      const screen = mode==='full' ? null : await a320Screen(file, {crop,manual:mode==='manual',onRegion});
      if(screen){
        onProgress(mode==='manual'?'OCR vùng do bạn chọn…':'Đã nhận diện màn hình AOC · đang đọc…');
        await w.setParameters({tessedit_pageseg_mode:'6'});
        const first=(await w.recognize(screen)).data.text;
        const scan=readA320Scan(first);
        // Only spend a second OCR pass if the cropped reading lacks key data.
        const complete = !!scan.flightNo && !!scan.dep && !!scan.dest && Object.keys(scan.clocks).length===4 && scan.mismatch===0;
        if(complete || mode==='manual')return first;
        onProgress('Một số trường chưa rõ; thử đọc thêm toàn ảnh…');
        await w.setParameters({tessedit_pageseg_mode:'11'});
        const fallback=(await w.recognize(file)).data.text;
        const other=readA320Scan(fallback);
        const score=s=>(s.flightNo?15:0)+(s.dep&&s.dest?25:0)+Object.keys(s.clocks).length*10+s.verified*12-s.mismatch*20;
        return score(other)>score(scan)?fallback:first;
      }
      if(mode==='manual')throw Error('Không tạo được vùng ảnh để OCR. Khoanh lại rồi thử.');
      onProgress('Không xác định chắc chắn khung màn hình; đọc toàn ảnh để bạn kiểm tra.');
    }
    if (family === 'E190' && mode !== 'full') {
      const screen = await e190Screen(file);
      if(screen){await w.setParameters({tessedit_pageseg_mode:'6'});const text=(await w.recognize(screen)).data.text;if(/\b(?:OUT|0UT|OFF|ON|IN)\b/i.test(text))return text;}
    }
    return (await w.recognize(file)).data.text;
  } finally {
    await w.terminate();
  }
}

// Work on the original pixels, never modify the attached evidence photo.
async function a320Screen(file,{crop,manual,onRegion}={}){
  const image=await createImageBitmap(file);
  try {
    let rectangle=crop;
    if(!manual){
      const scale=Math.min(1,900/Math.max(image.width,image.height));
      const width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)return null;
      ctx.drawImage(image,0,0,width,height);
      rectangle=findMCDUScreen(ctx.getImageData(0,0,width,height).data,width,height);
    }
    onRegion?.(rectangle||null);
    if(!validScanCrop(rectangle))return null;
    const sx=Math.round(rectangle.x*image.width),sy=Math.round(rectangle.y*image.height),
      sw=Math.min(image.width-sx,Math.round(rectangle.width*image.width)),
      sh=Math.min(image.height-sy,Math.round(rectangle.height*image.height));
    if(sw<50||sh<50)return null;
    const factor=Math.min(2,1700/Math.max(sw,sh));
    const result=document.createElement('canvas');result.width=Math.round(sw*factor);result.height=Math.round(sh*factor);
    const c=result.getContext('2d',{willReadFrequently:true});
    if(!c)return null;
    c.drawImage(image,sx,sy,sw,sh,0,0,result.width,result.height);
    const data=c.getImageData(0,0,result.width,result.height);
    for(let p=0;p<data.data.length;p+=4){
      const light=Math.max(data.data[p],data.data[p+1],data.data[p+2]);
      const pixel=255-Math.max(0,Math.min(255,(light-45)*255/160));
      data.data[p]=data.data[p+1]=data.data[p+2]=pixel;
    }
    c.putImageData(data,0,0);
    return result;
  } finally {
    image.close();
  }
}
export function asDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Locate a dark display with green characters; do not assume a fixed photo crop.
async function e190Screen(file){
 const image=await createImageBitmap(file);try{
 const scale=Math.min(1,900/Math.max(image.width,image.height)),width=Math.round(image.width*scale),height=Math.round(image.height*scale),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height).data,seen=new Uint8Array(width*height),queue=new Int32Array(width*height),candidates=[];
 const dark=i=>Math.max(pixels[i*4],pixels[i*4+1],pixels[i*4+2])<85;
 for(let start=0;start<seen.length;start++){if(seen[start]||!dark(start))continue;let count=0,head=0,tail=1,minX=width,maxX=0,minY=height,maxY=0;queue[0]=start;seen[start]=1;while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const n of[x?i-1:-1,x<width-1?i+1:-1,y?i-width:-1,y<height-1?i+width:-1])if(n>=0&&!seen[n]&&dark(n)){seen[n]=1;queue[tail++]=n;}}
 const w=maxX-minX+1,h=maxY-minY+1,area=w*h;if(w<width*.15||h<height*.08||w/h<.8||w/h>2.6||area<width*height*.025||count/area<.45)continue;
 let green=0;for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(g>100&&g>r*1.08&&g>b*1.1)green++;}if(green/area>.003)candidates.push({x:minX,y:minY,w,h,score:green});
 }
 const best=candidates.sort((a,b)=>b.score-a.score)[0];if(!best)return null;
 const crop=document.createElement('canvas');crop.width=best.w*4;crop.height=best.h*4;const c=crop.getContext('2d');c.drawImage(canvas,best.x,best.y,best.w,best.h,0,0,crop.width,crop.height);const data=c.getImageData(0,0,crop.width,crop.height);for(let i=0;i<data.data.length;i+=4){const light=Math.max(data.data[i],data.data[i+1],data.data[i+2]),v=255-Math.min(255,Math.max(0,(light-45)*255/160));data.data[i]=data.data[i+1]=data.data[i+2]=v;}c.putImageData(data,0,0);return crop;
 }finally{image.close();}
}
