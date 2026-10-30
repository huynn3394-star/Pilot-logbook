import {test} from 'node:test';import assert from 'node:assert/strict';
import * as v4 from './fixtures/weather-readers/v4-schema.js';
import * as v5 from './fixtures/weather-readers/v5-schema.js';
import {flightRecord} from './fixtures/workspace.js';
import {validateRecord} from '../public/workspace/schema.js';import {mergeRecord} from '../public/workspace/model.js';import {createWorkspaceController} from '../public/workspace/controller.js';
test('v4 rejects extended preferences without acknowledging pending edits; v5 replays the original reminder edit and keeps watchlist',async()=>{
 const old=v4;
 const base={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{leadMinutes:120}},next=structuredClone(base),remote=structuredClone(base);next.data.leadMinutes=30;remote.revision=2;remote.data.weatherAirports=['VVTS','VVNB'];const op={operationId:'old-queued',parents:[],changes:[{kind:'preferences',id:'preferences',base,next}]},original=JSON.stringify(op);let pending=[structuredClone(op)],acknowledged=0,compatible=false;
 assert.throws(()=>old.validateRecord(remote));validateRecord(remote);
 const primaryFlight=flightRecord();primaryFlight.data.weather={day:primaryFlight.data.date,reports:[{station:'VVTS',provider:'Tan Son Nhat MET Office',fetchedAt:primaryFlight.data.date+'T04:00:00.000Z',source:'http://118.69.213.84/index.php?cat=1&sub=6',sources:{metar:'http://118.69.213.84/index.php?cat=1&sub=6',taf:'http://118.69.213.84/index.php?cat=2&sub=0'},metar:'METAR VVTS 090400Z 00000KT CAVOK 30/24 Q1013=',taf:null}]};assert.throws(()=>old.validateRecord(primaryFlight));validateRecord(primaryFlight);
 const account={config:{enabled:true,workspaceSyncEnabled:true},currentUser:()=>({uid:'alice'}),validateSession:async()=> 'alice',subscribe:()=>()=>{}},coordinator={capture:()=>({uid:'alice'}),isCurrent:()=>true,subscribe:()=>()=>{}},repository={uid:'alice',writable:true,read:async()=>({cloudRevision:1}),pending:async()=>pending,conflicts:async()=>[],acceptAck:async()=>{acknowledged++;pending=[];}},transport={subscribe:()=>()=>{},close(){},commit:async request=>{(compatible?validateRecord:old.validateRecord)(remote);const merged=mergeRecord({base:request.changes[0].base,local:request.changes[0].next,remote});assert.equal(merged.conflict,null);assert.equal(merged.record.data.leadMinutes,30);assert.deepEqual(merged.record.data.weatherAirports,['VVTS','VVNB']);return{operationId:request.operationId,revision:3,results:[]};}};
 const oldController=createWorkspaceController({account,coordinator,repository,transportFactory:()=>transport});await oldController.syncNow();assert.equal(oldController.status().kind,'error');assert.equal(acknowledged,0);assert.equal(JSON.stringify(pending[0]),original);oldController.stop();compatible=true;
 const upgraded=createWorkspaceController({account,coordinator,repository,transportFactory:()=>transport});await upgraded.syncNow();assert.equal(upgraded.status().kind,'synced');assert.equal(acknowledged,1);assert.equal(JSON.stringify(op),original);upgraded.stop();
});

test('v5 requires reload for grouped preferences while v6 still accepts flat v5 data',async()=>{
 const old=v5;
 const flat={schemaVersion:1,kind:'preferences',id:'preferences',revision:1,archived:false,data:{weatherAirports:['VVTS']}};old.validateRecord(flat);validateRecord(flat);const grouped={...flat,data:{...flat.data,weatherGroups:[{id:'domestic',name:'Quốc nội',airports:['VVTS']}]}};assert.throws(()=>old.validateRecord(grouped));validateRecord(grouped);
});
