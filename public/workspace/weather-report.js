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
function dayNear(day,hour,minute,reference,{issue=false}={}){
 if(day<1||day>31||hour<0||hour>24||minute<0||minute>59||hour===24&&minute!==0)return null;
 // Keep near-future times visible for validation; never infer an issue weeks ahead.
 const dates=[];for(const offset of[-1,0,1]){const month=new Date(Date.UTC(reference.getUTCFullYear(),reference.getUTCMonth()+offset,1));const d=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),day));if(d.getUTCMonth()!==month.getUTCMonth())continue;d.setUTCHours(hour,minute);if(!issue||d.getTime()-reference.getTime()<86400000)dates.push(d);}
 return dates.sort((a,b)=>Math.abs(a-reference)-Math.abs(b-reference))[0]||null;
}
export function reportTiming(raw,product,now=new Date()){
 if(typeof raw!=='string'||raw.length>32768||!Number.isFinite(now.getTime()))return null;
 const issue=raw.match(/\b([A-Z]{4})\s+(\d{2})(\d{2})(\d{2})Z\b/);if(!issue||+issue[3]>23)return null;
 const issued=dayNear(+issue[2],+issue[3],+issue[4],now,{issue:true});if(!issued)return null;
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

// Corrections at the same issue time supersede the original, never the reverse.
export const bulletinRevision=raw=>/\bCOR\b/.test(raw||'')?2:/\bAMD\b/.test(raw||'')?1:0;
const sameText=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.replace(/\s+/g,' ').trim()===b.replace(/\s+/g,' ').trim();

// Freeze each product's issue date independently of subsequent retrievals and other products.
export function mergeWeatherProducts(previous,incoming,{cacheSnapshot=false}={}){
 const result={...incoming,metar:null,taf:null,sources:{},productFetchedAt:{},productIssuedAt:{},staleProducts:{},provenance:{}};
 if(Date.parse(previous?.fetchedAt)>Date.parse(result.fetchedAt))result.fetchedAt=previous.fetchedAt;
 for(const product of ['metar','taf']){
  const incomingTiming=incoming?.[product]&&savedReportTiming(incoming,product);
  const previousTiming=previous?.[product]&&savedReportTiming(previous,product);
  // Raw bulletins carry no month/year. Identical text is not evidence of a new issue.
  const timing=sameText(previous?.[product],incoming?.[product])&&previousTiming?previousTiming:incomingTiming;
  const incomingIssue=timing?Date.parse(timing.issuedAt):NaN;
  const previousIssue=previousTiming?Date.parse(previousTiming.issuedAt):NaN;
  const previousRevision=bulletinRevision(previous?.[product]),incomingRevision=bulletinRevision(incoming?.[product]);
  const previousReceipt=Date.parse(previous?.productFetchedAt?.[product]||previous?.fetchedAt);
  const incomingReceipt=Date.parse(incoming?.productFetchedAt?.[product]||incoming?.fetchedAt);
  const olderRevision=incomingRevision<previousRevision;
  const olderReceipt=cacheSnapshot&&incomingRevision===previousRevision&&incomingReceipt<previousReceipt;
  const older=Number.isFinite(previousIssue)&&(
   !Number.isFinite(incomingIssue)||incomingIssue<previousIssue||
   incomingIssue===previousIssue&&(olderRevision||olderReceipt)
  );
  const owner=incoming?.[product]&&!older?incoming:previous,chosen=owner===incoming?timing:previousTiming;
  if(!owner?.[product])continue;
  result[product]=owner[product];result.sources[product]=owner.sources?.[product];
  result.productFetchedAt[product]=owner.productFetchedAt?.[product]||owner.fetchedAt;
  if(chosen){
   result.productIssuedAt[product]=chosen.issuedAt;
   result.provenance[product]={...chosen,provider:owner.provenance?.[product]?.provider||owner.provider,source:result.sources[product]};
  }
  const retainedAfterFetch=!cacheSnapshot&&owner!==incoming;
  if(retainedAfterFetch||owner.stale||owner.staleProducts?.[product])result.staleProducts[product]=true;
 }
 return result;
}
export function savedReportTiming(report,product){
 const anchor=report?.productFetchedAt?.[product]||report?.fetchedAt;
 if(!anchor||!Number.isFinite(Date.parse(anchor)))return null;
 const issued=report?.productIssuedAt?.[product];
 if(issued!==undefined){
  if(typeof issued!=='string'||!Number.isFinite(Date.parse(issued))||Date.parse(issued)>Date.parse(anchor)+600000)return null;
  const timing=reportTiming(report[product],product,new Date(issued));
  return timing&&Date.parse(timing.issuedAt)===Date.parse(issued)?timing:null;
 }
 // Legacy entries migrate using their own original receipt, never today's date.
 return reportTiming(report[product],product,new Date(anchor));
}

export const WEATHER_RETRY_MS=60000;
// Publication deadlines belong to the bulletin, not to when a page fetched it.
// VV observations use :00/:30 UTC; elsewhere preserve a routine METAR's minute
// offset (e.g. :20/:50). A SPECI must not postpone the next routine observation.
export function nextWeatherIssueAt(report,product){
 const timing=report?.[product]&&savedReportTiming(report,product);
 if(!timing)return null;
 const issued=Date.parse(timing.issuedAt),halfHour=1800000;
 if(product==='metar'){
  const routine=!/^\s*SPECI\b/.test(report[product]);
  return /^VV/.test(report.station)||!routine?Math.floor(issued/halfHour)*halfHour+halfHour:issued+halfHour;
 }
 if(timing.cancelled)return issued;
 const from=Date.parse(timing.validFrom),to=Date.parse(timing.validTo);
 const interval=(to-from<12*3600000?3:6)*3600000;
 // Routine TAFs arrive ahead of validity. Keep that cycle when an amendment
 // retains the original validity start, and never extend beyond validTo.
 return Math.min(issued+interval,from+interval-3600000,to);
}
export function weatherProductFreshness(report,product,{now=Date.now()}={}){
 const timing=report?.[product]&&savedReportTiming(report,product),issued=Date.parse(timing?.issuedAt),fetched=Date.parse(report?.productFetchedAt?.[product]||report?.fetchedAt);
 const invalid=!timing||!Number.isFinite(fetched)||issued>now+600000||fetched>now+600000;
 const old=Number.isFinite(issued)&&now-issued>(product==='metar'?2:36)*3600000;
 const expired=Boolean(timing?.validTo)&&Date.parse(timing.validTo)<=now;
 const nextIssueAt=nextWeatherIssueAt(report,product),due=nextIssueAt!==null&&now>=nextIssueAt;
 // Being offline, reopening the page, or re-fetching identical text does not
 // change the publication deadline. Only a newer bulletin advances it.
 return {timing,invalid,old,expired,nextIssueAt,due,saved:Boolean(report?.[product])&&(invalid||old||expired||due)};
}
export function nextWeatherRefreshAt(report,now=Date.now()){
 const products=['metar','taf'].filter(product=>report?.[product]);
 if(!products.length)return now;
 return Math.min(...products.map(product=>{
  const state=weatherProductFreshness(report,product,{now});
  return state.saved?now:state.nextIssueAt;
 }));
}
export function weatherRefreshAt(report,attemptedAt,now=Date.now(),retryMs=WEATHER_RETRY_MS){
 const due=nextWeatherRefreshAt(report,now),attempt=Date.parse(attemptedAt);
 const deadlines=['metar','taf'].filter(p=>report?.[p]).map(p=>nextWeatherIssueAt(report,p)).filter(at=>at!==null&&at<=now);
 const boundary=Math.max(0,...deadlines);
 // An attempt just before a new cycle must not delay that cycle's first check.
 return due<=now&&Number.isFinite(attempt)&&attempt<=now&&attempt>=boundary?Math.max(due,attempt+retryMs):due;
}
