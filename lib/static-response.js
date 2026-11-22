import {createHash} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';

const zip=promisify(gzip);
// Cache only public compressed representations, with a fixed memory budget.
// Keys include the content digest, so a changed file cannot reuse old bytes.
export function createStaticResponder({maxBytes=8*1024*1024}={}){
 const variants=new Map();let used=0;
 return async function staticResponse(req,data,{compress=false,immutable=false}={}){
  const digest=createHash('sha256').update(data).digest('hex'),etag=`W/"${digest}"`;
  const headers={'ETag':etag,'Cache-Control':immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'};
  if(compress)headers.Vary='Accept-Encoding';
  const matches=(req.headers['if-none-match']||'').split(',').map(s=>s.trim().replace(/^W\//,''));
  if(matches.includes('*')||matches.includes(etag.replace(/^W\//,'')))return {status:304,body:null,headers};
  let body=data;
  const encodings=new Map((req.headers['accept-encoding']||'').toLowerCase().split(',').map(part=>{
   const [name,...params]=part.trim().split(';'),q=params.find(p=>p.trim().startsWith('q='));
   const value=q?Number(q.trim().slice(2)):1;return [name,Number.isFinite(value)&&value>=0&&value<=1?value:0];
  }));
  if(compress&&data.length>=1024&&(encodings.get('gzip')??encodings.get('*')??0)>0){
   body=variants.get(digest);
   if(body){variants.delete(digest);variants.set(digest,body);}
   else{
    body=await zip(data);
    if(body.length<=maxBytes){
     // A concurrent request may already have added this representation.
     const old=variants.get(digest);if(old){used-=old.length;variants.delete(digest);}
     while(used+body.length>maxBytes){const [key,value]=variants.entries().next().value;used-=value.length;variants.delete(key);}
     variants.set(digest,body);used+=body.length;
    }
   }
   headers['Content-Encoding']='gzip';
  }
  headers['Content-Length']=body.length;
  return {status:200,body:req.method==='HEAD'?null:body,headers};
 };
}
