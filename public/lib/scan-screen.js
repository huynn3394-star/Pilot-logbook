// Detect a dark MCDU display with bright green text. Operates on scaled pixels.
// Returned normalized rectangle is advisory: scanning falls back to the original photo.
export function findMCDUScreen(imageData, width, height) {
  if (!imageData || imageData.length < width*height*4 || width<100 || height<100) return null;
  const count = width*height, seen=new Uint8Array(count),queue=new Int32Array(count);
  let best=null;
  const isDark = i => {
    const p=i*4;
    return Math.max(imageData[p],imageData[p+1],imageData[p+2])<83;
  };
  const minArea=count*0.032;
  for(let start=0; start<count; start++){
    if(seen[start])continue;
    seen[start]=1;
    if(!isDark(start))continue;
    let head=0,tail=1,minX=width,maxX=0,minY=height,maxY=0;
    queue[0]=start;
    while(head<tail){
      const i=queue[head++], x=i%width, y=Math.floor(i/width);
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      const neighbors=[x?i-1:-1,x+1<width?i+1:-1,y?i-width:-1,y+1<height?i+width:-1];
      for(const n of neighbors)if(n>=0&&!seen[n]){seen[n]=1;if(isDark(n))queue[tail++]=n;}
    }
    if(tail<minArea)continue;
    const w=maxX-minX+1,h=maxY-minY+1,area=w*h,aspect=w/h;
    if(w<width*.22 || h<height*.14 || area<count*.055 || area>count*.88 || aspect<.72 || aspect>3.2 || tail/area<.45)continue;
    let green=0;
    // Character pixels need not themselves be part of the connected dark component.
    for(let y=minY;y<=maxY;y+=2)for(let x=minX;x<=maxX;x+=2){
      const p=(y*width+x)*4,r=imageData[p],g=imageData[p+1],b=imageData[p+2];
      if(g>95 && g>r*1.11 && g>b*1.08)green++;
    }
    const density=green/(area/4);
    if(density<.004)continue;
    const score=tail*(1+Math.min(.15,density*2));
    if(!best||score>best.score)best={score,minX,maxX,minY,maxY};
  }
  if(!best)return findGreenTextRegion(imageData,width,height);
  const padX=Math.max(4,(best.maxX-best.minX)*.018),padY=Math.max(4,(best.maxY-best.minY)*.018);
  const x=Math.max(0,best.minX-padX), y=Math.max(0,best.minY-padY);
  const x2=Math.min(width,best.maxX+1+padX),y2=Math.min(height,best.maxY+1+padY);
  return {x:x/width,y:y/height,width:(x2-x)/width,height:(y2-y)/height};
}
export function validScanCrop(value){
  if(!value || !['x','y','width','height'].every(k=>Number.isFinite(value[k])))return false;
  return value.x>=0&&value.y>=0&&value.width>=.08&&value.height>=.08&&value.x+value.width<=1.001&&value.y+value.height<=1.001;
}


// At night the black display can merge with its dark bezel/cockpit. In that
// case use multiple separated green character rows as an advisory crop only.
// Reject isolated lamps, solid green panels and weak/bright-background matches.
function findGreenTextRegion(data,width,height){
  const rows=[];let count=0;
  for(let y=0;y<height;y++){
    let n=0,minX=width,maxX=-1;
    for(let x=0;x<width;x++){
      const p=(y*width+x)*4,r=data[p],g=data[p+1],b=data[p+2];
      if(g>95&&g>r*1.11&&g>b*1.08){n++;minX=Math.min(minX,x);maxX=x;}
    }
    if(n>=Math.max(6,width*.012))rows.push({y,n,minX,maxX});
  }
  if(!rows.length)return null;
  const bands=[];
  for(const row of rows){
    let band=bands.at(-1);
    if(!band||row.y-band.maxY>Math.max(3,height*.01)){
      band={minY:row.y,maxY:row.y,minX:width,maxX:-1,n:0};bands.push(band);
    }
    band.maxY=row.y;band.minX=Math.min(band.minX,row.minX);band.maxX=Math.max(band.maxX,row.maxX);band.n+=row.n;
  }
  const text=bands.filter(b=>b.maxY-b.minY>=2&&b.n>=Math.max(25,width*.08));
  if(text.length<4)return null;
  const minX=Math.min(...text.map(b=>b.minX)),maxX=Math.max(...text.map(b=>b.maxX)),minY=text[0].minY,maxY=text.at(-1).maxY;
  const w=maxX-minX+1,h=maxY-minY+1;
  count=text.reduce((sum,b)=>sum+b.n,0);
  if(w<width*.22||h<height*.12||w/h<.7||w/h>3.5||count/(w*h)<.005||count/(w*h)>.3)return null;
  // Include the white page header above the first green row and footer below.
  const x=Math.max(0,minX-w*.08),y=Math.max(0,minY-h*.32),x2=Math.min(width,maxX+1+w*.08),y2=Math.min(height,maxY+1+h*.24);
  let dark=0,total=0;
  for(let yy=Math.floor(y);yy<y2;yy+=2)for(let xx=Math.floor(x);xx<x2;xx+=2){const p=(yy*width+xx)*4;total++;if(Math.max(data[p],data[p+1],data[p+2])<100)dark++;}
  if(dark/total<.55)return null;
  return {x:x/width,y:y/height,width:(x2-x)/width,height:(y2-y)/height};
}
