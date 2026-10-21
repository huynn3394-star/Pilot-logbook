import {test} from 'node:test';import assert from 'node:assert/strict';
import {resolveFlightPeople} from '../public/lib/crew-entry.js';
const people=[{id:'captain',name:'Nguyễn An',rank:'Captain',note:'old'}];
test('existing self pilot assignment remains self and never creates a crew profile',()=>{const result=resolveFlightPeople(people,{captain:{name:'Nguyễn An',id:'captain'},fo:{name:'Tôi',id:'self'}});assert.equal(result.foId,'self');assert.equal(result.people.length,1);});
test('typed crew reuses normalized names and resolves new people without mutating source state',()=>{
 const result=resolveFlightPeople(people,{captain:{name:'  nguyễn   an '},fo:{name:'Trần Bình'},crew:[{name:'Lê Chi'},{name:'Lê Chi'}]});assert.equal(result.captainId,'captain');assert.equal(result.people.length,3);assert.equal(result.people.find(p=>p.id===result.foId).rank,'FO');assert.equal(result.crewIds.length,1);assert.equal(result.people.find(p=>p.id===result.crewIds[0]).name,'Lê Chi');assert.deepEqual(people,[{id:'captain',name:'Nguyễn An',rank:'Captain',note:'old'}]);
});
test('same named distinct people require explicit profile selection and stale IDs cannot be rebound',()=>{
 const all=[...people,{id:'other',name:'Nguyễn An',rank:'FO'}];assert.throws(()=>resolveFlightPeople(all,{captain:{name:'Nguyễn An'}}),/nhiều người/);assert.equal(resolveFlightPeople(all,{captain:{name:'Nguyễn An',id:'other'}}).captainId,'other');assert.throws(()=>resolveFlightPeople(all,{captain:{name:'New name',id:'other'}}),/chọn lại/);
});
test('invalid crew submission leaves no partial new profile and cannot use one person as both pilots',()=>{
 assert.throws(()=>resolveFlightPeople(people,{captain:{name:'New person'},fo:{name:'New person'}}),/khác nhau/);assert.equal(people.length,1);assert.throws(()=>resolveFlightPeople(people,{captain:{name:'x'.repeat(81)}}),/80/);
});
