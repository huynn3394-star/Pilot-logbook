const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

(async () => {
  const { createServer } = await import('../server.js');
  const { overnight, partial, simulator, waderCsv } = await import('../tests/fixtures/wader-csv.mjs');
  const csv = waderCsv([overnight, partial, simulator]);
  const server = createServer({ firebaseConfig: { enabled: false }, weather: { get: async () => ({}) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [name, engine] of Object.entries({ chromium, webkit })) {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        page.setDefaultTimeout(10000);
        await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
        await page.goto(origin + '/?tab=logbook');
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-revision').trim() === 'avilog-shared-v1');
        const file = page.locator('[data-wader-file]');
        const preview = page.locator('[data-wader-preview]');
        const save = page.locator('[data-wader-save]');
        const openImport = async () => {
          await page.getByRole('button', { name: 'Quản lý Logbook', exact: true }).click();
          const menuEntry = page.locator('#modal[open] [data-action=wader-csv]');
          await menuEntry.waitFor();
          assert.equal(await menuEntry.innerText(), 'Nhập Wader CSV');
          await menuEntry.click();
        };
        const upload = contents => file.setInputFiles({ name: 'synthetic-wader.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
        const read = () => page.evaluate(async () => (await import('/lib/storage.js')).readState());
        await openImport();
        const initial = await read();
        await upload('flightNumber,totalTime\nZZ123,75');
        await page.getByRole('alert').filter({ hasText: 'Thiếu cột' }).waitFor();
        await upload(csv);
        await preview.getByText('2 chuyến bay · 1 simulator · 02:30 Block').waitFor();
        assert.match(await preview.innerText(), /1 chuyến thiếu OFF hoặc ON/);
        assert.match(await preview.innerText(), /00:55 \+1d/);
        assert.equal(await save.isDisabled(), true);
        assert.deepEqual(await read(), initial, 'preview is read-only');
        // Another local writer saves while the import dialog is open.
        await page.evaluate(async () => {
          const { updateState } = await import('/lib/storage.js');
          await updateState(state => ({ ...state, settings: { ...state.settings, name: 'Concurrent fixture' } }));
        });
        await page.locator('[data-wader-confirm]').check();
        await save.click();
        await page.locator('#modal').waitFor({ state: 'hidden' });
        const saved = await read();
        const imported = saved.flights.filter(flight => flight.source === 'Wader CSV');
        assert.equal(saved.settings.name, 'Concurrent fixture');
        assert.equal(imported.length, 2);
        assert.equal(saved.flights.length, initial.flights.length + 2);
        assert.equal(saved.duties.length, initial.duties.length + 1);
        const withoutNumber = imported.find(flight => !flight.flightNo);
        assert.equal(withoutNumber.actual.off, undefined);
        assert.equal(withoutNumber.actual.on, undefined);
        assert.equal(withoutNumber.confirmed, true);
        await page.locator('.nv-flight-open[data-id="' + withoutNumber.id + '"]').click();
        assert.equal(await page.locator('#flight-form [name=flightNo]').inputValue(), '');
        assert.equal(await page.locator('#flight-form [name=a_off]').inputValue(), '');
        assert.equal(await page.locator('.fe-save').isEnabled(), true);
        await page.keyboard.press('Escape');
        await page.locator('#modal').waitFor({ state: 'hidden' });
        await openImport();
        await upload(csv);
        await preview.getByText('3 bản ghi trùng được bỏ qua.').waitFor();
        assert.equal(await save.isDisabled(), true);
        assert.deepEqual(await read(), saved);
        assert.deepEqual(errors, []);
        console.log('PASS ' + name + ' Wader CSV preview, reviewed import, and duplicate protection');
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
