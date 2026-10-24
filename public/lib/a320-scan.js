// Pure A320/A321 AOC FLT LOG reader. No cloud OCR, no automatic confirmation.
// Reported FLIGHT/BLOCK durations are cross-checks, never replacements for OOOI.
const headings = new Set([
  'AOC', 'FLT', 'DATE', 'DEPT', 'DEST', 'TIME', 'DATA', 'FROM', 'FLTG',
  'FOBK', 'FOBS', 'CALL', 'SIGN', 'TYPE', 'BLOCK', 'PRINT', 'RETURN',
  'ACFT', 'CREW', 'PAGE', 'FUEL', 'TOTAL', 'ROUT', 'INFO', 'MCDU', 'MENU', 'PROG', 'INIT', 'PERF', 'ACAR', 'APPR',
]);
const expectedEvents = ['out', 'off', 'on', 'in'];
const minutesOf = value => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};
function elapsed(first, second) {
  if (!first || !second) return null;
  return (minutesOf(second) - minutesOf(first) + 1440) % 1440;
}
function parseClock(original) {
  const cleaned = String(original).toUpperCase().replace(/[OQD@]/g, '0').replace(/[IL|]/g, '1').replace(/[.:\s]/g, '');
  if (!/^\d{4}$/.test(cleaned)) return null;
  const h = Number(cleaned.slice(0, 2)), m = Number(cleaned.slice(2));
  if (h > 23 || m > 59) return null;
  return {value: cleaned.slice(0, 2) + ':' + cleaned.slice(2), repaired: cleaned !== original.replace(/[.:\s]/g, '').toUpperCase()};
}
function isAirportLabel(code) {
  return headings.has(code) || !/^[A-Z]{4}$/.test(code);
}
function readRoute(text, flightPosition, warnings) {
  const candidates = [];
  // Slash or hyphen is unambiguous on AOC flight record; spaces are OCR fallbacks.
  const regex = /\b([A-Z]{4})[ \t]*(\/|→|-|[ \t]+)[ \t]*([A-Z]{4})\b/g;
  for (const match of text.matchAll(regex)) {
    const dep = match[1], dest = match[3];
    if (isAirportLabel(dep) || isAirportLabel(dest) || dep === dest) continue;
    // Space-only ICAO pairs are accepted only beside the flight record. Do not
    // guess a route from random four-letter cockpit/menu labels elsewhere.
    const explicitSeparator = !!match[2].trim();
    if (!explicitSeparator && !(flightPosition>=0 && match.index>=flightPosition && match.index-flightPosition<70)) continue;
    const fragment = text.slice(Math.max(0, match.index - 65), match.index);
    const sameLine = fragment.split('\n').at(-1);
    let score = match[2].trim() ? 45 : 10;
    if (flightPosition >= 0) {
      const distance = Math.abs(match.index - flightPosition);
      if (distance < 35) score += 60;
      else if (distance < 90) score += 35;
      else if (distance < 160) score += 10;
    }
    if (/\bVN[0-9O@QDI L]{1,5}[\/ -]/.test(sameLine)) score += 30;
    if (/DEPT\s*\/\s*DEST/.test(fragment)) score += 6;
    candidates.push({dep, dest, score, index: match.index});
  }
  candidates.sort((a,b)=>b.score-a.score || a.index-b.index);
  const best = candidates[0];
  if (best && candidates.some(candidate => (candidate.dep!==best.dep || candidate.dest!==best.dest) && candidate.score>=best.score-15))
    warnings.push('Có nhiều hành trình ICAO khả dĩ trong ảnh; kiểm tra DEP/DEST trên MCDU.');
  if (!best) warnings.push('Chưa nhận diện được đủ DEP/DEST; cần nhập theo ảnh gốc.');
  return best ? {dep:best.dep,dest:best.dest} : {dep:'',dest:''};
}
function readFlight(text, warnings) {
  // Limited to Vietnam Airlines flight numbers for this specific AOC page.
  const found = [...text.matchAll(/\bVN[ \t]*([0-9OQD@IL]{1,5})(?=[\s/.,;:\-]|$)/g)];
  if (!found.length) {warnings.push('Không đọc rõ Flight ID, cần kiểm tra số chuyến.');return {flightNo:'',position:-1,repaired:false};}
  const candidate = found[0], raw = candidate[1];
  const corrected = raw.replace(/[OQD@]/g, '0').replace(/[IL]/g, '1');
  if (raw!==corrected) warnings.push(`Flight ID có ký tự OCR dễ nhầm (${raw}); đối chiếu số chuyến với ảnh gốc.`);
  if (found.some(m=>m[1].replace(/[OQD@]/g,'0').replace(/[IL]/g,'1')!==corrected))
    warnings.push('Flight ID xuất hiện không nhất quán trên ảnh.');
  return {flightNo:'VN'+corrected,position:candidate.index,repaired:raw!==corrected};
}
function readEvents(text, warnings) {
  const clocks = {}, repaired = new Set(), duplicates = new Set();
  // Accept a common negative sign from OCR before a valid time, not arbitrary integers.
  const clock = '([0-9OQD@IL|]{2}[.:]?[0-9OQD@IL|]{2})';
  for (const key of [...expectedEvents,'flight','block']) {
    const pattern = new RegExp('\\b'+key+'\\b[ \\t:=\\-]*'+clock+'\\b', 'gi');
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const result = parseClock(match[1]);
      if (!result) {warnings.push(`${key.toUpperCase()}: giờ đọc được không hợp lệ (${match[1]}), cần sửa OCR.`);continue;}
      if (clocks[key] && clocks[key] !== result.value) duplicates.add(key.toUpperCase());
      else if (!clocks[key]) clocks[key] = result.value;
      if (result.repaired) repaired.add(key.toUpperCase());
    }
  }
  if (duplicates.size) warnings.push(`Giờ xuất hiện mâu thuẫn: ${[...duplicates].join(', ')}; cần kiểm tra thủ công.`);
  if (repaired.size) warnings.push(`OCR đã sửa ký tự dễ nhầm trong giờ ${[...repaired].join(', ')}; hãy đối chiếu ảnh.`);
  for(const key of expectedEvents) if(!clocks[key]) warnings.push(`Chưa có giờ ${key.toUpperCase()} hợp lệ.`);
  return {clocks, repaired:repaired.size, conflicts:duplicates.size};
}
export function readA320Scan(raw) {
  const warnings = [];
  const text = String(raw||'').toUpperCase()
    .replace(/\r/g, '\n').replace(/[‐‑‒–—−]/g, '-').replace(/\\/g,'/')
    .replace(/\b0UT\b/g,'OUT').replace(/\b0FF\b/g,'OFF')
    .replace(/\b0N\b/g,'ON');
  const flight=readFlight(text,warnings);
  const route=readRoute(text,flight.position,warnings);
  const times=readEvents(text,warnings);
  const reported={flight:times.clocks.flight||null,block:times.clocks.block||null};
  const clocks=Object.fromEntries(expectedEvents.filter(key=>times.clocks[key]).map(key=>[key,times.clocks[key]]));
  const computed={flight:elapsed(clocks.off,clocks.on),block:elapsed(clocks.out,clocks.in)};
  const reportMinutes={flight:minutesOf(reported.flight),block:minutesOf(reported.block)};
  let verified=0, mismatch=0;
  for (const type of ['flight','block']) {
    if(computed[type]!==null && reportMinutes[type]!==null){
      if(computed[type]===reportMinutes[type])verified++;
      else {mismatch++;warnings.push(`${type.toUpperCase()} trên màn hình là ${reported[type]} nhưng tính từ OUT/OFF/ON/IN khác (${Math.floor(computed[type]/60).toString().padStart(2,'0')}:${String(computed[type]%60).padStart(2,'0')}). Không tự sửa số liệu.`);}
    }
  }
  // Durations under 24h are necessary; a missing event is left blank for manual review.
  if(computed.block!==null && computed.block>16*60){warnings.push('BLOCK vượt 16 giờ, cần xác minh ngày UTC và giờ OCR.');mismatch++;}
  let confidence = (flight.flightNo?18:0)+(route.dep&&route.dest?23:0)+Object.keys(clocks).length*10 + verified*8 + (verified===2?3:0);
  confidence -= (flight.repaired?10:0)+times.repaired*8+times.conflicts*20+mismatch*25;
  if(warnings.some(x=>x.includes('nhiều hành trình')))confidence-=20;
  confidence=Math.min(100,Math.max(0,Math.round(confidence)));
  return {flightNo:flight.flightNo,...route,clocks,reported,computed,verified,mismatch,warnings,confidence};
}
