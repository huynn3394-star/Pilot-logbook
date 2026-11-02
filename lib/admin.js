import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {createHmac,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const FEATURES=['weather','schedule','logbook','atpl','crew','statistics','settings'];
const KINDS=['page_view','feature_view','heartbeat','runtime_error'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DAY=86400000;
const dayOf=time=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
const failure=(status,message)=>Object.assign(new Error(message),{status});

export function readAdminConfig(env=process.env){
 if(env.AVILOG_ADMIN_ENABLED!=='true')return {enabled:false};
 const emails=(env.AVILOG_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!emails.length||emails.some(s=>!/^\S+@\S+\.\S+$/.test(s)))throw Error('Admin owner is not configured');
 const mount=env.RAILWAY_VOLUME_MOUNT_PATH;
 const directory=env.AVILOG_ADMIN_DATA_DIR||(mount&&path.join(mount,'avilog-admin'));
 const publicRoot=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
 if(!directory||!path.isAbsolute(directory)||directory==='/'||path.resolve(directory)===publicRoot||path.resolve(directory).startsWith(publicRoot+path.sep)||path.resolve(directory)==='/app/public'||path.resolve(directory).startsWith('/app/public/'))throw Error('Private persistent storage is not configured');
 if(env.RAILWAY_ENVIRONMENT_ID&&(!mount||!path.resolve(directory).startsWith(path.resolve(mount)+path.sep)))throw Error('A persistent Railway volume is required');
 return {enabled:true,emails,directory};
}

export function createUsageStore({directory,now=Date.now}={}){
 mkdirSync(directory,{recursive:true,mode:0o700});
 const filename=path.join(directory,'avilog-usage.sqlite');
 const db=new DatabaseSync(filename);chmodSync(filename,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA max_page_count=20000;
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS visitors(id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL,device TEXT NOT NULL,feature TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,started INTEGER NOT NULL,last_seen INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS daily_visitors(day TEXT NOT NULL,visitor TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,visitor));
 CREATE TABLE IF NOT EXISTS daily_features(day TEXT NOT NULL,visitor TEXT NOT NULL,feature TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,visitor,feature));
 CREATE TABLE IF NOT EXISTS daily_counts(day TEXT NOT NULL,metric TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,metric));
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,seen INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS visitors_seen ON visitors(last_seen);
 CREATE INDEX IF NOT EXISTS sessions_seen ON sessions(last_seen);
 CREATE INDEX IF NOT EXISTS events_seen ON events(seen);`);
 const meta=db.prepare('INSERT OR IGNORE INTO meta(key,value) VALUES(?,?)');
 meta.run('secret',randomBytes(32).toString('hex'));meta.run('startedAt',new Date(now()).toISOString());
 const secret=db.prepare('SELECT value FROM meta WHERE key=?').get('secret').value;
 const hash=value=>createHmac('sha256',secret).update(value).digest('hex');
 const count=db.prepare('INSERT INTO daily_counts(day,metric,count) VALUES(?,?,1) ON CONFLICT(day,metric) DO UPDATE SET count=count+1');
 let prunedDay='';
 function prune(){const today=dayOf(now());if(today===prunedDay)return;prunedDay=today;const cutoff=dayOf(now()-89*DAY);
  db.prepare('DELETE FROM daily_visitors WHERE day<?').run(cutoff);db.prepare('DELETE FROM daily_features WHERE day<?').run(cutoff);db.prepare('DELETE FROM daily_counts WHERE day<?').run(cutoff);
  db.prepare('DELETE FROM sessions WHERE last_seen<?').run(now()-90*DAY);db.prepare('DELETE FROM visitors WHERE last_seen<?').run(now()-90*DAY);db.prepare('DELETE FROM events WHERE seen<?').run(now()-7*DAY);
 }
 function record(event){
  prune();const time=now(),day=dayOf(time),visitor=hash('visitor:'+event.visitorId),session=hash('session:'+event.sessionId),eventId=hash('event:'+event.eventId);
  db.exec('BEGIN IMMEDIATE');try{
   if(!db.prepare('INSERT OR IGNORE INTO events(id,seen) VALUES(?,?)').run(eventId,time).changes){db.exec('COMMIT');return;}
   db.prepare('INSERT INTO visitors VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,device=excluded.device,feature=excluded.feature').run(visitor,time,time,event.device,event.feature);
   // A session identifier cannot be reassigned to another browser.
   db.prepare('INSERT INTO sessions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen WHERE sessions.visitor=excluded.visitor').run(session,visitor,time,time);
   db.prepare('INSERT INTO daily_visitors(day,visitor,views) VALUES(?,?,?) ON CONFLICT(day,visitor) DO UPDATE SET views=views+excluded.views').run(day,visitor,event.kind==='page_view'?1:0);
   if(event.kind==='page_view'||event.kind==='feature_view')db.prepare('INSERT INTO daily_features VALUES(?,?,?,1) ON CONFLICT(day,visitor,feature) DO UPDATE SET views=views+1').run(day,visitor,event.feature);
   if(event.kind==='runtime_error')count.run(day,'browser_errors');
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function observe(route,status){prune();const day=dayOf(now());count.run(day,'http_requests');if(status>=500)count.run(day,'http_errors');if(route==='/api/weather'){count.run(day,'weather_requests');if(status>=400)count.run(day,'weather_errors');}}
 function overview(days=30){
  prune();const today=dayOf(now()),start=dayOf(now()-(days-1)*DAY),n=(sql,...args)=>Number(db.prepare(sql).get(...args)?.n||0);
  const daysRows=db.prepare('SELECT day,COUNT(*) AS visitors,SUM(views) AS views FROM daily_visitors WHERE day>=? GROUP BY day ORDER BY day').all(start),lookup=new Map(daysRows.map(row=>[row.day,row]));
  const daily=Array.from({length:days},(_,i)=>{const day=dayOf(now()-(days-1-i)*DAY);return lookup.get(day)||{day,visitors:0,views:0};});
  return {startedAt:db.prepare("SELECT value FROM meta WHERE key='startedAt'").get().value,generatedAt:new Date(now()).toISOString(),timezone:'Asia/Ho_Chi_Minh',retentionDays:90,days,
   summary:{active5:n('SELECT COUNT(*) AS n FROM visitors WHERE last_seen>=?',now()-5*60000),active30:n('SELECT COUNT(*) AS n FROM visitors WHERE last_seen>=?',now()-30*60000),today:n('SELECT COUNT(*) AS n FROM daily_visitors WHERE day=?',today),week:n('SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day>=?',dayOf(now()-6*DAY)),month:n('SELECT COUNT(DISTINCT visitor) AS n FROM daily_visitors WHERE day>=?',dayOf(now()-29*DAY)),views:n('SELECT SUM(views) AS n FROM daily_visitors WHERE day>=?',start),sessions:n('SELECT COUNT(*) AS n FROM sessions WHERE started>=?',Date.parse(start+'T00:00:00+07:00'))},daily,
   features:db.prepare('SELECT feature,SUM(views) AS views,COUNT(DISTINCT visitor) AS visitors FROM daily_features WHERE day>=? GROUP BY feature ORDER BY views DESC').all(start),
   devices:db.prepare('SELECT device,COUNT(*) AS visitors FROM visitors WHERE last_seen>=? GROUP BY device ORDER BY visitors DESC').all(Date.parse(start+'T00:00:00+07:00')),
   counters:Object.fromEntries(db.prepare('SELECT metric,SUM(count) AS count FROM daily_counts WHERE day>=? GROUP BY metric').all(start).map(r=>[r.metric,r.count]))};
 }
 return {record,observe,overview,close:()=>db.close()};
}

async function readJSON(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw failure(415,'Cần gửi JSON.');
 if(Number(req.headers['content-length'])>2048){req.resume();throw failure(413,'Yêu cầu quá lớn.');}
 let size=0,chunks=[];for await(const part of req){size+=part.length;if(size>2048)throw failure(413,'Yêu cầu quá lớn.');chunks.push(part);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw failure(400,'JSON không hợp lệ.');}
}
function validateEvent(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['visitorId','sessionId','eventId','kind','feature','device'].includes(k))||!['visitorId','sessionId','eventId'].every(k=>typeof value[k]==='string'&&UUID.test(value[k]))||!KINDS.includes(value.kind)||!FEATURES.includes(value.feature)||!['desktop','tablet','mobile'].includes(value.device))throw failure(400,'Sự kiện không hợp lệ.');
 return value;
}

export function createAdminService({config,firebaseConfig={enabled:false},fetchImpl=fetch,now=Date.now,store}={}){
 let setupError=false;try{config??=readAdminConfig();if(config.enabled&&!firebaseConfig.enabled)throw Error('Google sign-in is not configured');if(config.enabled)store??=createUsageStore({directory:config.directory,now});}catch{setupError=true;config={enabled:false};}
 const started=now();let rateWindow=0,rateCount=0;const limits=new Map();
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});res.end(status===204?undefined:JSON.stringify(data));};
 async function authorize(req){
  const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/)?.[1];if(!token)throw failure(401,'Đăng nhập Google để mở trang quản trị.');
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}catch{throw failure(401,'Phiên đăng nhập không hợp lệ.');}
  if(claims.aud!==firebaseConfig.projectId||claims.iss!==`https://securetoken.google.com/${firebaseConfig.projectId}`||!Number.isFinite(claims.exp)||claims.exp*1000<=now()||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128)throw failure(401,'Phiên đăng nhập không hợp lệ.');
  let response;try{response=await fetchImpl('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(firebaseConfig.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),redirect:'error',signal:AbortSignal.timeout(6000)});}catch{throw failure(503,'Chưa xác minh được đăng nhập. Thử lại khi có mạng.');}
  if(!response.ok)throw failure(response.status>=500?503:401,'Cần đăng nhập lại để mở trang quản trị.');
  const text=await response.text();if(text.length>65536)throw failure(503,'Không xác minh được đăng nhập.');
  let account;try{account=JSON.parse(text).users?.[0];}catch{throw failure(503,'Không xác minh được đăng nhập.');}
  if(!account||account.localId!==claims.sub||account.disabled||account.emailVerified!==true||!account.providerUserInfo?.some(p=>p.providerId==='google.com')||!config.emails.includes(account.email?.toLowerCase()))throw failure(403,'Tài khoản này không có quyền quản trị AviLog.');
  return {email:account.email,name:account.displayName||account.email};
 }
 async function handle(req,res,url){
  if(!url.pathname.startsWith('/api/admin/')&&!url.pathname.startsWith('/api/usage/'))return false;
  try{
   const minute=Math.floor(now()/60000);if(minute!==rateWindow){rateWindow=minute;rateCount=0;limits.clear();}if(++rateCount>10000)throw failure(429,'Vui lòng thử lại sau.');
   if(url.pathname==='/api/usage/config'){
    if(req.method!=='GET')throw failure(405,'Method not allowed');send(res,200,{enabled:Boolean(config.enabled),heartbeatMs:60000});return true;
   }
   if(!config.enabled)throw failure(503,setupError?'Trang quản trị chưa được cấu hình đầy đủ.':'Trang quản trị chưa được bật.');
   if(url.pathname==='/api/usage/event'){
    if(req.method!=='POST')throw failure(405,'Method not allowed');
    if(req.headers.origin!==firebaseConfig.appOrigin||['cross-site','none'].includes(req.headers['sec-fetch-site']))throw failure(403,'Nguồn yêu cầu không hợp lệ.');
    const event=validateEvent(await readJSON(req));const used=limits.get(event.visitorId)||0;if(used>=30)throw failure(429,'Vui lòng thử lại sau.');limits.set(event.visitorId,used+1);
    store.record(event);send(res,204);return true;
   }
   if(req.method!=='GET')throw failure(405,'Method not allowed');
   const account=await authorize(req);
   if(url.pathname==='/api/admin/session'){send(res,200,{account});return true;}
   if(url.pathname!=='/api/admin/overview')throw failure(404,'Not found');
   const days=Number(url.searchParams.get('days')||30);if(![7,30,90].includes(days))throw failure(400,'Khoảng thời gian không hợp lệ.');
   send(res,200,{...store.overview(days),account,system:{ok:true,node:process.version,uptimeSeconds:Math.floor((now()-started)/1000),deployment:process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,12)||null,persistent:true}});
  }catch(error){send(res,[400,401,403,404,405,413,415,429,503].includes(error.status)?error.status:500,{error:error.status?error.message:'Chưa đọc được thống kê. Vui lòng thử lại.'});}
  return true;
 }
 return {handle,observe(route,status){if(!config.enabled||route.startsWith('/api/admin/')||route.startsWith('/api/usage/')||route==='/api/health'||route.startsWith('/admin'))return;try{store.observe(route,status);}catch{}},close(){store?.close();}};
}
