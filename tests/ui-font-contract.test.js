import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(name,'utf8');
const tokens=read('public/ui/tokens.css');
const legacy=read('public/style.css');
const system=read('public/ui/system.css');
const shell=read('public/sw.js');

test('system font prefers native Apple UI with Inter as a cross-platform fallback',()=>{
  assert.match(tokens,/--ui-font:\s*-apple-system,\s*BlinkMacSystemFont,\s*"Inter"/);
  assert.match(tokens,/--ui-heading-font:\s*var\(--ui-font\)/);
  assert.match(tokens,/--ui-mono:.*(?:ui-monospace|SFMono-Regular)/);
  assert.match(tokens,/family=Inter/);
  assert.doesNotMatch(tokens,/DM\+Sans|Manrope|font-face/);
});
test('legacy stylesheet no longer loads or explicitly paints DM Sans or Manrope',()=>{
  assert.doesNotMatch(legacy,/DM\s*Sans|DM\+Sans|Manrope/);
  assert.match(legacy,/\.fe-time-cell input\[data-utc-clock\]\s*\{\s*font-family:\s*var\(--ui-mono\)/);
  assert.match(legacy,/font-family:\s*var\(--ui-heading-font\)/);
  assert.match(legacy,/font-family:\s*var\(--ui-font\)/);
});
test('shared style applies the same family across body, heading, inputs, and flight clock',()=>{
  assert.match(system,/body\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(system,/input,select,textarea\)\s*\{[^}]*font-family:\s*var\(--ui-font\)/);
  assert.match(system,/h1,h2,h3,h4\)\s*\{[^}]*font-family:\s*var\(--ui-heading-font\)/);
  assert.match(system,/\.weather-report,\.formula\)\s*\{\s*font-family:\s*var\(--ui-mono\)/);
});
test('main, ATPL library and bank pages keep the shared styles and offline shell version',()=>{
  assert.match(read('public/index.html'),/href="\/ui\/system.css"/);
  assert.match(read('public/atpl/index.html'),/href="\/ui\/system.css"/);
  assert.match(read('public/atpl/avilog-theme.css'),/url\("\/ui\/system.css"\)/);
  assert.match(shell,/avilog-shell-v14-fast-entry-navy-teal-unified-weather-attention-sf-ui/);
  assert.match(shell,/"\/ui\/tokens.css"/);
  assert.match(shell,/"\/ui\/system.css"/);
});
