import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAircraft} from '../public/lib/parsers.js';
import {minutes} from '../public/lib/domain.js';
const date='2026-10-19';
test('E190 screen OCR Z/2 and OUT/OUR confusions remain flagged for review',()=>{const f=parseAircraft('FLIGHT NO DEP/DEST\nAT411M GMMX/GMMN\nOUR OFF\n12302 13072\nIN ON\n13372 13332','E190',date);assert.equal(f.actual.out,'2026-10-19T12:30:00.000Z');assert.equal(f.actual.on,'2026-10-19T13:33:00.000Z');assert.ok(f.confidence<75);assert.match(f.note,/OCR/);});
test('E190 paired OOOI columns use event labels, not screen UTC or block duration',()=>{
 const f=parseAircraft('ACARS OOOI STATUS 1/3\nFLIGHT NO DEP/DEST\nAT411M GMMX/GMMN\nRETURN UTC DATE\n1339Z 19OCT26\nOUT OFF\n1230Z 1307Z\nIN ON\n1337Z 1333Z\nBLOCK FLIGHT\n0107 0026','E190',date);
 assert.equal(f.aircraft,'E190');assert.equal(f.flightNo,'AT411M');assert.equal(f.dep,'GMMX');assert.equal(f.dest,'GMMN');assert.equal(f.actual.out,'2026-10-19T12:30:00.000Z');assert.equal(f.actual.off,'2026-10-19T13:07:00.000Z');assert.equal(f.actual.on,'2026-10-19T13:33:00.000Z');assert.equal(f.actual.in,'2026-10-19T13:37:00.000Z');assert.equal(minutes(f.actual.out,f.actual.in),67);assert.equal(minutes(f.actual.off,f.actual.on),26);assert.equal(f.confirmed,false);
});
test('E190 inline labels retain midnight rollover and generic flight number',()=>{
 const f=parseAircraft('FLIGHT NO VN7388 DEP/DEST VVTS/VVDL\nOUT 2355Z OFF 0005Z\nIN 0107Z ON 0052Z','E190',date);assert.equal(f.flightNo,'VN7388');assert.equal(f.actual.off,'2026-10-20T00:05:00.000Z');assert.equal(f.actual.in,'2026-10-20T01:07:00.000Z');
});
test('E190 conflicting duplicate labels and unclear paired rows require manual review',()=>{
 assert.throws(()=>parseAircraft('OUT 1230Z\nOUT 1250Z','E190',date),/mâu thuẫn/i);
 assert.throws(()=>parseAircraft('OUT OFF\n1230Z\nIN ON\n1337Z 1333Z','E190',date),/không rõ/i);
 assert.throws(()=>parseAircraft('UTC 1339Z BLOCK 0107 FLIGHT 0026','E190',date),/OUT/);
});
