// Actual Firestore SDK/rules; only seeding/root-race injection uses the admin
// fixture. Counts below are observed logical reads, not a cost estimate.
const path=require('node:path'),{pathToFileURL}=require('node:url');
module.exports=async function scale(uid){
 const root=path.resolve(__dirname,'..'),{initializeTestEnvironment}=await import('@firebase/rules-unit-testing'),sdk=await import('firebase/firestore'),{flightRecord,dutyRecord}=await import(pathToFileURL(path.join(root,'tests/fixtures/workspace.js'))),{recordKey}=await import(pathToFileURL(path.join(root,'public/workspace/schema.js'))),{pullStableWorkspace}=await import(pathToFileURL(path.join(root,'public/workspace/pull.js')));
 const env=await initializeTestEnvironment({projectId:'demo-atpl-sync',firestore:{host:'127.0.0.1',port:8080}}),base=`users/${uid}/workspaces/main`,metrics={flights:10000,rootReads:0,pageQueries:0,documentReads:0,rootRaceInjected:false};
 try{
  await env.withSecurityRulesDisabled(async context=>{
   const db=context.firestore(),prior=await sdk.getDocsFromServer(sdk.collection(db,base+'/records'));for(let i=0;i<prior.docs.length;i+=400){const batch=sdk.writeBatch(db);for(const d of prior.docs.slice(i,i+400))batch.delete(d.ref);await batch.commit();}
   const records=[dutyRecord('scale-duty-a'),dutyRecord('scale-duty-b')];for(let i=0;i<10000;i++)records.push(flightRecord({id:'scale-'+i,data:{id:'scale-'+i,flightNo:'VN'+(100000+i),dutyId:'scale-duty-a'}}));
   for(let i=0;i<records.length;i+=400){const batch=sdk.writeBatch(db);for(const record of records.slice(i,i+400))batch.set(sdk.doc(db,base+'/records/'+await recordKey(record.kind,record.id)),record);await batch.commit();}
   await sdk.setDoc(sdk.doc(db,base),{schemaVersion:1,revision:100000});
  });
  const db=env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).firestore(),started=performance.now();
  const result=await pullStableWorkspace({uid,readHead:async()=>{metrics.rootReads++;return(await sdk.getDocFromServer(sdk.doc(db,base))).data();},readPage:async({after,limit})=>{
   const clauses=[sdk.orderBy(sdk.documentId()),sdk.limit(limit)];if(after)clauses.push(sdk.startAfter(after));const docs=(await sdk.getDocsFromServer(sdk.query(sdk.collection(db,base+'/records'),...clauses))).docs;metrics.pageQueries++;metrics.documentReads+=docs.length;
   if(!metrics.rootRaceInjected){metrics.rootRaceInjected=true;await env.withSecurityRulesDisabled(c=>sdk.updateDoc(sdk.doc(c.firestore(),base),{revision:100001}));}
   return docs.map(d=>({key:d.id,data:d.data()}));
  }});
  metrics.milliseconds=Math.round(performance.now()-started);metrics.snapshotJSONBytes=Buffer.byteLength(JSON.stringify(result));metrics.returnedRecords=result.records.length;metrics.finalRevision=result.cloudRevision;
  if(result.records.length!==10002||metrics.rootReads!==4||metrics.documentReads!==20004||metrics.pageQueries!==202||result.cloudRevision!==100001)throw Error('Scale pagination/race invariant failed: '+JSON.stringify(metrics));return metrics;
 }finally{await env.cleanup();}
};
