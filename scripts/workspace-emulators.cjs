const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'rules';
const targets={v14:'node scripts/verify-v14-account.cjs',weather:'node scripts/verify-weather-account.cjs',browser:'node scripts/verify-workspace-browser.cjs',evidence:'node --test --test-concurrency=1 tests/evidence-rules.emulator.js',rules:'node --test --test-concurrency=1 tests/workspace-rules.emulator.js tests/workspace-firestore.emulator.js'};
if(!targets[mode])throw Error('Unsupported workspace emulator mode: '+mode);
let javaHome=process.env.JAVA_HOME;const jdk=path.join(root,'.tooling/jdk');if(!javaHome&&fs.existsSync(jdk)){const first=fs.readdirSync(jdk)[0];if(first)javaHome=path.join(jdk,first,'Contents/Home');}
const env={...process.env,GCLOUD_PROJECT:'demo-atpl-sync',FIREBASE_CLI_DISABLE_UPDATE_CHECK:'true',JAVA_HOME:javaHome,PATH:[javaHome&&path.join(javaHome,'bin'),path.dirname(process.execPath),process.env.PATH].filter(Boolean).join(path.delimiter)};
const result=spawnSync(process.execPath,[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-atpl-sync','--only',mode==='rules'?'auth,firestore':'auth,firestore,storage',targets[mode]],{cwd:root,env,stdio:'inherit'});process.exit(result.status??1);
