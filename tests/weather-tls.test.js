import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MetOfficeProvider,PriorityWeatherProvider} from '../lib/weather.js';
import {weatherSourceURL} from '../public/workspace/weather-report.js';

test('primary credentials and cookies never follow HTTP downgrade or another origin',async()=>{
 for(const location of ['http://118.69.213.84/index.php','https://attacker.example/index.php']){
  const calls=[];
  const provider=new MetOfficeProvider({username:'test-user',password:'test-secret',fetchImpl:async(url,options)=>{
   calls.push({url,options});
   return new Response(null,{status:302,headers:{Location:location,'Set-Cookie':'PHPSESSID=test-session'}});
  }});
  await assert.rejects(()=>provider.login(),/redirect rejected/);
  assert.equal(calls.length,1,'No second request can transmit the cookie or password');
  assert.equal(calls[0].url,'https://118.69.213.84/index.php');
  assert.equal(calls[0].options.redirect,'manual');
 }
});

test('unsafe primary request URLs are rejected before any network call',async()=>{
 let calls=0;
 const provider=new MetOfficeProvider({fetchImpl:async()=>{calls++;throw Error('must not fetch');}});
 for(const url of ['http://118.69.213.84/index.php','https://attacker.example/index.php','https://user:secret@118.69.213.84/index.php']){
  await assert.rejects(()=>provider.request(url),/request rejected/);
 }
 assert.equal(calls,0);
});

test('TLS failure uses NOAA without retrying HTTP or exposing credentials',async()=>{
 const calls=[],metar='METAR VVTS 210400Z 00000KT CAVOK 30/24 Q1013=';
 const primary=new MetOfficeProvider({username:'test-user',password:'test-secret',fetchImpl:async(url)=>{
  calls.push(url);throw Error('TLS certificate rejected test-secret');
 }});
 const service=new PriorityWeatherProvider({primary,now:()=>new Date('2026-10-21T04:10:00Z'),fallback:{
  name:'NOAA Aviation Weather Center',fetch:async()=>({metar,taf:null})
 }});
 const result=await service.fetch('VVTS');
 assert.equal(result.metar,metar);
 assert.equal(result.sources.metar,'https://aviationweather.gov/api/data/metar?ids=VVTS&format=raw');
 assert.deepEqual(calls,['https://118.69.213.84/index.php']);
 assert.equal(JSON.stringify(result).includes('test-secret'),false);
});

test('saved HTTP provenance stays readable while new HTTPS provenance is accepted',()=>{
 for(const protocol of ['http','https']){
  assert.equal(weatherSourceURL(protocol+'://118.69.213.84/index.php?cat=1&sub=6','VVTS','metar'),true);
  assert.equal(weatherSourceURL(protocol+'://118.69.213.84/index.php?cat=1&sub=6','VVTS','taf'),false);
 }
 assert.equal(weatherSourceURL('https://attacker.example/index.php?cat=1&sub=6','VVTS','metar'),false);
});
