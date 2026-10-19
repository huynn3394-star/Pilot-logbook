const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const privateJdk=path.join(root,'.tooling/jdk');
let javaHome=process.env.JAVA_HOME;
if(!javaHome&&fs.existsSync(privateJdk)){const first=fs.readdirSync(privateJdk)[0];if(first)javaHome=path.join(privateJdk,first,'Contents/Home');}
const mode=process.argv[2]||'rules';const target=mode==='browser'?'node scripts/verify-atpl-account-browser.cjs':'node --test --test-concurrency=1 tests/firebase-rules.emulator.js tests/atpl-firestore-sync.emulator.js';
const env={...process.env,GCLOUD_PROJECT:'demo-atpl-sync',FIREBASE_CLI_DISABLE_UPDATE_CHECK:'true',JAVA_HOME:javaHome,PATH:[javaHome&&path.join(javaHome,'bin'),path.dirname(process.execPath),process.env.PATH].filter(Boolean).join(path.delimiter)};
const result=spawnSync(process.execPath,[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--project','demo-atpl-sync','--only','auth,firestore',target],{cwd:root,env,stdio:'inherit'});process.exit(result.status??1);
