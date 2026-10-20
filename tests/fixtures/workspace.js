export const clone=x=>structuredClone(x);
export function flightRecord(overrides={}) {
 const base={schemaVersion:1,kind:'flight',id:'f1',revision:1,archived:false,data:{id:'f1',date:'2026-10-09',flightNo:'VN0605',dep:'SGN',dest:'HAN',aircraft:'A321',reg:'VN-QA',scheduled:{out:'2026-10-09T04:00:00.000Z',in:'2026-10-09T05:10:00.000Z'},actual:{out:'2026-10-09T04:00:00.000Z',off:'2026-10-09T04:10:00.000Z',on:'2026-10-09T05:00:00.000Z',in:'2026-10-09T05:10:00.000Z'},confirmed:true,role:'PM',picMinutes:0,nightMinutes:0,crewIds:[],note:'original',confidence:100,source:'QA'}};
 return {...base,...clone(overrides),data:{...base.data,...clone(overrides.data||{})}};
}
export const personRecord=(id='p1')=>({schemaVersion:1,kind:'person',id,revision:1,archived:false,data:{id,name:'QA Crew',rank:'Captain',note:''}});
export const dutyRecord=(id='d1')=>({schemaVersion:1,kind:'duty',id,revision:1,archived:false,data:{id,date:'2026-10-09',type:'FLIGHT',report:'2026-10-09T03:00:00.000Z',release:'2026-10-09T06:00:00.000Z',note:''}});
export const snapshot=(records=[])=>({schemaVersion:1,uid:'alice',cloudRevision:1,localVersion:1,records:clone(records)});
export const operation=(changes=[])=>({schemaVersion:1,operationId:'op-one',uid:'alice',deviceId:'qa-device',sequence:1,parents:[],baseRevision:1,changes:clone(changes)});
