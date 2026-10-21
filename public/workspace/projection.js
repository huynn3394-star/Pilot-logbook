import {clone} from './schema.js';
export const defaultSettings={name:'Pilot',base:'SGN',tomorrow:true,missingActual:true,beforeDuty:true,leadMinutes:120,eveningHour:18,notifications:false,weatherAirports:[]};
export function toWorkspaceView(snapshot,devicePreferences={}){
 const view={version:1,flights:[],duties:[],people:[],settings:{...defaultSettings},trash:[],demo:false},archivedDuties=new Set(snapshot.records.filter(r=>r.kind==='duty'&&r.archived).map(r=>r.id));
 for(const r of snapshot.records){const d=clone(r.data);if(r.kind==='profile'||r.kind==='preferences'){if(!r.archived)Object.assign(view.settings,d);continue;}
  if(r.archived){view.trash.push({id:r.archive.id,kind:r.kind,data:d,at:r.archive.at,flightIds:r.kind==='duty'?snapshot.records.filter(f=>f.kind==='flight'&&f.data.dutyId===r.id).map(f=>f.id):[]});continue;}
  if(r.kind==='flight'){if(archivedDuties.has(d.dutyId))d.dutyId=null;if(r.evidence)d.evidence=clone(r.evidence);view.flights.push(d);}else if(r.kind==='duty')view.duties.push(d);else view.people.push(d);
 }view.settings.notifications=devicePreferences.notifications===true;return view;
}
