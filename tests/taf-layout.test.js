import {test} from 'node:test';
import assert from 'node:assert/strict';

const load=()=>import('../public/workspace/weather-attention.js');
const unmark=html=>html.replace(/<mark\\b[^>]*>|<\\/mark>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

test('TAF inline change groups render on separate lines without changing report tokens',async()=>{
 const {formatTAFReport}=await load();
 assert.equal(typeof formatTAFReport,'function');
 const raw='TAF VVTS 250230Z 2503/2603 23008KT 9999 SCT020 TEMPO 2503/2505 3000 -TSRA FEW015CB PROB30 TEMPO 2506/2510 2000 +TSRA BKN020CB FM251200 24012KT 5000 RA BKN010 BECMG 2514/2516 9999 NSW SCT025=';
 assert.equal(formatTAFReport(raw),'TAF VVTS 250230Z 2503/2603 23008KT 9999 SCT020\\nTEMPO 2503/2505 3000 -TSRA FEW015CB\\nPROB30 TEMPO 2506/2510 2000 +TSRA BKN020CB\\nFM251200 24012KT 5000 RA BKN010\\nBECMG 2514/2516 9999 NSW SCT025=');
 assert.equal(formatTAFReport(raw).replace(/\\s+/g,' '),raw);
});

test('TAF source line breaks remain single lines and CRLF is normalized',async()=>{
 const {formatTAFReport}=await load();
 const raw='TAF VVTS 250230Z 2503/2603 23008KT 9999 SCT020\\r\\n  TEMPO 2503/2505 3000 TSRA\\r\\n FM251200 24012KT 5000 RA=';
 const result=formatTAFReport(raw);
 assert.equal(result,'TAF VVTS 250230Z 2503/2603 23008KT 9999 SCT020\\n  TEMPO 2503/2505 3000 TSRA\\n FM251200 24012KT 5000 RA=');
 assert.equal((result.match(/\\n/g)||[]).length,2);
});

test('TAF formatting preserves TSRA and CB highlights and the underlying source string',async()=>{
 const {formatTAFReport,highlightWeatherReport}=await load();
 const raw='TAF VVTS 250230Z 2503/2603 23008KT 9999 SCT020 TEMPO 2503/2505 3000 -TSRA FEW015CB PROB30 TEMPO 2506/2510 +TSRA BKN020CB=';
 const before=raw,result=formatTAFReport(raw),html=highlightWeatherReport(result);
 assert.deepEqual([...html.matchAll(/<mark\\b[^>]*>(.*?)<\\/mark>/g)].map(m=>m[1]),['-TSRA','CB','+TSRA','CB']);
 assert.equal(unmark(html),result);
 assert.equal(raw,before);
});

test('empty TAF values remain empty and no false line breaks inside ordinary tokens',async()=>{
 const {formatTAFReport}=await load();
 assert.equal(formatTAFReport(null),'');
 assert.equal(formatTAFReport(''),'');
 assert.equal(formatTAFReport('TAF VVCB 250100Z 2502/2602 SCT020'),'TAF VVCB 250100Z 2502/2602 SCT020');
});
