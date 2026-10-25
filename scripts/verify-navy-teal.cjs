/* Read-only local browser verification. No cloud credentials or production writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

function rgb(value) {
  const parts = value.match(/[\d.]+/g);
  assert(parts && parts.length >= 3, `Unsupported computed color: ${value}`);
  return parts.slice(0, 3).map(Number);
}
function luminance(color) {
  return rgb(color).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
(async () => {
  const out = path.resolve('test-results/navy-teal');
  await fs.mkdir(out, { recursive: true });
  const report = { scope: 'Real local app and service worker, fresh guest contexts; no production account or physical iOS test.', checks: [], errors: [] };
  let server;
  async function stopServer() {
    if (!server) return;
    const closing = server;
    server = null;
    await new Promise(resolve => { closing.close(resolve); closing.closeAllConnections(); });
  }
  try {
    process.env.ATPL_ACCOUNTS_ENABLED = 'false';
    process.env.AVILOG_WORKSPACE_SYNC_ENABLED = 'false';
    process.env.AVILOG_EVIDENCE_SYNC_ENABLED = 'false';
    process.env.AVILOG_LOGBOOK_V14_ENABLED = 'false';
    const { createServer } = await import('../server.js');
    server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browsers = process.env.THEME_BROWSER === 'chromium' ? [['chromium', chromium]] : [['chromium', chromium], ['webkit', webkit]];
    for (const [name, engine] of browsers) {
      const browser = await engine.launch({ headless: true });
      try {
        for (const width of [320, 390, 820, 1440]) {
          const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
          const page = await context.newPage();
          const pageErrors = [];
          page.on('pageerror', error => pageErrors.push(error.message));
          // Do not contact weather, fonts or identity providers during visual checks.
          await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
          await page.goto(origin, { waitUntil: 'domcontentloaded' });
          await page.locator('[data-tab="logbook"]:visible').first().click();
          await page.locator('.page-management>summary').click();
          await page.locator('[data-action="add"]:visible').click();
          await page.locator('#modal.flight-editor-modal[open]').waitFor();
          await page.locator('#flight-form [name="flightNo"]').fill('VN9999');
          await page.locator('#flight-form [name="date"]').fill('2026-10-24');
          await page.locator('#flight-form [name="dep"]').fill('HAN');
          await page.locator('#flight-form [name="dest"]').fill('CAN');
          for (const theme of ['light', 'dark']) {
            await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
            const colors = await page.evaluate(() => {
              const css = node => getComputedStyle(node);
              const root = css(document.documentElement);
              const modal = document.querySelector('#modal');
              const active = modal.querySelector('[aria-selected="true"]');
              const idle = modal.querySelector('[aria-selected="false"]');
              const field = modal.querySelector('[name="flightNo"]');
              const label = field.closest('label').querySelector('span');
              const save = modal.querySelector('.fe-save');
              const nav = document.querySelector('.bottom-nav button.active');
              return {
                brand: root.getPropertyValue('--dark').trim(),
                accent: root.getPropertyValue('--accent').trim(),
                card: css(field.closest('.fe-card')).backgroundColor,
                ink: css(field).color,
                muted: css(label).color,
                save: css(save).color,
                tab: css(active).color,
                idle: css(idle).color,
                tabBackground: css(modal.querySelector('.fe-tabs')).backgroundColor,
                underline: css(active).borderBottomColor,
                nav: css(nav).color,
                overflow: document.documentElement.scrollWidth > innerWidth + 1 || modal.scrollWidth > modal.clientWidth + 1,
                bodyWidth: modal.querySelector('.fe-body').getBoundingClientRect().width
              };
            });
            assert.equal(colors.brand.toLowerCase(), '#142744', 'Existing navy brand must remain unchanged');
            assert.equal(colors.accent.toLowerCase(), theme === 'dark' ? '#2dd4bf' : '#0f766e', 'One teal accent, with readable light/dark shades');
            assert.notEqual(colors.tab, colors.idle, 'Selected tab must be visibly distinct');
            assert.equal(colors.tab, colors.underline, 'Active tab keeps a non-color underline cue');
            assert.equal(colors.save, colors.tab, 'Save and active tab share the single accent');
            assert(contrast(colors.save, colors.tabBackground) >= 4.5, 'Save text contrast');
            assert(contrast(colors.ink, colors.card) >= 4.5, 'Primary field text contrast');
            assert(contrast(colors.muted, colors.card) >= 4.5, 'Secondary label contrast');
            assert(!colors.overflow, 'No horizontal overflow');
            const countBefore = await page.locator('#flight-form input').count();
            for (const tab of ['airports', 'tools', 'log']) await page.locator(`[data-flight-tab="${tab}"]`).click();
            assert.equal(await page.locator('#flight-form [name="flightNo"]').inputValue(), 'VN9999');
            assert.equal(await page.locator('#flight-form input').count(), countBefore, 'Theme does not rebuild controls');
            await page.locator('#flight-form [name="flightNo"]').focus();
            assert.equal(await page.locator('#flight-form [name="flightNo"]').evaluate(n => parseFloat(getComputedStyle(n).outlineWidth)), 2, 'Visible input focus remains');
            await page.locator('#flight-form [name="flightNo"]').blur();
            await page.screenshot({ path: path.join(out, `${name}-${width}-${theme}.png`) });
            report.checks.push({ name: `${name} ${width}px ${theme}`, colors });
          }
          assert.deepEqual(pageErrors, [], 'No browser runtime errors');
          await context.close();
        }
        // The final WebKit test stops the local server instead of using its broken
        // Playwright offline flag. An uncached API request proves network failure.
        const offlineContext = await browser.newContext();
        await offlineContext.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
        const offlinePage = await offlineContext.newPage();
        await offlinePage.goto(origin, { waitUntil: 'domcontentloaded' });
        await offlinePage.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
        const cacheState = await offlinePage.evaluate(async () => {
          const keys = await caches.keys();
          const shell = keys.find(k => k.startsWith('avilog-shell-') && k.includes('navy-teal'));
          const response = shell && await (await caches.open(shell)).match('/navy-teal.css');
          localStorage.setItem('theme-test-sentinel', 'keep');
          return { shell, cached: !!response };
        });
        assert(cacheState.cached, 'New stylesheet must be in the active offline shell');
        if (name === 'webkit') await stopServer();
        else await offlineContext.setOffline(true);
        const networkUnavailable = await offlinePage.evaluate(async () => {
          try { await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) }); return false; }
          catch { return true; }
        });
        assert(networkUnavailable, 'Uncached API must be unreachable in the offline test');
        await offlinePage.reload({ waitUntil: 'domcontentloaded' });
        // Imported styles can enter WebKit's CSSOM after DOMContentLoaded. Wait for readiness, then retain the exact color assertion.
        await offlinePage.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim() === 'avilog-shared-v1', null, { timeout: 10000 });
        assert.equal(await offlinePage.evaluate(() => localStorage.getItem('theme-test-sentinel')), 'keep');
        assert.equal(await offlinePage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#0f766e');
        report.checks.push({ name: `${name} offline stylesheet and local data`, method: name === 'webkit' ? 'local server stopped, uncached API rejected' : 'browser offline flag, uncached API rejected', cacheState });
        await offlineContext.close();
      } finally { await browser.close(); }
    }
  } catch (error) {
    report.errors.push(error.stack || String(error));
    process.exitCode = 1;
  } finally {
    report.passed = report.checks.length;
    await fs.writeFile(path.join(out, 'QA.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.map(c => c.name), errors: report.errors }, null, 2));
    await stopServer();
  }
})();
