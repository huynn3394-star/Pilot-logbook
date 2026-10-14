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
    const [metar, taf] = await Promise.all([get("metar"), get("taf")]);
    return { metar, taf };
  }
}
export class WeatherService {
  constructor(provider = new AviationWeatherProvider(), ttl = 300000) {
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
        const result = {
          ...data,
          station,
          provider: this.provider.name,
          fetchedAt: new Date().toISOString(),
          cached: false,
          awarenessOnly: true,
        };
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
