import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../public/workspace/weather-watch-ui.js';

test('weather search matches partial ICAO, ignoring case and outer spaces',()=>{
 assert.equal(typeof ui.matchesWeatherStation,'function');
 for(const query of ['','  ',' vvts ','VVT','TS'])assert.equal(ui.matchesWeatherStation('VVTS',query),true,query);
 for(const query of ['VVNB','<img>','TAF','TSRA'])assert.equal(ui.matchesWeatherStation('VVTS',query),false,query);
});
test('weather search resolves existing supported IATA aliases, not arbitrary codes',()=>{
 assert.equal(typeof ui.matchesWeatherStation,'function');
 for(const [icao,iata]of [['VVTS','sgn'],['VVNB','HAN'],['ZGGG','CAN'],['WSSS','SIN']])assert.equal(ui.matchesWeatherStation(icao,iata),true);
 assert.equal(ui.matchesWeatherStation('VVNB','SGN'),false);
 assert.equal(ui.matchesWeatherStation('RJTT','XYZ'),false);
});
test('folder product defaults to METAR and changes independently without mutating state',()=>{
 assert.equal(typeof ui.weatherGroupProduct,'function');
 const view={products:{dom:'taf',intl:'metar',bad:'unexpected'}},before=JSON.stringify(view);
 assert.equal(ui.weatherGroupProduct(view,'dom'),'taf');
 for(const id of ['intl','bad','missing','toString','__proto__'])assert.equal(ui.weatherGroupProduct(view,id),'metar');
 assert.equal(JSON.stringify(view),before);
 assert.equal(ui.weatherGroupProduct({},'dom'),'metar');
});
