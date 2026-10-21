import {test} from 'node:test';import assert from 'node:assert/strict';
import * as weather from '../public/workspace/weather.js';import {validateRecord} from '../public/workspace/schema.js';import {mergeRecord} from '../public/workspace/model.js';
const groups=[{id:'domestic',name:'Quốc nội',airports:['VVTS','VVNB']},{id:'international',name:'Quốc tế',airports:['VTBS','VVTS']}];
test('existing airport order remains available before assigning groups, without rewriting saved settings',()=>{
 assert.equal(typeof weather.readWeatherGroups,'function');const settings={weatherAirports:['VVNB','VVTS']};assert.deepEqual(weather.readWeatherGroups(settings),[{id:'legacy',name:'Danh sách hiện tại',airports:['VVNB','VVTS']}]);assert.deepEqual(settings,{weatherAirports:['VVNB','VVTS']});assert.deepEqual(weather.readWeatherGroups({}),[]);
});
test('group and station order determine unique fetch list while duplicate membership stays in each group',()=>{
 assert.equal(typeof weather.saveWeatherGroups,'function');const settings=weather.saveWeatherGroups({leadMinutes:30},groups);assert.deepEqual(settings.weatherAirports,['VVTS','VVNB','VTBS']);assert.deepEqual(settings.weatherGroups,groups);assert.equal(settings.leadMinutes,30);const moved=weather.saveWeatherGroups(settings,[groups[1],groups[0]]);assert.deepEqual(moved.weatherAirports,['VTBS','VVTS','VVNB']);assert.deepEqual(groups[0].airports,['VVTS','VVNB']);
});
test('invalid, duplicate, oversized and contradictory group preferences cannot enter synced records',()=>{
 const base={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{weatherAirports:['VVTS','VVNB','VTBS'],weatherGroups:groups}};assert.doesNotThrow(()=>validateRecord(base));
 for(const value of[[{id:'x',name:' ',airports:[]}],[groups[0],{...groups[1],id:'domestic'}],[groups[0],{...groups[1],name:' Quốc nội '}],[{...groups[0],airports:['VVTS','VVTS']}],[{...groups[0],airports:['<bad>']}],Array.from({length:9},(_,i)=>({id:'g'+i,name:'N'+i,airports:[]}))])assert.throws(()=>validateRecord({...base,data:{...base.data,weatherGroups:value}}));
 assert.throws(()=>validateRecord({...base,data:{...base.data,weatherAirports:['VVTS']}}));assert.throws(()=>validateRecord({...base,data:{weatherGroups:groups}}));
});
test('group edits merge with reminders; concurrent group edits conflict instead of losing a list',()=>{
 const base={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{leadMinutes:120,weatherAirports:['VVTS']}};const local={...base,data:{...base.data,weatherAirports:['VVTS','VVNB','VTBS'],weatherGroups:groups}},remote={...base,data:{...base.data,leadMinutes:30}};const merged=mergeRecord({base,local,remote});assert.equal(merged.conflict,null);assert.deepEqual(merged.record.data.weatherGroups,groups);assert.equal(merged.record.data.leadMinutes,30);
 const other={...base,data:{...base.data,weatherAirports:['VVNB'],weatherGroups:[{id:'b',name:'My airports',airports:['VVNB']}]}};assert.ok(mergeRecord({base,local,remote:other}).conflict);
});
