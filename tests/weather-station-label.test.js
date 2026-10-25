import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as attention from '../public/workspace/weather-attention.js';

const render=(...args)=>{
  assert.equal(typeof attention.renderWeatherStationIdentity,'function','Airport identity must own its saved-status label');
  return attention.renderWeatherStationIdentity(...args);
};

test('saved label follows airport name inside the same identity column',()=>{
 const html=render('VVTS',{saved:true});
 assert.match(html,/^<span class="weather-station-identity"><strong>VVTS<\/strong><span class="weather-row-saved">Bản lưu<\/span><\/span>$/);
});

test('SPECI and saved labels stack under the airport without changing report text',()=>{
 const html=render('WSSS',{saved:true,hasSpeci:true});
 assert.match(html,/^<span class="weather-station-identity"><strong>WSSS<\/strong>/);
 assert(html.indexOf('weather-row-saved')>html.indexOf('weather-speci-badge'));
 assert.equal((html.match(/Bản lưu/g)||[]).length,1);
 assert.match(html,/weather-speci-badge">SPECI<\/span>/);
});

test('fresh or absent saved report has no empty status row, and label content is escaped',()=>{
 const html=render('<VVTS&>',{saved:false});
 assert.equal(html,'<span class="weather-station-identity"><strong>&lt;VVTS&amp;&gt;</strong></span>');
 assert(!html.includes('weather-row-saved'));
 assert(!html.includes('weather-speci-badge'));
});

test('CB after vertical-visibility cloud height is highlighted without changing the group',()=>{
 assert.equal(attention.highlightWeatherReport('VV005CB='),'VV005<mark class="weather-attention-word">CB</mark>=');
});
