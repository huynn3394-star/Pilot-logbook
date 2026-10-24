"""Isolated browser component tests for AviLog Flight editor V14 (V13 regression suite).

Requires: Python + playwright, and Chromium (CHROMIUM_PATH can override).
Run: python scripts/verify-flight-editor.py

The sandbox blocks navigation, including localhost. This harness mounts the real
editor CSS/JS in an empty Chromium document, with in-memory state/commit adapters.
It executes the production editFlight/saveFlight functions unchanged. It is NOT
an end-to-end app, Firebase, service-worker or physical iPhone/iPad test.
No network request, credential, cloud data or production endpoint is used.
"""
import json
import os
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results' / 'flight-editor'
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []


def bundle_for_dom():
    """Wrap shipped ES modules in local scopes; transform import/export only."""
    sources = {}
    order = []
    pattern = re.compile(r'import\s*\{([\s\S]*?)\}\s*from\s*[\'"]([^\'"]+)[\'"]\s*;')

    def visit(rel):
        if rel in sources:
            return
        source = (ROOT / 'public' / rel).read_text()
        sources[rel] = source
        for match in pattern.finditer(source):
            child = str((ROOT / 'public' / rel).parent.joinpath(match.group(2)).resolve().relative_to(ROOT / 'public'))
            visit(child)
        order.append(rel)

    for rel in ['lib/flight-editor.js', 'lib/crew-entry.js', 'lib/sample.js']:
        visit(rel)
    output = ['window.__avilogModules = {};']
    for rel in order:
        source = sources[rel]
        exports = re.findall(r'export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)', source)

        def imports(match):
            child = str((ROOT / 'public' / rel).parent.joinpath(match.group(2)).resolve().relative_to(ROOT / 'public'))
            names = re.sub(r'\s+as\s+', ':', match.group(1))
            return 'const {' + names + '} = window.__avilogModules[' + json.dumps(child) + '];'

        source = pattern.sub(imports, source)
        source = re.sub(r'\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)', '', source)
        output.append('window.__avilogModules[' + json.dumps(rel) + '] = (() => {\n' + source + '\nreturn {' + ','.join(exports) + '};\n})();')
    return '\n'.join(output)


def harness():
    app = (ROOT / 'public/app.js').read_text()
    def part(start, end):
        return app[app.index(start):app.index(end)]
    return r'''
// The opaque test document lacks randomUUID; use the browser's CSPRNG for test IDs.
if(!crypto.randomUUID)crypto.randomUUID=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
const {uid,minutes,duration,flightKey,validateFlight}=__avilogModules['lib/domain.js'];
const {todayInputDate,readUTCInput,bindUTCInputs}=__avilogModules['lib/utc-input.js'];
const {renderFlightEditor,mountFlightEditor,updateFlightEditor}=__avilogModules['lib/flight-editor.js'];
const {mountCrewEntry,resolveFlightPeople}=__avilogModules['lib/crew-entry.js'];
const {sampleState}=__avilogModules['lib/sample.js'];
const {lookupFlights,normalizeFlightCode,prepareScanDraft,scanComparison}=__avilogModules['lib/flight-assist.js'];
const {mountFlightAssist}=__avilogModules['lib/flight-v14-ui.js'];
const {readLogbookFields,timeTotals}=__avilogModules['lib/flight-times.js'];
const {requiresFinalPermission,recordFlightRevision,evidenceFingerprint}=__avilogModules['lib/flight-audit.js'];
const account={config:{logbookV14Enabled:true}};const toast=()=>{};
const modal=document.querySelector('#modal');
let state=sampleState(),formDirty=false,month='2026-10',day='2026-10-09';
const workspaceSession={captureForm:()=>({base:structuredClone(state)}),loadEvidence:async()=>null};
const find=id=>state.flights.find(f=>f.id===id);
const render=()=>{};
const asyncCapture=()=>({});const assertAsync=()=>{};
const asDataURL=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
const btn=(action,text,ico,cls='',extra='')=>`<button type="button" data-action="${action}" ${extra}>${text}</button>`;
async function commit(next,message,options){state=structuredClone(next);window.lastSaveOptions=options;window.saveCount=(window.saveCount||0)+1;}
function error(message){const t=modal.querySelector('[data-error]');t.textContent=message;t.hidden=false;t.scrollIntoView({block:'nearest'});t.focus({preventScroll:true});}
''' + part('const paths = {', 'const app = document.querySelector') + \
        part('function openModal(', 'const input = ') + \
        part('function editFlight(', 'function importRoster()') + r'''
modal.addEventListener('close',()=>{if(modal.open)return;modal._flightEditor?.dispose();modal._flightEditor=null;});
document.addEventListener('click',event=>{if(event.target.closest('[data-action="close"]'))modal.close();});
window.testOpen=(id='demo-605',imported=null,warning='',scan=null)=>editFlight(id?find(id):null,imported,warning,scan);
window.testState=()=>structuredClone(state);
window.testSetState=value=>{state=structuredClone(value);};
window.testClose=()=>modal.close();
'''


def setup(page, width, theme='light'):
    css = (ROOT / 'public/style.css').read_text()
    css = re.sub(r'@import\s+url\([^)]*\);', '', css)
    page.set_viewport_size({'width': width, 'height': 844 if width < 721 else 1000})
    page.set_content('<!doctype html><html data-theme="' + theme + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head><body><dialog id="modal"></dialog></body></html>')
    # SHA-256 adapter only for the opaque test page; real production uses WebCrypto.
    # No browser policy is disabled. Native hashing is independently tested in Node.
    import hashlib
    page.expose_function('__qaSHA256',lambda data:list(hashlib.sha256(bytes(data)).digest()))
    page.add_script_tag(content="if(!crypto.subtle)Object.defineProperty(crypto,'subtle',{value:{digest:async(name,data)=>new Uint8Array(await __qaSHA256(Array.from(new Uint8Array(data.buffer||data)))).buffer}});")
    page.add_script_tag(content=bundle_for_dom())
    page.add_script_tag(content=harness())


def tab(page, name):
    page.locator(f'[data-flight-tab="{name}"]').click()


def field(page, name, value):
    page.locator(f'[name="{name}"]').fill(value)


def save(page):
    page.locator('[type=submit][form=flight-form]').click()


def check(name, assertion):
    assert assertion, name
    RESULTS.append(name)
    print('PASS:', name, flush=True)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        try:
            page = browser.new_page()
            page.set_default_timeout(5000)
            errors=[]
            page.on('pageerror',lambda exc:errors.append(str(exc)))
            setup(page,390)
            page.evaluate("()=>{const s=testState();s.flights.find(f=>f.id==='demo-605').actual.out='2026-10-06T04:29:17.123Z';testSetState(s);testOpen();}")
            form=page.locator('#flight-form')
            check('Three accessible tabs and one Save button',page.locator('[role=tab][data-flight-tab]').count()==3 and page.locator('[type=submit][form=flight-form]').count()==1)
            check('Existing confirmed flight opens with exact actuals',page.locator('[name=a_out]').input_value()=='04:29')
            old=page.evaluate('testState().flights.find(f=>f.id==="demo-605")')
            field(page,'note','Tab switching keeps this draft')
            tab(page,'airports')
            check('Airports reflects the current operational route',page.locator('[data-fe-icao=dep]').inner_text()=='VVTS')
            tab(page,'tools');tab(page,'log')
            check('Changing tabs preserves fields and does not save',page.locator('[name=note]').input_value()=='Tab switching keeps this draft' and page.evaluate('window.saveCount||0')==0)
            save(page);page.wait_for_function('!document.querySelector("#modal").open')
            after=page.evaluate('testState().flights.find(f=>f.id==="demo-605")')
            check('Note-only save preserves confirmed Actual and Scheduled',after['actual']==old['actual'] and after['scheduled']['out']==old['scheduled']['out'] and after['confirmed'])
            page.evaluate('testOpen()');field(page,'a_out','04:28');save(page)
            check('Changing confirmed Actual is blocked without permission',page.locator('#modal').evaluate('(n)=>n.open') and 'bảo vệ' in page.locator('[data-error]').inner_text())
            tab(page,'tools');page.locator('[name=replaceConfirmed]').check();field(page,'revisionReason','Đối chiếu Actual theo ảnh');save(page)
            page.wait_for_function('!document.querySelector("#modal").open')
            check('Explicit replacement uses the existing save permission',page.evaluate('lastSaveOptions.confirmActualReplacement') is True and page.evaluate('testState().flights.find(f=>f.id==="demo-605").actual.out').startswith('2026-10-06T04:28'))
            # Evidence uses the original FileReader/save path; test image has no personal data.
            page.evaluate('testOpen()');tab(page,'tools')
            import base64
            image_bytes=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlN4AAAAASUVORK5CYII=')
            page.locator('[name=evidence]').set_input_files({'name':'test.png','mimeType':'image/png','buffer':image_bytes})
            page.locator('[name=replaceConfirmed]').check();field(page,'revisionReason','Bổ sung ảnh minh chứng')
            save(page);page.wait_for_function('!document.querySelector("#modal").open')
            check('Tools photo attachment follows the existing save handler',page.evaluate('testState().flights.find(f=>f.id==="demo-605").attachment.startsWith("data:image/png;base64,")'))
            page.evaluate('testOpen()');tab(page,'tools')
            check('Existing photo is shown once with one removal control',page.locator('[data-flight-evidence] img').count()==1 and page.locator('[name=removeAttachment]').count()==1)
            page.locator('[name=removeAttachment]').check();page.locator('[name=replaceConfirmed]').check();field(page,'revisionReason','Bỏ ảnh theo kiểm thử');save(page);page.wait_for_function('!document.querySelector("#modal").open')
            check('Removing evidence does not change confirmed times',page.evaluate('!testState().flights.find(f=>f.id==="demo-605").attachment') and page.evaluate('testState().flights.find(f=>f.id==="demo-605").actual.out').startswith('2026-10-06T04:28'))
            # New flight, numeric clocks, explicit midnight dates and original crew creation.
            page.evaluate('testOpen(null)');field(page,'flightNo','VN9988');field(page,'dep','HAN');field(page,'dest','CAN');field(page,'date','2026-10-22')
            for k,d,t in [('a_out','2026-10-22','2355'),('a_off','2026-10-23','0005'),('a_on','2026-10-23','0055'),('a_in','2026-10-23','0107')]:
                field(page,k+'_date',d);field(page,k,t);page.locator(f'[name={k}]').blur()
            check('Midnight summary is 01:12 block and 00:50 airborne',page.locator('[data-fe-total=block]').inner_text()=='01:12' and page.locator('[data-fe-total=airborne]').inner_text()=='00:50')
            page.locator('[data-fe-crew-details]').evaluate('(n)=>n.open=true')
            field(page,'captainId','Captain New Test');field(page,'foId','Tôi')
            tab(page,'tools');page.locator('[name=confirmed]').check();save(page)
            page.wait_for_function('!document.querySelector("#modal").open')
            new=page.evaluate('testState().flights.find(f=>f.flightNo==="VN9988")')
            check('New confirmed flight saves explicit UTC dates',new['actual']['out']=='2026-10-22T23:55:00.000Z' and new['actual']['in']=='2026-10-23T01:07:00.000Z')
            check('Crew is created by the original save handler',bool(new['captainId']) and new['foId']=='self' and len(page.evaluate('testState().people.filter(p=>p.name==="Captain New Test")'))==1)
            page.evaluate('testOpen(null)');field(page,'flightNo','VN9999');field(page,'dest','CAN')
            tab(page,'tools');page.locator('[name=confirmed]').check();save(page)
            check('Missing Actual cannot be confirmed from Tools','Cần đủ OUT/OFF/ON/IN' in page.locator('[data-error]').inner_text())
            page.evaluate('testClose()');page.wait_for_function('!document.querySelector("#modal").open')
            page.evaluate('()=>{testOpen(null);testClose();testOpen(null);}')
            page.wait_for_timeout(60);tab(page,'tools')
            check('A delayed close event cannot dispose a newly opened editor',page.locator('#modal').evaluate('(n)=>n.classList.contains("flight-editor-modal")') and page.locator('[data-flight-tab=tools]').get_attribute('aria-selected')=='true')
            page.evaluate('testClose()');page.wait_for_function('!document.querySelector("#modal").open')
            # HTML validation must reveal a hidden required field's tab.
            page.evaluate('testOpen(null)');tab(page,'tools');save(page)
            check('Native validation reveals Log for an empty flight number',page.locator('[data-flight-tab=log]').get_attribute('aria-selected')=='true')
            field(page,'flightNo','VN7777');field(page,'dest','CAN');field(page,'a_out','2400');page.locator('[name=a_out]').blur();tab(page,'tools');save(page)
            check('Invalid 2400 remains rejected and its tab is shown',page.locator('[data-flight-tab=log]').get_attribute('aria-selected')=='true' and page.locator('[name=a_out]').evaluate('(n)=>!n.validity.valid'))
            tab(page,'tools');field(page,'confidence','101');save(page)
            check('Multiple invalid fields reveal the first invalid field, not the last panel',page.locator('[data-flight-tab=log]').get_attribute('aria-selected')=='true')
            # Roving tabs: arrows/Home/End work without losing field values.
            page.locator('[data-flight-tab=log]').focus();page.keyboard.press('ArrowRight')
            check('Keyboard navigation activates Airports',page.locator('[data-flight-tab=airports]').get_attribute('aria-selected')=='true')
            page.keyboard.press('End');check('Keyboard End activates Tools',page.locator('[data-flight-tab=tools]').get_attribute('aria-selected')=='true')
            # OCR review uses the real sample parser output, without invoking an OCR engine.
            page.evaluate('testClose()');page.wait_for_function('!document.querySelector("#modal").open')
            page.evaluate('''()=>{const m=__avilogModules;const scan=m['lib/parsers.js'].parseAircraft(m['lib/sample.js'].sampleAOC,'A320','2026-10-22');testOpen(null,scan,'Kiểm tra từng trường từ ảnh.');}''')
            check('OCR review warning remains visible',page.locator('[data-ocr-review]').is_visible())
            tab(page,'tools');check('OCR review is never automatically confirmed',not page.locator('[name=confirmed]').is_checked())
            # Multi-size layout of the actual editor; no mock UI or real personal data.
            sample={**old,'id':'preview-506','flightNo':'VN0506','date':'2026-10-22','dep':'HAN','dest':'CAN','reg':'VN-A603','source':'AOC FLT LOG · dữ liệu mẫu','note':'Dữ liệu minh họa bố cục; không kết nối tài khoản thật.','picMinutes':0,'nightMinutes':0,'confirmed':True,
                    'actual':{'out':'2026-10-22T06:00:00.000Z','off':'2026-10-22T06:13:00.000Z','on':'2026-10-22T07:35:00.000Z','in':'2026-10-22T07:58:00.000Z'},'scheduled':{}}
            for width in (320,390,430,820,1440):
                for theme in ('light','dark'):
                    p=browser.new_page();setup(p,width,theme)
                    p.evaluate('(f)=>{const s=testState();s.flights=[f];testSetState(s);testOpen(f.id);}',sample)
                    for section in ('log','airports','tools'):
                        tab(p,section)
                        check(f'{width}px {theme} {section}: no horizontal overflow',p.locator('#modal').evaluate('(n)=>n.scrollWidth<=n.clientWidth+1') and p.locator('#flight-form').evaluate('(n)=>n.scrollWidth<=n.clientWidth+1'))
                        if width in (390,820) and (section=='log' or width==390 and theme=='dark'):
                            p.screenshot(path=str(OUT/f'flight-{width}-{theme}-{section}.png'))
                    if width==390 and theme=='dark':
                        tab(p,'log');p.locator('#actual-summary').scroll_into_view_if_needed();p.screenshot(path=str(OUT/'flight-390-dark-summary.png'))
                    p.close()
            check('No uncaught JavaScript errors in component interactions',not errors)
            (OUT/'browser-qa.json').write_text(json.dumps({'scope':'Isolated Chromium DOM component, original editFlight/saveFlight functions; in-memory commit. No Firebase/OAuth/SW/E2E/device validation.', 'checks':RESULTS,'passed':len(RESULTS),'pageErrors':errors},ensure_ascii=False,indent=2))
            print('COMPONENT CHECKS PASSED:',len(RESULTS))
        except Exception:
            print('EDITOR ERROR:',page.locator('[data-error]').all_text_contents(),flush=True)
            page.screenshot(path=str(OUT/'failure.png'))
            raise
        finally:
            browser.close()

if __name__=='__main__':
    main()
