exports.knownConfigCancellation=function(event,origin,failures){
 let host;try{host=new URL(origin).host;}catch{return false;}
 if(!event.message.includes(host+'/atpl/firebase-config.json')||!event.message.endsWith('due to access control checks.'))return false;
 return failures.some(f=>f.id===event.id&&Math.abs(f.at-event.at)<=2000&&/cancelled|canceled|abort/i.test(f.error||''));
};
exports.knownConfigRefusal=function(event,origin,refusals){let host;try{host=new URL(origin).host;}catch{return false;}if(!event.message.includes(host+'/atpl/firebase-config.json')||!event.message.endsWith('due to access control checks.'))return false;return(refusals.get(event.id+':/atpl/firebase-config.json')||[]).some(at=>Math.abs(at-event.at)<=2000);};
exports.knownProviderAbort=function(event,proof){
 if(!event.message.endsWith(' due to access control checks.'))return false;
 return proof.some(item=>{let url;try{url=new URL(item.url);}catch{return false;}const provider=url.origin==='http://127.0.0.1:8080'&&/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(url.pathname),probe=[8080,9099,9199].includes(Number(url.port))&&url.hostname==='127.0.0.1'&&url.pathname==='/qa-offline-probe';return item.id===event.id&&Math.abs(item.at-event.at)<=2000&&(provider||probe)&&event.message==='/' + url.host+url.pathname+url.search+' due to access control checks.';});
};
// WebKit can emit diagnostics for retried requests in a cancelled channel.
// Require actual cancellation proof for this precise emulator channel session.
exports.knownProviderCancellation=function(event,failures){
 const suffix=' due to access control checks.';
 if(!event.message.endsWith(suffix)||!event.message.startsWith('/127.0.0.1:8080/'))return false;
 let diagnostic;try{diagnostic=new URL('http:/'+event.message.slice(0,-suffix.length));}catch{return false;}
 if(!/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(diagnostic.pathname)||!diagnostic.searchParams.get('SID')||!diagnostic.searchParams.get('database'))return false;
 return failures.some(item=>{let request;try{request=new URL(item.url);}catch{return false;}return item.id===event.id&&Math.abs(item.at-event.at)<=2000&&/^(cancelled|canceled|aborted)$/i.test(item.error||'')&&request.origin===diagnostic.origin&&request.pathname===diagnostic.pathname&&request.searchParams.get('SID')===diagnostic.searchParams.get('SID')&&request.searchParams.get('database')===diagnostic.searchParams.get('database');});
};
