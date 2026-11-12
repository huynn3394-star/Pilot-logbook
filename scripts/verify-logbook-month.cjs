const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

async function withPage(browser, origin, timezoneId, check) {
  const context = await browser.newContext({ timezoneId, viewport: { width: 1100, height: 850 } });
  try {
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await check(page);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}

async function expectMonth(page, month) {
  await page.locator('[data-navy-month][value="' + month + '"]').waitFor();
  assert.equal(await page.locator('[data-navy-month]').inputValue(), month);
}

const navigate = (page, tab) => page.locator('.sidebar [data-tab="' + tab + '"]').click();
const monthButton = (page, action) => page.locator('[data-navy-logbook] [data-action="' + action + '"]');

async function checkManualSelection(page, origin) {
  // December in Vietnam, even though the UTC date is still in November.
  await page.clock.setFixedTime(new Date('2026-11-30T17:05:00Z'));
  await page.goto(origin + '/?tab=logbook');
  await expectMonth(page, '2026-12');
  await page.locator('.nv-empty').waitFor();

  await page.locator('[data-filter=search]').fill('VN0605');
  await monthButton(page, 'navy-filters').click();
  await page.locator('#modal [name=status]').selectOption('confirmed');
  await page.locator('[data-navy-filter-apply]').click();
  await monthButton(page, 'navy-period').click();
  await page.locator('[data-flight-card]').waitFor();
  assert.equal(await monthButton(page, 'navy-period').innerText(), 'This month');
  await monthButton(page, 'month-prev').click();
  await expectMonth(page, '2026-11');
  assert.equal(await monthButton(page, 'navy-period').innerText(), 'This month');

  await page.locator('[data-navy-month]').fill('2026-10');
  await expectMonth(page, '2026-10');
  assert.equal(await monthButton(page, 'navy-period').innerText(), 'All months');
  assert.equal(await page.locator('[data-filter=search]').inputValue(), 'VN0605');
  assert.equal(await page.locator('[data-flight-card]').count(), 1);
  await monthButton(page, 'month-next').click();
  await expectMonth(page, '2026-11');
  await page.locator('.nv-empty').waitFor();
  await monthButton(page, 'month-prev').click();
  await expectMonth(page, '2026-10');

  await page.clock.setFixedTime(new Date('2026-12-31T17:05:00Z'));
  await page.evaluate(() => dispatchEvent(new Event('focus')));
  await expectMonth(page, '2026-10');
  await navigate(page, 'schedule');
  await navigate(page, 'logbook');
  await expectMonth(page, '2026-10');
  assert.equal(await page.locator('[data-filter=search]').inputValue(), 'VN0605');
  await monthButton(page, 'navy-filters').click();
  assert.equal(await page.locator('#modal [name=status]').inputValue(), 'confirmed');
  await page.keyboard.press('Escape');
  await page.reload();
  await expectMonth(page, '2027-01');
}

async function checkAutomaticRollover(page, origin) {
  // Still December in Honolulu at this UTC timestamp in January.
  await page.clock.install({ time: new Date('2027-01-01T09:59:00Z') });
  await page.goto(origin + '/?tab=schedule');
  await page.locator('.w5-calendar-section > summary').click();
  await page.locator('[data-action=month-prev]').click();
  await navigate(page, 'logbook');
  await expectMonth(page, '2026-12');
  await page.locator('[data-filter=search]').fill('VN0605');
  await monthButton(page, 'navy-period').click();
  await page.locator('[data-flight-card]').waitFor();
  await page.clock.fastForward(70000);
  await expectMonth(page, '2027-01');
  assert.equal(await page.locator('[data-filter=search]').inputValue(), 'VN0605');
  assert.equal(await page.locator('[data-flight-card]').count(), 1);

  // A foreground event catches a calendar change while browser timers were suspended.
  await page.clock.setSystemTime(new Date('2027-02-01T10:01:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expectMonth(page, '2027-02');
  await monthButton(page, 'navy-period').click();
  await page.locator('.nv-empty').waitFor();
}

(async () => {
  const { createServer } = await import('../server.js');
  const server = createServer({
    firebaseConfig: { enabled: false },
    weather: { get: async station => ({ station, metar: null, taf: null }) },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [name, engine] of Object.entries({ chromium, webkit })) {
      const browser = await engine.launch({ headless: true });
      try {
        await withPage(browser, origin, 'Asia/Ho_Chi_Minh', page => checkManualSelection(page, origin));
        await withPage(browser, origin, 'Pacific/Honolulu', page => checkAutomaticRollover(page, origin));
        console.log('PASS ' + name + ' Logbook local month, rollover, manual selection and filters');
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
