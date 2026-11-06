import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MetOfficeProvider,PriorityWeatherProvider} from '../lib/weather.js';

test('explicit HTTP opt-in logs in, reads both products and preserves actual provenance',async()=>{
 const calls=[],metar='METAR VVPC 060930Z 36005KT 9999 SCT020 30/25 Q1012=',taf='TAF VVPC 060500Z 0606/0706 36005KT 9999 SCT020=';
 const provider=new MetOfficeProvider({username:'synthetic-user',password:'synthetic-secret',allowHttp:true,now:()=>new Date('2026-11-06T10:00:00Z'),fetchImpl:async(url,options)=>{
  const target=new URL(url);assert.equal(target.origin,'http://118.69.213.84');calls.push(url);
  if(options.method==='POST'){
   assert.equal(new URLSearchParams(options.body).get('txtPassword'),'synthetic-secret');
   return new Response('Logout',{headers:{'Set-Cookie':'PHPSESSID=synthetic-cookie'}});
  }
  assert.match(options.headers.Cookie,/synthetic-cookie/);
  return new Response('Logout<pre>'+(target.searchParams.get('cat')==='1'?metar:taf)+'</pre>');
 }});
 const result=await provider.fetch('VVPC');
 assert.equal(calls.length,3);assert.equal(result.metar,metar);assert.equal(result.taf,taf);
 assert.equal(result.sources.metar,'http://118.69.213.84/index.php?cat=1&sub=6');
 assert.equal(result.sources.taf,'http://118.69.213.84/index.php?cat=2&sub=0');
 assert.doesNotMatch(JSON.stringify(result),/synthetic-(?:secret|cookie)/);
});

test('HTTP opt-in still prevents credentials following another origin or path',async()=>{
 for(const location of ['http://attacker.example/index.php','https://118.69.213.84/index.php','http://118.69.213.84/other.php']){
  let calls=0;
  const provider=new MetOfficeProvider({username:'synthetic-user',password:'synthetic-secret',allowHttp:true,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{Location:location}});}});
  await assert.rejects(()=>provider.login(),/redirect rejected/);assert.equal(calls,1);
 }
});

test('HTTP mode requires exact server-side opt-in, and removing the flag restores HTTPS',()=>{
 const keys=['MET_OFFICE_USERNAME','MET_OFFICE_PASSWORD','MET_OFFICE_ALLOW_HTTP'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.MET_OFFICE_USERNAME='synthetic-user';process.env.MET_OFFICE_PASSWORD='synthetic-secret';
  for(const value of [undefined,'false','1','TRUE','true']){
   if(value===undefined)delete process.env.MET_OFFICE_ALLOW_HTTP;else process.env.MET_OFFICE_ALLOW_HTTP=value;
   assert.equal(new PriorityWeatherProvider().primary.origin,(value==='true'?'http':'https')+'://118.69.213.84');
  }
  assert.equal(new MetOfficeProvider({allowHttp:'true'}).origin,'https://118.69.213.84');
 }finally{for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
