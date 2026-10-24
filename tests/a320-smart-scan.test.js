import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readA320Scan} from '../public/lib/a320-scan.js';
import {parseAircraft} from '../public/lib/parsers.js';
import {minutes} from '../public/lib/domain.js';
const photoText=`AOC FLT LOG 2/5\nFLT ID/DATE DEPT/DEST\nVN@506/-- VVNB/ZGGG\nTIME FOB(KLB)\nOUT 06:00 016.9\nOFF -06:13 016.7\nON 07:35 007.9\nIN 07:58 007.4\nFLIGHT 01:22\nBLOCK 01:58\nPRINT OUT\nRETURN 08:48`;
const date='2026-10-22';
test('A320 MCDU image fixture: DEP/DEST not confused with FLT ID/DATE and headings',()=>{
 const scan=readA320Scan(photoText);
 assert.equal(scan.flightNo,'VN0506');
 assert.deepEqual([scan.dep,scan.dest],['VVNB','ZGGG']);
 assert.deepEqual(scan.clocks,{out:'06:00',off:'06:13',on:'07:35',in:'07:58'});
 assert.deepEqual(scan.reported,{flight:'01:22',block:'01:58'});
 assert.equal(scan.verified,2);
 assert.equal(scan.mismatch,0);
 assert.ok(scan.warnings.some(x=>x.includes('Flight ID')));
 const flight=parseAircraft(photoText,'A320',date);
 assert.equal(flight.confirmed,false);
 assert.deepEqual([flight.dep,flight.dest],['HAN','CAN']);
 assert.equal(flight.flightNo,'VN0506');
 assert.equal(minutes(flight.actual.out,flight.actual.in),118);
 assert.equal(minutes(flight.actual.off,flight.actual.on),82);
});
test('A320 avoids header-only and missing route; never invents airport codes',()=>{
 const text='AOC FLT LOG\nFLT ID/DATE DEPT/DEST\nVN0506/--\nOUT 06:00 OFF 06:13 ON 07:35 IN 07:58';
 const scan=readA320Scan(text);
 assert.equal(scan.dep,'');assert.equal(scan.dest,'');
 assert.ok(scan.confidence<readA320Scan(photoText).confidence);
 assert.match(scan.warnings.join(' '),/DEP\/DEST/);
});
test('A320 detects actual duration discrepancies without silently changing times',()=>{
 const scan=readA320Scan(photoText.replace('FLIGHT 01:22','FLIGHT 01:33'));
 assert.equal(scan.mismatch,1);
 assert.equal(scan.clocks.off,'06:13');assert.equal(scan.clocks.on,'07:35');
 assert.match(scan.warnings.join(' '),/khác/);
 assert.ok(scan.confidence<readA320Scan(photoText).confidence);
});
test('A320 rejects invalid OUT and prompts manual review rather than guessing 26:00',()=>{
 const scan=readA320Scan(photoText.replace('OUT 06:00','OUT 26:00'));
 assert.equal(scan.clocks.out,undefined);
 assert.match(scan.warnings.join(' '),/OUT: giờ đọc được không hợp lệ/);
});
test('A320 time OCR O/0 and I/1 corrections are flagged and shown as draft',()=>{
 const scan=readA320Scan(photoText.replace('OFF -06:13','OFF O6:I3'));
 assert.equal(scan.clocks.off,'06:13');
 assert.match(scan.warnings.join(' '),/OCR đã sửa/);
 assert.ok(scan.confidence<readA320Scan(photoText).confidence);
});
test('A320 contradictory duplicate timestamps need manual review',()=>{
 const scan=readA320Scan(photoText+'\nOUT 06:41');
 assert.equal(scan.clocks.out,'06:00');
 assert.match(scan.warnings.join(' '),/mâu thuẫn/);
});
test('A320 preserves midnight rollover and matches both displayed durations',()=>{
 const text='VN7388 VVTS/VVDL OUT 23:55 OFF 00:05 ON 00:52 IN 01:07 FLIGHT 00:47 BLOCK 01:12';
 const f=parseAircraft(text,'A320',date);
 assert.equal(f.actual.off,'2026-10-23T00:05:00.000Z');
 assert.equal(minutes(f.actual.out,f.actual.in),72);
 assert.equal(f.confirmed,false);
});
test('A320 existing sample remains valid and yields no warnings',()=>{
 const scan=readA320Scan('VN0605 VVTS VTBS OUT 04:29 OFF 04:39 ON 05:50 IN 06:00 FLIGHT 01:11 BLOCK 01:31');
 assert.deepEqual([scan.dep,scan.dest],['VVTS','VTBS']);
 assert.equal(scan.warnings.length,0);
 assert.equal(scan.verified,2);
});

test('A320 rejects unrelated cockpit menu words as airport route',()=>{
 const scan=readA320Scan('AOC FLT LOG\nFLT ID/DATE DEPT/DEST\nOUT 06:00 OFF 06:13 ON 07:35 IN 07:58\nMCDU MENU');
 assert.equal(scan.dep,'');assert.equal(scan.dest,'');
});
