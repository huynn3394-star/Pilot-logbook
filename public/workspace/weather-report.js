export const MET_OFFICE='http://118.69.213.84';
export const officeSources={metar:MET_OFFICE+'/index.php?cat=1&sub=6',taf:MET_OFFICE+'/index.php?cat=2&sub=0'};
// HTTP URLs remain valid provenance for existing backups, never for new requests.
export const secureOfficeSources=Object.fromEntries(Object.entries(officeSources).map(([product,url])=>[product,url.replace('http:','https:')]));
export const noaaSource=(station,product)=>`https://aviationweather.gov/api/data/${product}?ids=${station}&format=raw`;
export function weatherSourceURL(value,station,product){
 try{const u=new URL(value);if(u.username||u.password||u.hash)return false;
  if(u.origin===MET_OFFICE||u.origin===new URL(secureOfficeSources.metar).origin)return [officeSources,secureOfficeSources].some(sources=>Object.entries(sources).some(([p,url])=>(!product||p===product)&&u.href===url));
  return u.origin==='https://aviationweather.gov'&&(!product?['/api/data/metar','/api/data/taf'].includes(u.pathname):u.pathname==='/api/data/'+product)&&u.searchParams.get('ids')===station&&u.searchParams.get('format')==='raw'&&[...u.searchParams.keys()].length===2;
 }catch{return false;}
}
function dayNear(day,hour,minute,reference){
 if(day<1||day>31||hour<0||hour>24||minute<0||minute>59||hour===24&&minute!==0)return null;
 const dates=[];for(const offset of[-1,0,1]){const month=new Date(Date.UTC(reference.getUTCFullYear(),reference.getUTCMonth()+offset,1));const d=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),day));if(d.getUTCMonth()!==month.getUTCMonth())continue;d.setUTCHours(hour,minute);dates.push(d);}
 return dates.sort((a,b)=>Math.abs(a-reference)-Math.abs(b-reference))[0]||null;
}
export function reportTiming(raw,product,now=new Date()){
 if(typeof raw!=='string'||raw.length>32768)return null;
 const issue=raw.match(/\b([A-Z]{4})\s+(\d{2})(\d{2})(\d{2})Z\b/);if(!issue||+issue[3]>23)return null;
 const issued=dayNear(+issue[2],+issue[3],+issue[4],now);if(!issued)return null;
 const result={station:issue[1],issuedAt:issued.toISOString(),validFrom:null,validTo:null,cancelled:/\bCNL\b/.test(raw)};
 if(product==='taf'){
  const period=raw.match(/\b(\d{2})(\d{2})\/(\d{2})(\d{2})\b/);
  if(!period)return result.cancelled?result:null;
  const start=dayNear(+period[1],+period[2],0,issued);let end=start&&dayNear(+period[3],+period[4],0,start);
  if(!start||!end)return null;
  if(end<=start){const ref=new Date(start.getTime()+24*3600000);end=dayNear(+period[3],+period[4],0,ref);}
  if(!end||end<=start||end-start>48*3600000)return null;
  result.validFrom=start.toISOString();result.validTo=end.toISOString();
 }return result;
}
export function currentReport(raw,station,product,now=new Date()){
 const t=reportTiming(raw,product,now);if(!t||t.station!==station||/\bNIL\b/.test(raw))return false;
 const age=now-Date.parse(t.issuedAt);return age>=-600000&&age<=(product==='metar'?2:36)*3600000&&(product!=='taf'||t.cancelled||Date.parse(t.validTo)>now.getTime());
}

// Retrieval anchors belong to each product: a missing fresh TAF must not date its saved copy as new.
export function mergeWeatherProducts(previous,incoming){
 const result={...incoming,sources:{...incoming.sources},productFetchedAt:{},staleProducts:{}};
 for(const product of ['metar','taf']){
  const owner=incoming[product]?incoming:previous;
  if(!owner?.[product])continue;
  result[product]=owner[product];result.sources[product]=owner.sources?.[product];
  result.productFetchedAt[product]=owner.productFetchedAt?.[product]||owner.fetchedAt;
  if(owner!==incoming||owner.stale||owner.staleProducts?.[product])result.staleProducts[product]=true;
 }
 return result;
}
export function savedReportTiming(report,product){
 const anchor=report?.productFetchedAt?.[product]||report?.fetchedAt;
 if(!anchor||!Number.isFinite(Date.parse(anchor)))return null;
 return reportTiming(report[product],product,new Date(anchor));
}
