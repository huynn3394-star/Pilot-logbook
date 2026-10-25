// One-time, deterministic typography migration for the approved 25 Oct 2026 release.
// No data, app behavior, dependencies or credentials are read or changed.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const files=['public/ui/tokens.css','public/style.css','public/ui/system.css','public/sw.js','tests/v14-build-cache.test.js','tests/workspace-service-worker.test.js','scripts/verify-shared-ui.cjs'];
const sha=s=>createHash('sha256').update(s).digest('hex');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const original={
 'public/ui/tokens.css':'3ed95e89523be8dfbd06eb0fe925683d4cd24f9b',
 'public/style.css':'6de35129f0c2386b8982dcbf9c7d38fee7f975ac',
 'public/ui/system.css':'ecb8db11af2f97da283d0a54d89bdc443874e266',
 'public/sw.js':'6c947c804f5479da7cba8acb213b9b45849d46bf',
 'tests/v14-build-cache.test.js':'39be09ee83befa42bf1935436b32fd90aecba992',
 'tests/workspace-service-worker.test.js':'fe82c3b6491b03ab2beba220a95d2fec9c179e73',
 'scripts/verify-shared-ui.cjs':'ebc321b3c8b1dc77a7316be14acbebc15d00733e'
};
const parent=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const oldShell='avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention';
const newShell=oldShell+'-sf-ui';
const replace=(s,a,b)=>{assert(s.includes(a),'Missing expected source: '+a.slice(0,100));return s.replace(a,b)};
if(process.argv.includes('--package')){
 const changed=execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.deepEqual([...changed].sort(),[...files].sort(),'Only approved typography and expectation files may change');
 const entries=await Promise.all(files.map(async path=>{const content=await readFile(path,'utf8');return{path,content,bytes:Buffer.byteLength(content),sha256:sha(content)}}));
 await mkdir('test-results/font-ui',{recursive:true});
 await writeFile('test-results/font-ui/candidate.json',JSON.stringify({parent,base:'5dfbd15b78fd81b7dc68ebb8f1b7a5feca9a05de',files:entries},null,2));
 await writeFile('test-results/font-ui/typography.patch',execFileSync('git',['diff','--',...files],{encoding:'utf8'}));
 console.log('Packaged exact tested source bytes; no branch updated.');
}else{
 const sources=Object.fromEntries(await Promise.all(files.map(async p=>[p,await readFile(p,'utf8')])));
 if(sources['public/ui/tokens.css'].includes('--ui-font: -apple-system')){
  assert(!/DM\s*Sans|DM\+Sans|Manrope/.test(sources['public/style.css']));
  assert(sources['public/sw.js'].includes(newShell));
  console.log('System typography is already applied.');
 }else{
  for(const [p,s]of Object.entries(sources))assert.equal(blob(s),original[p],p+' changed since approved baseline; refusing blind overwrite');
  let t=sources['public/ui/tokens.css'];
  t=t.replace(/^@import[^\n]+\n/,'@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");\n');
  t=replace(t,'--ui-font: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;','--ui-font: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;');
  t=replace(t,'--ui-heading-font: "Manrope", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;','--ui-heading-font: var(--ui-font);');
  sources['public/ui/tokens.css']=t;
  let legacy=sources['public/style.css'].replace(/^@import[^\n]+\n/,'');
  legacy=replace(legacy,'#modal .fe-time-cell input[data-utc-clock] {\n  font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;','#modal .fe-time-cell input[data-utc-clock] {\n  font-family: var(--ui-mono);');
  legacy=legacy.replaceAll('"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif','var(--ui-font)').replaceAll('"DM Sans", sans-serif','var(--ui-font)').replaceAll('Manrope, sans-serif','var(--ui-heading-font)');
  assert(!/DM\s*Sans|DM\+Sans|Manrope/.test(legacy));sources['public/style.css']=legacy;
  sources['public/ui/system.css']+='\n/* Shared fixed-width flight figures; all existing sizes and layout stay unchanged. */\n#app .metric-value, #modal .fe-summary-grid strong, #modal .fe-time-cell input[data-utc-clock] { font-family:var(--ui-mono); font-variant-numeric:tabular-nums; }\n';
  for(const p of ['public/sw.js','tests/v14-build-cache.test.js','tests/workspace-service-worker.test.js']){
   assert(sources[p].includes(oldShell),p);sources[p]=sources[p].replaceAll(oldShell,newShell);
  }
  let browser=sources['scripts/verify-shared-ui.cjs'];
  browser=replace(browser,"  assert(values.font.includes('DM Sans'),label+' common font');",`  assert(/-apple-system|BlinkMacSystemFont/.test(values.font)&&values.font.includes('Inter'),label+' common native/Inter stack');
  const fontAudit=await p.evaluate(()=>[...document.querySelectorAll('h1,h2,h3,.brand,.mobile-brand,.airport,button,input,select,textarea,.metric-value,.fe-summary-grid strong')].filter(n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0).map(n=>({tag:n.tagName,cls:n.className,font:getComputedStyle(n).fontFamily,clock:n.matches('.fe-time-cell [data-utc-clock],.metric-value,.fe-summary-grid strong')})));
  assert(fontAudit.length>0,label+' typography samples exist');
  for(const item of fontAudit){
   assert(!/DM Sans|Manrope/.test(item.font),label+' legacy family remains: '+JSON.stringify(item));
   if(item.clock)assert(/monospace|SFMono/i.test(item.font),label+' time figures must be monospaced');
  }
  values.fontAudit=fontAudit;`);
  // A DOMContentLoaded event does not guarantee an asynchronously served imported
  // sheet has entered WebKit's CSSOM. Keep the exact assertion, await its real signal,
  // and block external fonts so the offline case genuinely tests native fallbacks.
  browser=replace(browser,"lastLabel=name+' offline';","lastLabel=name+' offline';\n     await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());");
  const cssAssert="assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim()),'avilog-shared-v1');";
  assert.equal(browser.split(cssAssert).length,3,'Two offline entrypoint assertions must remain');
  browser=browser.replaceAll(cssAssert,"await p.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim()==='avilog-shared-v1',null,{timeout:10000});\n     "+cssAssert);
  const offline="if(name==='chromium')await context.setOffline(true);else unavailable=true;";
  browser=replace(browser,offline,offline+"\n     const refused=await p.evaluate(()=>fetch('/api/health',{cache:'no-store'}).then(()=>false).catch(()=>true));assert(refused,name+' offline origin probe must fail');");
  sources['scripts/verify-shared-ui.cjs']=browser;
  for(const [p,s]of Object.entries(sources))await writeFile(p,s);
  console.log('Applied typography-only changes to '+files.length+' files, with original-source fingerprint checks.');
 }
}
