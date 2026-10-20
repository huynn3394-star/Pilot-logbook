const REQUEST_LIMIT=1024*1024,RESPONSE_LIMIT=5*1024*1024;
const local=host=>['localhost','127.0.0.1','[::1]'].includes(host);
export function readFirebaseConfig(env=process.env){
 if(env.ATPL_ACCOUNTS_ENABLED!=='true')return {enabled:false};
 const projectId=env.FIREBASE_PROJECT_ID;if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId||''))throw new Error('Invalid Firebase project ID');
 let origin;try{origin=new URL(env.ATPL_APP_ORIGIN);}catch{throw new Error('Invalid ATPL app origin');}
 if(origin.origin!==env.ATPL_APP_ORIGIN||origin.username||origin.password||!(origin.protocol==='https:'||(origin.protocol==='http:'&&local(origin.hostname))))throw new Error('ATPL origin must be an exact HTTPS origin');
 for(const key of ['FIREBASE_API_KEY','FIREBASE_APP_ID'])if(typeof env[key]!=='string'||!env[key]||env[key].length>512)throw new Error('Missing public Firebase configuration');
 const workspaceSyncEnabled=env.AVILOG_WORKSPACE_SYNC_ENABLED==='true',evidenceSyncEnabled=env.AVILOG_EVIDENCE_SYNC_ENABLED==='true',storageBucket=env.FIREBASE_STORAGE_BUCKET;
 if(storageBucket&&storageBucket!==projectId+'.firebasestorage.app')throw new Error('Storage bucket must belong to the Firebase project');
 if(evidenceSyncEnabled&&(!workspaceSyncEnabled||!storageBucket))throw new Error('Evidence requires workspace sync and a configured Storage bucket');
 const config={enabled:true,appOrigin:origin.origin,projectId,apiKey:env.FIREBASE_API_KEY,authDomain:origin.host,appId:env.FIREBASE_APP_ID,workspaceSyncEnabled,evidenceSyncEnabled};
 if(storageBucket)config.storageBucket=storageBucket;
 if(env.ATPL_USE_EMULATORS==='true'){
  if(!local(origin.hostname)||!projectId.startsWith('demo-'))throw new Error('Emulators require a localhost demo project');
  config.emulators={auth:'http://127.0.0.1:9099',firestore:{host:'127.0.0.1',port:8080},storage:{host:'127.0.0.1',port:9199}};
 }
 return config;
}
function requestBody(req){return new Promise((resolve,reject)=>{let size=0,chunks=[];req.on('data',part=>{size+=part.length;if(size>REQUEST_LIMIT){chunks=[];reject(Object.assign(new Error('body too large'),{status:413}));}else chunks.push(part);});req.once('end',()=>resolve(Buffer.concat(chunks)));req.once('error',reject);});}
async function responseBody(response){const parts=[];let size=0;if(!response.body)return Buffer.alloc(0);const reader=response.body.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>RESPONSE_LIMIT)throw new Error('upstream too large');parts.push(Buffer.from(value));}return Buffer.concat(parts);}finally{await reader.cancel().catch(()=>{});}}
export function createFirebaseAuthHandler({config=readFirebaseConfig(),fetchImpl=fetch}={}){
 const upstream=config.enabled?new URL(`https://${config.projectId}.firebaseapp.com`):null;
 return async(req,res,url)=>{
  const send=(status,body,type='text/plain; charset=utf-8',extra={})=>{res.writeHead(status,{'Cache-Control':'no-store, max-age=0','Pragma':'no-cache','Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN',"Content-Security-Policy":"frame-ancestors 'self'",...extra});res.end(body);};
  if(url.pathname==='/atpl/firebase-config.json'){
   if(!['GET','HEAD'].includes(req.method)){send(405,'Method not allowed');return true;}
   send(200,req.method==='HEAD'?null:JSON.stringify(config),'application/json; charset=utf-8',{'X-Frame-Options':'DENY'});return true;
  }
  if(!url.pathname.startsWith('/__/auth/'))return false;
  if(!config.enabled){send(503,'Google sign-in is not activated.');return true;}
  if(!['GET','POST'].includes(req.method)){send(405,'Method not allowed');return true;}
  if(!/^\/__\/auth\/[A-Za-z0-9_./-]+$/.test(url.pathname)||url.pathname.split('/').some(p=>p==='.'||p==='..')){send(400,'Invalid helper path');return true;}
  if(Number(req.headers['content-length'])>REQUEST_LIMIT){req.resume();send(413,'Callback too large');return true;}
  try{
   const body=req.method==='POST'?await requestBody(req):undefined,headers={};for(const name of ['accept','accept-language','content-type','user-agent','cookie','origin','referer'])if(req.headers[name])headers[name]=req.headers[name];
   const response=await fetchImpl(new URL(url.pathname+url.search,upstream).href,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(15000)});
   const extra={};let location=response.headers.get('location');
   if(location){const target=new URL(location,upstream);if(target.origin===upstream.origin)location=config.appOrigin+target.pathname+target.search+target.hash;else if(target.protocol!=='https:'||target.username||target.password||![new URL(config.appOrigin).host,'accounts.google.com'].includes(target.host))throw new Error('Unexpected auth redirect');extra.Location=location;}
   const cookies=response.headers.getSetCookie?.()||[];if(cookies.length)extra['Set-Cookie']=cookies.map(c=>c.replace(new RegExp(`Domain=${upstream.hostname.replaceAll('.','\\.')}`,'ig'),`Domain=${new URL(config.appOrigin).hostname}`));
   send(response.status,await responseBody(response),response.headers.get('content-type')||'text/plain; charset=utf-8',extra);
  }catch(error){send(error.status===413?413:502,error.status===413?'Callback too large':'Authentication helper unavailable. Try again online.');}
  return true;
 };
}
