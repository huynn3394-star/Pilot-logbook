import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findMCDUScreen,validScanCrop} from '../public/lib/scan-screen.js';
function fakeScreen(){
 const width=240,height=180, data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,screen=x>=36&&x<=201&&y>=27&&y<=142;
  data[i]=data[i+1]=data[i+2]=screen?25:180;data[i+3]=255;
  if(screen&&x>=55&&x<=183&&y>=60&&y<=100&&x%5===0&&y%3===0){data[i]=20;data[i+1]=200;data[i+2]=38;}
 }
 return{width,height,data};
}
test('findMCDUScreen finds a green-text dark display, not the surrounding frame',()=>{
 const {data,width,height}=fakeScreen();
 const rect=findMCDUScreen(data,width,height);
 assert.ok(validScanCrop(rect));
 assert.ok(rect.x>.10 && rect.x<.20,`x ${rect.x}`);
 assert.ok(rect.y>.09 && rect.y<.20,`y ${rect.y}`);
 assert.ok(rect.width>.60 && rect.height>.55);
});
test('no green text or incomplete region never produces an imaginary screen',()=>{
 const {data,width,height}=fakeScreen();
 for(let p=0;p<data.length;p+=4)if(data[p]===20&&data[p+1]===200){data[p]=data[p+1]=data[p+2]=20;}
 assert.equal(findMCDUScreen(data,width,height),null);
 assert.equal(validScanCrop({x:.5,y:.5,width:.6,height:.4}),false);
 assert.equal(validScanCrop({x:0,y:0,width:.02,height:.3}),false);
});
