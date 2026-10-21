import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeUTCClock,utcTimestamp,todayInputDate} from '../public/lib/utc-input.js';
test('numeric clocks use 24h UTC and midnight is zero, without AM/PM',()=>{for(const[input,want]of[['0714','07:14'],['07:14','07:14'],['0000','00:00'],['2359','23:59']])assert.equal(normalizeUTCClock(input),want);});
test('invalid clock forms never roll into another day',()=>{for(const input of['2400','12:60','1260','-100','7pm','07:14 am','7:14','99999'])assert.throws(()=>normalizeUTCClock(input),/UTC/);});
test('blank clocks remain absent even when a default date is displayed',()=>{assert.equal(utcTimestamp('2026-10-22',''),undefined);assert.equal(utcTimestamp('',''),undefined);assert.throws(()=>utcTimestamp('','0714'));assert.throws(()=>utcTimestamp('2026-02-30','0714'));});
test('timestamps are built as UTC and retain unchanged historical precision',()=>{assert.equal(utcTimestamp('2026-10-22','0714'),'2026-10-22T07:14:00.000Z');const previous='2025-12-31T23:55:12.345Z';assert.equal(utcTimestamp('2025-12-31','23:55',previous),previous);assert.equal(utcTimestamp('2026-01-01','0005',previous),'2026-01-01T00:05:00.000Z');});
test('today default takes the device calendar date rather than demo selection',()=>{assert.equal(todayInputDate(new Date(2026,9,22,0,1)),'2026-10-22');});
