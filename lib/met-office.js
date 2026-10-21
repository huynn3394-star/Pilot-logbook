import {officeSources,reportTiming} from '../public/workspace/weather-report.js';
const ORIGIN='http://118.69.213.84',LOGIN=ORIGIN+'/index.php';
function text(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):+v;return n>=0&&n<=0x10ffff?String.fromCodePoint(n):' ';}).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');}
export function parseOfficeReports(html,product){
 const pre=[...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)].map(m=>m[1]).join('\n');
 const raw=text(pre||html),pattern=product==='taf'?/\bTAF\s+(?:(?:AMD|COR)\s+)?([A-Z]{4})\s+\d{6}Z\b[^=]*=/g:/\b(?:METAR|SPECI)\s+(?:COR\s+)?([A-Z]{4})\s+\d{6}Z\b[^=]*=/g;
 const records=[];for(const match of raw.matchAll(pattern)){const value=match[0].trim();if(value.length<=32768)records.push({station:match[1],raw:value});}return records;
}
export class MetOfficeProvider{
 name='Tan Son Nhat MET Office';
 constructor({username,password,fetchImpl=fetch,now=()=>new Date(),ttl=300000}={}){this.username=username;this.password=password;this.fetchImpl=fetchImpl;this.now=now;this.ttl=ttl;this.cookies=new Map();this.loginPending=null;this.pending=null;this.cached=null;this.failedAt=0;}
 async request(url,options={},redirects=0){
  const response=await this.fetchImpl(url,{...options,redirect:'manual',signal:AbortSignal.timeout(5000),headers:{'User-Agent':'AviLog/0.1',...options.headers,...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; ')}:{})}});
  for(const item of response.headers.getSetCookie?.()||[]){const pair=item.split(';')[0],i=pair.indexOf('=');if(i>0&&pair.length<=4096&&/^[\w-]+$/.test(pair.slice(0,i))&&this.cookies.size<20)this.cookies.set(pair.slice(0,i),pair.slice(i+1));}
  if(response.status>=300&&response.status<400){const target=new URL(response.headers.get('location')||'',url);if(redirects>=3||target.origin!==ORIGIN||target.pathname!=='/index.php')throw Error('MET redirect rejected');return this.request(target.href,{method:'GET'},redirects+1);}
  if(!response.ok)throw Error('MET source unavailable');const html=await response.text();if(html.length>2*1024*1024)throw Error('MET response too large');return html;
 }
 async login(){
  if(this.loginPending)return this.loginPending;
  if(!this.username||!this.password)throw Error('MET source not configured');
  this.loginPending=(async()=>{const body=new URLSearchParams({act:'login',req:'99,99',txtUsername:this.username,txtPassword:this.password,cmdLogin:'Login'});const html=await this.request(LOGIN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(!/Logout/i.test(html))throw Error('MET sign-in unavailable');})();
  try{await this.loginPending;}finally{this.loginPending=null;}
 }
 async feeds(){
  const time=this.now().getTime();if(this.cached&&time-this.cached.at<this.ttl)return this.cached;
  if(this.pending)return this.pending;if(this.failedAt&&time-this.failedAt<30000)throw Error('MET source temporarily unavailable');
  this.pending=(async()=>{try{
   if(!this.cookies.size)await this.login();
   let pages=await Promise.all(Object.values(officeSources).map(url=>this.request(url)));
   if(pages.some(html=>!/Logout/i.test(html))){await this.login();pages=await Promise.all(Object.values(officeSources).map(url=>this.request(url)));}
   if(pages.some(html=>!/Logout/i.test(html)))throw Error('MET session expired');
   this.cached={at:this.now().getTime(),metar:parseOfficeReports(pages[0],'metar'),taf:parseOfficeReports(pages[1],'taf')};return this.cached;
  }catch{this.failedAt=this.now().getTime();throw Error('MET source temporarily unavailable');}finally{this.pending=null;}})();return this.pending;
 }
 async fetch(station){if(!/^VV[A-Z]{2}$/.test(station))return{metar:null,taf:null,sources:{}};const feeds=await this.feeds(),result={metar:null,taf:null,sources:{}};
  for(const product of['metar','taf']){const candidates=feeds[product].filter(r=>r.station===station).map(r=>({...r,t:reportTiming(r.raw,product,this.now())})).filter(r=>r.t).sort((a,b)=>Date.parse(b.t.issuedAt)-Date.parse(a.t.issuedAt)||( /\bCOR\b/.test(b.raw)?2:/\bAMD\b/.test(b.raw)?1:0)-( /\bCOR\b/.test(a.raw)?2:/\bAMD\b/.test(a.raw)?1:0));if(candidates.length)result[product]=candidates[0].raw;if(result[product])result.sources[product]=officeSources[product];}return result;
 }
}
