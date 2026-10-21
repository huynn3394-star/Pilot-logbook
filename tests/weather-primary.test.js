import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as weather from '../lib/weather.js';
const now=()=>new Date('2026-10-21T04:10:00Z');
const metar='METAR VVTS 210400Z VRB03KT 9999 SCT037 34/26 Q1013 NOSIG=';
const taf='TAF AMD VVTS 210200Z 2103/2209 05007KT 9999 SCT017 TEMPO 2106/2109 4000 TSRA SCT015 FEW017CB TEMPO 2109/2112 04015G26KT 2500 +TSRA BKN013 SCT015CB=';
function wire({expired=false,missingTAF=false}={}){
 let logged=false,expiredOnce=expired,posts=0;
 return {get posts(){return posts;},async fetch(url,options={}){
  const u=new URL(url);
  assert.equal(u.origin,'http://118.69.213.84');
  if(options.method==='POST'){
   const form=new URLSearchParams(options.body);assert.equal(form.get('act'),'login');assert.equal(form.get('txtUsername'),'qa-user');assert.equal(form.get('txtPassword'),'qa-password');posts++;logged=true;
   return new Response('<a>Logout</a>',{headers:{'Set-Cookie':'PHPSESSID=synthetic-session; Path=/; HttpOnly'}});
  }
  assert.ok(logged);assert.match(options.headers.Cookie,/PHPSESSID=synthetic-session/);
  if(expiredOnce){expiredOnce=false;return new Response('<a>USER LOGIN</a>');}
  const text=u.searchParams.get('cat')==='1'?'Rx 210401Z '+metar+'\nMETAR VVNB 210400Z 08005KT 9999 SCT031 32/24 Q1017=':missingTAF?'TAF VVTS : NIL=':'Rx 210203Z '+taf.replace(' TEMPO','\n TEMPO');
  return new Response('<a>Logout</a><pre>'+text+'</pre>');
 }};
}
test('primary preserves full amended multiline TAF and reuses one authenticated feed for multiple airports',async()=>{
 assert.equal(typeof weather.MetOfficeProvider,'function');
 const net=wire(),provider=new weather.MetOfficeProvider({username:'qa-user',password:'qa-password',fetchImpl:net.fetch,now});
 const [a,b]=await Promise.all([provider.fetch('VVTS'),provider.fetch('VVNB')]);
 assert.equal(a.metar,metar);assert.equal(a.taf.replace(/\s+/g,' '),taf);assert.match(b.metar,/METAR VVNB/);assert.equal(net.posts,1);
 assert.equal(a.sources.metar,'http://118.69.213.84/index.php?cat=1&sub=6');assert.equal(a.sources.taf,'http://118.69.213.84/index.php?cat=2&sub=0');
 assert.equal(JSON.stringify(a).includes('qa-password'),false);assert.equal(JSON.stringify(a).includes('synthetic-session'),false);
});
test('expired primary session is renewed once and does not produce a login page as a weather report',async()=>{
 assert.equal(typeof weather.MetOfficeProvider,'function');const net=wire({expired:true}),provider=new weather.MetOfficeProvider({username:'qa-user',password:'qa-password',fetchImpl:net.fetch,now});const a=await provider.fetch('VVTS');assert.equal(a.metar,metar);assert.equal(net.posts,2);
});
test('fallback fills missing product without replacing primary METAR or fabricating its provenance',async()=>{
 assert.equal(typeof weather.PriorityWeatherProvider,'function');
 const provider=new weather.PriorityWeatherProvider({primary:{name:'Primary',fetch:async()=>({metar,taf:null,sources:{metar:'http://118.69.213.84/index.php?cat=1&sub=6'}})},fallback:{name:'NOAA Aviation Weather Center',fetch:async()=>({metar:'METAR VVTS 210350Z 00000KT CAVOK 30/24 Q1013=',taf})},now});
 const a=await provider.fetch('VVTS');assert.equal(a.metar,metar);assert.equal(a.taf,taf);assert.equal(a.sources.metar,'http://118.69.213.84/index.php?cat=1&sub=6');assert.equal(a.sources.taf,'https://aviationweather.gov/api/data/taf?ids=VVTS&format=raw');assert.match(a.provider,/Primary/);assert.match(a.provider,/NOAA/);
});
test('old primary METAR and expired TAF yield current fallback even when fetched just now',async()=>{
 assert.equal(typeof weather.PriorityWeatherProvider,'function');const p=new weather.PriorityWeatherProvider({primary:{name:'Primary',fetch:async()=>({metar:'METAR VVTS 210100Z 00000KT CAVOK 30/24 Q1013=',taf:'TAF VVTS 202300Z 2100/2103 00000KT CAVOK='})},fallback:{name:'Fallback',fetch:async()=>({metar,taf})},now});const a=await p.fetch('VVTS');assert.equal(a.metar,metar);assert.equal(a.taf,taf);assert.equal(a.provider,'Fallback');
});
test('provider failure cannot erase a remaining primary product, and secrets never appear in returned errors',async()=>{
 assert.equal(typeof weather.PriorityWeatherProvider,'function');const p=new weather.PriorityWeatherProvider({primary:{name:'Primary',fetch:async()=>({metar,taf:null})},fallback:{name:'Fallback',fetch:async()=>{throw Error('private-upstream-error');}},now});const a=await p.fetch('VVTS');assert.equal(a.metar,metar);assert.equal(a.taf,null);assert.equal(JSON.stringify(a).includes('private-upstream-error'),false);
});
test('a newer SPECI takes precedence over an earlier METAR for the same station',async()=>{
 assert.equal(typeof weather.MetOfficeProvider,'function');const net=wire(),speci='SPECI VVTS 210405Z 10010KT 3000 TSRA BKN010CB 28/25 Q1013=';
 const p=new weather.MetOfficeProvider({username:'qa-user',password:'qa-password',now,fetchImpl:async(url,opts)=>{const response=await net.fetch(url,opts);if(new URL(url).searchParams.get('cat')==='1')return new Response((await response.text()).replace(metar,metar+'\n'+speci));return response;}});
 assert.equal((await p.fetch('VVTS')).metar,speci);
});
test('implicit primary provenance never labels a primary bulletin as NOAA',async()=>{
 const p=new weather.PriorityWeatherProvider({primary:{name:'Primary',fetch:async()=>({metar,taf})},fallback:{name:'Fallback',fetch:async()=>{throw Error('must not fetch');}},now});assert.equal((await p.fetch('VVTS')).sources.metar,'http://118.69.213.84/index.php?cat=1&sub=6');
});
test('equal-time COR/AMD supersedes original independent of feed order',async()=>{
 const corrected=metar.replace('METAR ','METAR COR ').replace('VRB03KT','10010KT'),correctedTAF=taf.replace('TAF AMD','TAF COR').replace('05007KT','06012KT');
 for(const reverse of[false,true]){const p=new weather.MetOfficeProvider({username:'qa-user',password:'qa-password',now,fetchImpl:async(url,opts)=>{if(opts.method==='POST')return new Response('<a>Logout</a>',{headers:{'Set-Cookie':'PHPSESSID=qa'}});const rows=new URL(url).searchParams.get('cat')==='1'?[metar,corrected]:[taf.replace('TAF AMD','TAF'),correctedTAF];return new Response('<a>Logout</a><pre>'+(reverse?rows.reverse():rows).join('\n')+'</pre>');}});const r=await p.fetch('VVTS');assert.equal(r.metar,corrected);assert.equal(r.taf,correctedTAF);}
});
test('server partial refresh retains last TAF with original source and retrieval time',async()=>{
 let partial=false;const service=new weather.WeatherService({name:'Primary',fetch:async()=>({metar,taf:partial?null:taf,sources:{metar:'http://118.69.213.84/index.php?cat=1&sub=6',...(!partial?{taf:'http://118.69.213.84/index.php?cat=2&sub=0'}:{})}})},-1);const old=await service.get('VVTS');partial=true;const r=await service.get('VVTS');assert.equal(r.taf,taf);assert.equal(r.productFetchedAt.taf,old.fetchedAt);assert.equal(r.staleProducts.taf,true);assert.equal(r.sources.taf,old.sources.taf);
});
