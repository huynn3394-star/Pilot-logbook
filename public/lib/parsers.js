import { normalizeEvents, uid, validDate } from "./domain.js";
import { readA320Scan } from "./a320-scan.js";
export const airportAliases = {
  VVTS: "SGN",
  VTBS: "BKK",
  VVNB: "HAN",
  ZGGG: "CAN",
  VVDL: "DLI",
  VVCI: "HPH",
  RJGG: "NGO",
};
export const icaoFor = (p) =>
  ({
    SGN: "VVTS",
    BKK: "VTBS",
    HAN: "VVNB",
    CAN: "ZGGG",
    DLI: "VVDL",
    HPH: "VVCI",
    NGO: "RJGG",
    DAD: "VVDN",
    NRT: "RJAA",
    ICN: "RKSI",
    SIN: "WSSS",
  })[p] || p;
export const families = {
  E190: { label: "E190 · ACARS OOOI", supported: true },
  A320: { label: "A320 / A321 · MCDU / AOC", supported: true },
  B787: { label: "B787 · nhập tay / chờ parser", supported: false },
  A350: { label: "A350 · nhập tay / chờ parser", supported: false },
  OTHER: { label: "Khác · nhập tay", supported: false },
};
export function parseAircraft(text, family, date) {
  if (!families[family]?.supported)
    throw Error(
      "Parser " +
        family +
        " chưa được xác minh. Vui lòng nhập Actual thủ công.",
    );
  if(family==='E190')return parseE190(text,date);
  const scan = readA320Scan(text);
  if (!Object.keys(scan.clocks).length)
    throw Error("Không nhận ra OUT/OFF/ON/IN. Sửa văn bản OCR hoặc nhập tay.");
  const hasUnknownAirport = [scan.dep,scan.dest].some(code => code && !(code in airportAliases));
  const warnings = [...scan.warnings];
  if(hasUnknownAirport)warnings.push('Mã ICAO chưa có trong danh sách chuyển đổi IATA; hãy xác nhận từ ảnh gốc.');
  return {
    id: uid(),
    date: validDate(date),
    flightNo: scan.flightNo,
    dep: airportAliases[scan.dep] || scan.dep,
    dest: airportAliases[scan.dest] || scan.dest,
    aircraft: "A321",
    actual: normalizeEvents(date, scan.clocks),
    scheduled: {},
    confirmed: false,
    source: "image OCR · A320/A321 Smart Scan V2",
    confidence: Math.max(0, scan.confidence - (hasUnknownAirport?8:0)),
    ...(warnings.length ? {note: warnings.join(' ')} : {}),
    role: "PF",
    nightMinutes: 0,
    picMinutes: 0,
  };
}
export function parseRoster(text, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Chọn tháng roster");
  let date = null;
  const flights = [],
    unrecognized = [];
  for (const line of text
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const dm = line.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
    if (dm) {
      date = `${dm[3] || month.slice(0, 4)}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
      validDate(date);
    }
    const re =
      /\b(VN\s*\d{1,5})\s+([A-Z]{3,4})\s*[-–→/]\s*([A-Z]{3,4})\s+(\d{2}:\d{2})\s*[-–→/]\s*(\d{2}:\d{2})/g;
    let matched = false,
      m;
    while ((m = re.exec(line.toUpperCase()))) {
      if (!date) {
        unrecognized.push(line);
        break;
      }
      matched = true;
      flights.push({
        id: uid(),
        date,
        flightNo: m[1].replace(/\s/g, ""),
        dep: airportAliases[m[2]] || m[2],
        dest: airportAliases[m[3]] || m[3],
        aircraft: "",
        scheduled: normalizeEvents(date, { out: m[4], in: m[5] }),
        actual: {},
        confirmed: false,
        source: "month-plan PDF",
        confidence: 70,
        role: "PM",
        nightMinutes: 0,
        picMinutes: 0,
      });
    }
    if (!matched && !dm) unrecognized.push(line);
  }
  return { flights, unrecognized };
}

function parseE190(text,date){
 const raw=String(text).toUpperCase(),corrected=/\b(?:OUR|0UT|\d{4}2)\b/.test(raw),t=raw.replace(/\b(?:0UT|OUR)\b/g,'OUT').replace(/\b(\d{4})2\b/g,'$1Z'),lines=t.split(/\n/).map(s=>s.trim()).filter(Boolean),clocks={};
 const put=(label,time)=>{const k=label.toLowerCase(),value=time.replace(/[:. ]/g,'').replace(/Z$/,'');if(clocks[k]&&clocks[k]!==value.slice(0,2)+':'+value.slice(2))throw Error('Giờ '+label+' mâu thuẫn; sửa văn bản OCR trước khi tiếp tục.');clocks[k]=value.slice(0,2)+':'+value.slice(2);};
 for(let i=0;i<lines.length;i++){
  const line=lines[i],labels=[...line.matchAll(/\b(OUT|OFF|ON|IN)\b/g)];if(!labels.length)continue;
  const inline=[...line.matchAll(/\b(OUT|OFF|ON|IN)\b\s*[:=]?\s*(\d{2}[:. ]?\d{2}Z?)\b/g)];
  if(inline.length===labels.length){for(const m of inline)put(m[1],m[2]);continue;}
  const next=lines[i+1]||'',times=[...next.matchAll(/\b(\d{2}[:.]?\d{2})Z?\b/g)];
  if(inline.length||times.length!==labels.length||/\b(?:UTC|DATE|BLOCK|FLIGHT|OUT|OFF|ON|IN)\b/.test(next))throw Error('Hàng OUT/OFF/ON/IN không rõ; sửa OCR hoặc nhập tay.');
  for(let n=0;n<labels.length;n++)put(labels[n][1],times[n][1]);i++;
 }
 if(!Object.keys(clocks).length)throw Error('Không nhận ra OUT/OFF/ON/IN; sửa OCR hoặc nhập tay.');
 const flight=t.match(/FLIGHT\s+N[O0]\b[ \t]*(?:DEP\s*[/ -]\s*DEST[ \t]*)?\s*([A-Z0-9]{2,3}\d{1,5}[A-Z]?)\b/)?.[1]||t.match(/\bVN\s*\d{1,5}\b/)?.[0]?.replace(/\s/g,'')||'',route=t.match(/\b([A-Z]{4})\s*[/→-]\s*([A-Z]{4})\b/);
 return {id:uid(),date:validDate(date),flightNo:flight,dep:airportAliases[route?.[1]]||route?.[1]||'',dest:airportAliases[route?.[2]]||route?.[2]||'',aircraft:'E190',actual:normalizeEvents(date,clocks),scheduled:{},confirmed:false,source:'image OCR · E190 ACARS OOOI',confidence:Math.round(Object.keys(clocks).length/4*(corrected?60:75)),...(corrected?{note:'OCR E190 có sửa nhận dạng nhãn OUT và hậu tố Z/2. Kiểm tra ảnh gốc, ngày OUT, số chuyến, sân bay và tất cả mốc giờ trước khi xác nhận.'}:{}),role:'PF',nightMinutes:0,picMinutes:0};
}
