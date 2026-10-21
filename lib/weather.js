import {MetOfficeProvider} from './met-office.js';
import {currentReport,reportTiming,mergeWeatherProducts,noaaSource,officeSources} from '../public/workspace/weather-report.js';
export {MetOfficeProvider};
export class AviationWeatherProvider {
  name = "NOAA Aviation Weather Center";
  async fetch(station) {
    const get = async (product) => {
      const r = await fetch(
        `https://aviationweather.gov/api/data/${product}?ids=${station}&format=raw`,
        {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "AviLog-Preview/0.1" },
        },
      );
      if (!r.ok) throw Error("Weather provider HTTP " + r.status);
      return (await r.text()).trim() || null;
    };
    const results=await Promise.allSettled([get('metar'),get('taf')]);
    if(results.every(r=>r.status==='rejected'))throw Error('Weather provider unavailable');
    return {metar:results[0].status==='fulfilled'?results[0].value:null,taf:results[1].status==='fulfilled'?results[1].value:null,sources:{metar:noaaSource(station,'metar'),taf:noaaSource(station,'taf')}};
  }
}
export class PriorityWeatherProvider {
 name='Tan Son Nhat MET Office / NOAA Aviation Weather Center';
 constructor({primary=process.env.MET_OFFICE_USERNAME&&process.env.MET_OFFICE_PASSWORD?new MetOfficeProvider({username:process.env.MET_OFFICE_USERNAME,password:process.env.MET_OFFICE_PASSWORD}):null,fallback=new AviationWeatherProvider(),now=()=>new Date()}={}){this.primary=primary;this.fallback=fallback;this.now=now;}
 async fetch(station){
  const result={metar:null,taf:null,sources:{},provenance:{}},names=new Set(),now=this.now();
  const accept=(data,provider,product)=>{const raw=data?.[product];if(!currentReport(raw,station,product,now))return;result[product]=raw;result.sources[product]=data.sources?.[product]||(provider===this.primary?officeSources[product]:noaaSource(station,product));result.provenance[product]={...reportTiming(raw,product,now),provider:provider.name,source:result.sources[product]};names.add(provider.name);};
  if(this.primary){try{const data=await this.primary.fetch(station);for(const product of['metar','taf'])accept(data,this.primary,product);}catch{}}
  if(!result.metar||!result.taf){try{const data=await this.fallback.fetch(station);for(const product of['metar','taf'])if(!result[product])accept(data,this.fallback,product);}catch{}}
  result.provider=[...names].join(' / ')||this.name;return result;
 }
}
export class WeatherService {
  constructor(provider = new PriorityWeatherProvider(), ttl = 300000) {
    this.provider = provider;
    this.ttl = ttl;
    this.cache = new Map();
    this.pending = new Map();
  }
  async get(station) {
    if (!/^[A-Z]{4}$/.test(station))
      throw Object.assign(Error("Cần mã ICAO 4 chữ cái"), { status: 400 });
    const old = this.cache.get(station);
    if (old && Date.now() - Date.parse(old.fetchedAt) < this.ttl)
      return { ...old, cached: true };
    if (this.pending.has(station)) return this.pending.get(station);
    const request = (async () => {
      try {
        const data = await this.provider.fetch(station);
        if(old&&!data.metar&&!data.taf)throw Error('No current weather available');
        const result = mergeWeatherProducts(old,{
          ...data,
          station,
          provider: data.provider || this.provider.name,
          fetchedAt: new Date().toISOString(),
          cached: false,
          awarenessOnly: true,
        });
        if (this.cache.size > 500) this.cache.clear();
        this.cache.set(station, result);
        return result;
      } catch (e) {
        if (old)
          return {
            ...old,
            cached: true,
            stale: true,
            error: "Không cập nhật được. Bản cache đã cũ.",
          };
        throw Object.assign(
          Error("Không kết nối được nguồn thời tiết. Thử lại sau."),
          { status: 502 },
        );
      } finally {
        this.pending.delete(station);
      }
    })();
    this.pending.set(station, request);
    return request;
  }
}
