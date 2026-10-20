import {getCoordinator} from './coordinator.js';
let promise;
export function getAccountClient(){return promise??=(async()=>{
 let config={enabled:false};
 try{const r=await fetch('/atpl/firebase-config.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('config unavailable');config=await r.json();try{localStorage.setItem('atpl_public_firebase_config_v1',JSON.stringify(config));}catch{}}
 catch{try{config=JSON.parse(localStorage.getItem('atpl_public_firebase_config_v1')||'{"enabled":false}');}catch{}}
 const {createAccountClient}=await import('../atpl/vendor/firebase-client.js');return createAccountClient({config,coordinator:getCoordinator()});
})();}
