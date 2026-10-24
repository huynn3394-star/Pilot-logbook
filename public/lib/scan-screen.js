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
  if(!best)return null;
  const padX=Math.max(4,(best.maxX-best.minX)*.018),padY=Math.max(4,(best.maxY-best.minY)*.018);
  const x=Math.max(0,best.minX-padX), y=Math.max(0,best.minY-padY);
  const x2=Math.min(width,best.maxX+1+padX),y2=Math.min(height,best.maxY+1+padY);
  return {x:x/width,y:y/height,width:(x2-x)/width,height:(y2-y)/height};
}
export function validScanCrop(value){
  if(!value || !['x','y','width','height'].every(k=>Number.isFinite(value[k])))return false;
  return value.x>=0&&value.y>=0&&value.width>=.08&&value.height>=.08&&value.x+value.width<=1.001&&value.y+value.height<=1.001;
}
