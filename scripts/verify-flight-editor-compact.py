"""Regression test for the approved medium-density Flight Detail layout.

Run: python scripts/verify-flight-editor-compact.py
This verifies the real flight editor HTML and CSS in isolated Chromium. It does
not access a user account or make any network request.
"""
from pathlib import Path
import runpy
import os
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
helpers = runpy.run_path(str(HERE / 'verify-flight-editor.py'))
setup = helpers['setup']

MEASURE = """() => {
  const box = (q) => { const node = document.querySelector(q); const r = node.getBoundingClientRect(); return {top:r.top,height:r.height,bottom:r.bottom,width:r.width}; };
  const n = (q) => document.querySelector(q);
  const o = {
    header:box('#modal .modal-head'), tabs:box('#modal .fe-tabs'),
    overview:box('#modal .fe-overview'),route:box('#modal .fe-route-card'),
    scheduled:box('#modal .fe-scheduled'),
    save:box('#modal .fe-save'), back:box('#modal .fe-back'),
    nav:box('#modal .fe-tabs button'),
    clock:box('#modal .fe-time-cell input[data-utc-clock]'),
    form:box('#flight-form'),
    overflow:n('#flight-form').scrollWidth > n('#flight-form').clientWidth + 1,
  };
  o.gap=o.route.top-o.overview.bottom;
  return o;
}"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    checks=0
    try:
        for width, theme in [(320,'light'),(390,'light'),(390,'dark'),(430,'light'),(820,'light')]:
            page=browser.new_page()
            setup(page,width,theme)
            page.evaluate('testOpen()')
            m=page.evaluate(MEASURE)
            mobile=width<=430
            print(f'{width}px {theme}: header {m["header"]["height"]:.1f}px, tabs {m["tabs"]["height"]:.1f}px, overview {m["overview"]["height"]:.1f}px, route {m["route"]["height"]:.1f}px, gap {m["gap"]:.1f}px',flush=True)
            assert m['header']['height'] <= (62 if mobile else 75), 'Compact header must save vertical space'
            assert m['tabs']['height'] <= (50 if mobile else 53), 'Compact tabs must save vertical space'
            assert m['overview']['height'] <= (204 if mobile else 217), 'Overview fields should take less space'
            assert m['route']['height'] <= (360 if mobile else 375), 'Four actual clocks + dates need a denser grid'
            assert m['gap'] <= (10 if mobile else 12), 'Cards must be closer together'
            assert not m['overflow'], 'Form must not overflow horizontally'
            for k in ('back','save','nav'):
                assert m[k]['height']>=44, f'{k} must remain at least 44px for touch'
            assert m['clock']['height']>=40, 'Clock must remain easily editable'
            # Tabs remain interactive and can return to Log without losing values.
            page.locator('[name=flightNo]').fill('VN0506')
            page.locator('[data-flight-tab=tools]').click()
            page.locator('[data-flight-tab=log]').click()
            assert page.locator('[name=flightNo]').input_value()=='VN0506'
            checks+=1
            page.close()
        print('PASS: compact density + touch sizes + tab state on',checks,'layout variants')
    finally:
        browser.close()
