import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readA320Scan} from '../public/lib/a320-scan.js';
import {parseAircraft} from '../public/lib/parsers.js';
import {prepareScanDraft} from '../public/lib/flight-assist.js';
import {minutes} from '../public/lib/domain.js';
// Synthetic record preserving the supplied A321 layout, not a production flight.
const fixture=`AOC OOOI STATUS 1/3
FLIGHT ID             ORIG/DEST
VN9911                VVTS/VVCI
RETURN       UTC      DATE
----Z        1355     25OCT26
OUT                   OFF
1151Z                 1204Z
IN <                  ON
1352Z                 1342Z
BLOCK                 FLIGHT
0201                  0138
RETURN TO
<AOC MENU             PRINT*`;
const expected={out:'11:51',off:'12:04',on:'13:42',in:'13:52'};

test('A321 OOOI STATUS pairs OUT/OFF and IN/ON rows without using UTC/RETURN',()=>{
 const scan=readA320Scan(fixture);
 assert.deepEqual(scan.clocks,expected);
 assert.equal(scan.flightNo,'VN9911');assert.deepEqual([scan.dep,scan.dest],['VVTS','VVCI']);
 assert.deepEqual(scan.reported,{flight:'01:38',block:'02:01'});
 assert.deepEqual(scan.computed,{flight:98,block:121});assert.equal(scan.verified,2);assert.equal(scan.mismatch,0);
 assert.equal(scan.layout,'oooi-status');
 assert(!Object.values(scan.clocks).includes('13:55'));
});
test('Z suffix works with compact or colon-separated inline clocks',()=>{
 const scan=readA320Scan('AOC OOOI STATUS\nVN9911 VVTS/VVCI\nOUT 1151Z OFF 12:04Z\nIN 1352Z ON 13:42Z\nBLOCK 0201 FLIGHT 0138');
 assert.deepEqual(scan.clocks,expected);assert.equal(scan.verified,2);
});
test('A321 reads OCR separated columns with labels immediately above values',()=>{
 const scan=readA320Scan('AOC 0001 STATUS\nVN9911 VVTS/VVCI\nUTC\n1355\nOUT\n1151Z\nIN\n1352Z\nBLOCK\n0201\nOFF\n1204Z\nON\n1342Z\nFLIGHT\n0138');
 assert.deepEqual(scan.clocks,expected);assert.equal(scan.verified,2);
});
test('row pairing tolerates blank lines and arrows but not shifted single values',()=>{
 const scan=readA320Scan(fixture.replace('IN <','IN ←').replace('OUT                   OFF\n','OUT                   OFF\n\n'));
 assert.deepEqual(scan.clocks,expected);
 const missing=readA320Scan(fixture.replace('1151Z                 1204Z','1204Z'));
 assert.equal(missing.clocks.out,undefined);assert.equal(missing.clocks.off,undefined);
 assert.match(missing.warnings.join(' '),/OUT\/OFF/);
});
test('unknown placeholder preserves the right column without inventing OUT',()=>{
 const scan=readA320Scan(fixture.replace('1151Z','----Z'));
 assert.equal(scan.clocks.out,undefined);assert.equal(scan.clocks.off,'12:04');assert.equal(scan.computed.block,null);
});
test('invalid clocks do not become current UTC, durations or dates',()=>{
 const scan=readA320Scan(fixture.replace('1151Z','2961Z'));
 assert.equal(scan.clocks.out,undefined);assert.equal(scan.clocks.off,'12:04');assert.match(scan.warnings.join(' '),/không hợp lệ/);
 const durationOnly=readA320Scan('AOC OOOI STATUS\nUTC\n1355\nDATE\n25OCT26\nBLOCK FLIGHT\n0201 0138');
 assert.deepEqual(durationOnly.clocks,{});assert.throws(()=>parseAircraft('BLOCK 0201 FLIGHT 0138','A320','2026-10-25'));
});
test('duration mismatch warns and never changes the four observed clocks',()=>{
 const scan=readA320Scan(fixture.replace('0201','0202'));
 assert.deepEqual(scan.clocks,expected);assert.equal(scan.mismatch,1);assert.match(scan.warnings.join(' '),/BLOCK/);
});
test('OCR O/0 and I/1 repairs are flagged while conflicting observations require review',()=>{
 const scan=readA320Scan(fixture.replace('1151Z','I15IZ'));
 assert.equal(scan.clocks.out,'11:51');assert.match(scan.warnings.join(' '),/OCR đã sửa/);
 const conflict=readA320Scan(fixture+'\nOUT 1152Z');assert.match(conflict.warnings.join(' '),/mâu thuẫn/);
});
test('flight date remains entered OUT date; screen DATE/UTC never overwrites it',()=>{
 const text=fixture.replace('1151Z','2351Z').replace('1204Z','0004Z').replace('1352Z','0152Z').replace('1342Z','0142Z');
 const f=parseAircraft(text,'A320','2026-10-24');
 assert.equal(f.date,'2026-10-24');assert.equal(f.actual.out,'2026-10-24T23:51:00.000Z');assert.equal(f.actual.in,'2026-10-25T01:52:00.000Z');
 assert.equal(minutes(f.actual.off,f.actual.on),98);assert.equal(minutes(f.actual.out,f.actual.in),121);assert.equal(f.confirmed,false);
});
test('STATUS draft uses the existing target record, schedule and FINAL review pathway',()=>{
 const scan=parseAircraft(fixture,'A320','2026-10-25');
 assert.deepEqual([scan.dep,scan.dest],['SGN','HPH']);
 const old={id:'synthetic-saved',date:scan.date,flightNo:'VN9911',aircraft:'A321',reg:'TEST',confirmed:true,scheduled:{out:'2026-10-25T11:40:00.000Z'},actual:{},role:'PM',crewIds:['test-crew']};
 const draft=prepareScanDraft(old,scan);assert.equal(draft.id,old.id);assert.equal(draft.confirmed,false);assert.equal(draft.reg,old.reg);assert.deepEqual(draft.scheduled,old.scheduled);assert.deepEqual(draft.crewIds,old.crewIds);
});

test('known STATUS clock suffix OCR 2/Z repairs are explicit and never accepted as arbitrary fifth digits',()=>{
 const scan=readA320Scan(fixture.replace('1151Z','11512').replace('1204Z','12042').replace('1352Z','13522').replace('IN <','IN ¢'));
 assert.deepEqual(scan.clocks,expected);assert.match(scan.warnings.join(' '),/2.*Z/);assert(scan.confidence<90);
 const unrelated=readA320Scan('AOC FLT LOG\nVN9911 VVTS/VVCI\nOUT 11512 OFF 12042 ON 13422 IN 13522');
 assert.deepEqual(unrelated.clocks,{});
 const invalid=readA320Scan(fixture.replace('1151Z','11515'));assert.equal(invalid.clocks.out,undefined);
});
