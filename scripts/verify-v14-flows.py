"""V14 isolated DOM component flows; no cloud, real-device or OCR-engine claim.
Reuses original renderer, editFlight and saveFlight. Storage is in-memory only.
"""
import importlib.util,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('editorqa',ROOT/'scripts/verify-flight-editor.py')
qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)
OUT=ROOT/'test-results/v14';OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,value):
    assert value,name
    checks.append(name);print('PASS:',name,flush=True)
def err(p): return p.locator('[data-error]').inner_text()
def reset(p,extra=''):
    p.evaluate("""()=>{testClose();state=sampleState();state.demo=false;workspaceSession.uid=null;account.config.logbookV14Enabled=true;window.saveCount=0;"""+extra+"}")
def blur(p,name,value):
    qa.field(p,name,value);p.locator(f'[name="{name}"]').dispatch_event('change')
def confirmed(p):
    qa.tab(p,'tools');p.locator('[name=confirmed]').check()
def reason(p,text):
    qa.tab(p,'tools');p.locator('[name=replaceConfirmed]').check();qa.field(p,'revisionReason',text)
def save_wait(p):
    qa.save(p);p.wait_for_function('!document.querySelector("#modal").open')

def main():
  with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    p=b.new_page();p.set_default_timeout(5000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));qa.setup(p,390)
    # Exact match automatically opens existing record, without changing storage.
    reset(p,"testOpen(null);")
    blur(p,'date','2026-10-06');blur(p,'flightNo','HVN605')
    check('Same-day VN/HVN alias opens existing flight, never creates a duplicate',p.locator('#flight-form').get_attribute('data-id')=='demo-605' and p.evaluate('saveCount')==0)
    check('Existing exact-match registration is retained',p.locator('[name=reg]').input_value()==p.evaluate('testState().flights.find(f=>f.id==="demo-605").reg||""'))
    # Choosing a suggested crew emits input on the form, not a named input.
    reset(p,"testOpen(null);")
    blur(p,'date','2026-10-06')
    p.locator('[data-fe-crew-details] > summary').click()
    p.locator('[data-person-input=captain]').focus()
    p.locator('#crew-options-captain [data-choice]').filter(has_text='Captain Demo').click()
    blur(p,'flightNo','VN605')
    check('Crew suggestion selection prevents automatic discard by matching-flight lookup',p.locator('#flight-form').get_attribute('data-id')!='demo-605' and p.locator('[data-person-input=captain]').input_value()=='Captain Demo')
    # Other-day history offers only route.
    reset(p,"testOpen(null);")
    blur(p,'date','2026-10-24');blur(p,'flightNo','VN605')
    check('Historical route is a labelled suggestion, never automatically selected','lịch sử' in p.locator('[data-flight-autofill]').inner_text() and p.locator('[name=dest]').input_value()=='')
    p.locator('[data-assist-index="0"]').click()
    check('History suggestion fills DEP/DEST only',p.locator('[name=dep]').input_value()=='SGN' and p.locator('[name=dest]').input_value()=='BKK' and p.locator('[name=reg]').input_value()=='' and p.locator('[name=a_out]').input_value()=='')
    # Dirty input: no automatic discard when an exact matching code is entered.
    reset(p,"testOpen(null);")
    blur(p,'date','2026-10-06');qa.field(p,'reg','VN-USER');blur(p,'flightNo','VN605')
    check('Exact-match lookup does not discard an edited new-flight form',p.locator('#flight-form').get_attribute('data-id')!='demo-605' and p.locator('[name=reg]').input_value()=='VN-USER')
    p.once('dialog',lambda d:d.dismiss());p.locator('[data-assist-index="0"]').click()
    check('Declining open-existing preserves unsaved user fields',p.locator('[name=reg]').input_value()=='VN-USER')
    p.once('dialog',lambda d:d.accept());p.locator('[data-assist-index="0"]').click()
    check('Explicit discard/open navigates to existing record',p.locator('#flight-form').get_attribute('data-id')=='demo-605')
    reset(p,"const f=structuredClone(state.flights.find(f=>f.id==='demo-605'));f.id='qa-second';f.flightNo='HVN605';f.dest='HAN';state.flights.push(f);testOpen(null);")
    blur(p,'date','2026-10-06');blur(p,'flightNo','VN605')
    check('Ambiguous same-day records require a selection',p.locator('[data-assist-index]').count()==2 and p.locator('#flight-form').get_attribute('data-id') not in ['demo-605','qa-second'])
    p.locator('[data-assist-index="1"]').click()
    check('Chosen ambiguous record keeps its own identity and route',p.locator('#flight-form').get_attribute('data-id')=='qa-second' and p.locator('[name=dest]').input_value()=='HAN')
    # First FINAL with blank explicit categories => unknown SIC, not inferred PM.
    reset(p,"testOpen(null);")
    blur(p,'date','2026-10-24');blur(p,'flightNo','QA101');qa.field(p,'dep','HAN');qa.field(p,'dest','CAN')
    for name,clock in [('out','0600'),('off','0613'),('on','0735'),('in','0758')]:
      qa.field(p,'a_'+name,clock);qa.field(p,'a_'+name+'_date','2026-10-24')
    # Date control names come from original utc-input helper.
    p.locator('[data-v14-times] > summary').click()
    check('Extended categories initially blank instead of inferred zero',p.locator('[name=log_sicMinutes]').input_value()=='' and p.locator('[name=log_instrumentMinutes]').input_value()=='')
    qa.field(p,'log_ifrMinutes','118');qa.field(p,'log_instrumentMinutes','83');confirmed(p);qa.save(p)
    check('Instrument greater than 82 minutes airborne is rejected',p.locator('#modal').evaluate('(n)=>n.open') and 'Airborne' in err(p))
    qa.tab(p,'log');qa.field(p,'log_instrumentMinutes','40');qa.field(p,'log_takeoffDay','1');qa.field(p,'log_landingNight','0');save_wait(p)
    f=p.evaluate('testState().flights.find(f=>f.flightNo==="QA101")')
    check('Confirmed save persists exact UTC times and manual categories',f['actual']['off'].startswith('2026-10-24T06:13:') and f['logbook']['instrumentMinutes']==40 and f['logbook']['landingNight']==0)
    check('Blank SIC remains unknown and never copied from PF/PM','sicMinutes' not in f['logbook'])
    check('First confirmation creates an audit entry',len(f['auditTrail']['entries'])==1 and f['auditTrail']['entries'][0]['action']=='confirmed')
    ident=f['id'];p.evaluate('(id)=>testOpen(id)',ident);qa.field(p,'note','Ghi chú sau FINAL');save_wait(p)
    f=p.evaluate('(id)=>testState().flights.find(f=>f.id===id)',ident)
    check('Note-only FINAL edit retains timestamps and appends history',len(f['auditTrail']['entries'])==2 and f['actual']['off'].startswith('2026-10-24T06:13:'))
    p.evaluate('(id)=>testOpen(id)',ident);qa.field(p,'flightNo','QA102');qa.save(p)
    check('Changing FINAL identity requires explicit permission','bảo vệ' in err(p))
    reason(p,'');qa.save(p)
    check('Permission alone cannot revise FINAL without a reason','lý do' in err(p))
    qa.field(p,'revisionReason','Sửa số hiệu theo lịch đã kiểm tra');save_wait(p)
    f=p.evaluate('(id)=>testState().flights.find(f=>f.id===id)',ident)
    check('Reasoned revision preserves old and new flight number',f['flightNo']=='QA102' and f['auditTrail']['entries'][-1]['before']['flightNo']=='QA101' and f['auditTrail']['entries'][-1]['after']['flightNo']=='QA102')
    p.evaluate('(id)=>testOpen(id)',ident);qa.tab(p,'tools');p.locator('[data-audit-trail] > summary').click()
    check('Audit history is available inside Tools',p.locator('.fe-audit-entry').count()==3)
    p.screenshot(path=str(OUT/'phone-v14-history.png'))
    # Raw OCR result is independent of old record, with one unread event.
    reset(p,"""const old=state.flights.find(f=>f.id==='demo-605');const scan={flightNo:'HVN605',date:old.date,dep:'VVTS',dest:'VTBS',aircraft:'A321',actual:{out:'2026-10-06T04:28:00.000Z',off:old.actual.off,in:old.actual.in},source:'OCR',confidence:80};const imported=prepareScanDraft(old,scan);imported.source='OCR + giữ ON cũ';testOpen(old.id,imported,'Kiểm tra ON giữ lại từ bản cũ',scan);""")
    check('Scan comparison displays changes and unread values',p.locator('[data-scan-state=different]').count()==1 and p.locator('[data-scan-state=missing]').count()==1)
    qa.tab(p,'tools')
    check('Scan opens as a draft even when source was FINAL',not p.locator('[name=confirmed]').is_checked())
    p.locator('[name=confirmed]').check();qa.save(p)
    check('FINAL from scan is blocked until all retained fields are reviewed','đối chiếu' in err(p))
    p.locator('[name=scanReviewed]').check();reason(p,'Đối chiếu ảnh và ON trên máy bay');save_wait(p)
    f=p.evaluate('testState().flights.find(f=>f.id==="demo-605")')
    check('Reviewed scan updates existing flight without duplicate',p.evaluate('testState().flights.filter(f=>f.id==="demo-605").length')==1 and f['actual']['out'].startswith('2026-10-06T04:28:') and f['actual']['on'].startswith('2026-10-06T05:50:'))
    check('Reviewed scan revision records a reason and before/after',f['auditTrail']['entries'][-1]['reason']=='Đối chiếu ảnh và ON trên máy bay')
    # Capability off: legacy UI editable; extended records visible but blocked from saving.
    reset(p,"workspaceSession.uid='qa';account.config.logbookV14Enabled=false;testOpen(null);")
    check('Cloud capability off displays compatibility notice and no new time inputs',p.locator('[data-v14-gate]').count()==1 and p.locator('[name=log_sicMinutes]').count()==0)
    reset(p,"workspaceSession.uid='qa';account.config.logbookV14Enabled=false;state.flights[1].logbook={version:1,sicMinutes:91};testOpen(state.flights[1].id);")
    qa.field(p,'note','Không được ghi đè');qa.save(p)
    check('Capability off never strips existing extended records','chỉ đọc' in err(p) and p.evaluate('saveCount')==0)
    # Expanded new sections do not overflow at small widths in both themes.
    for width in [320,390,430,820]:
      for theme in ['light','dark']:
        reset(p,"testOpen('demo-605');")
        p.set_viewport_size({'width':width,'height':844});p.evaluate('(v)=>document.documentElement.dataset.theme=v',theme)
        p.locator('[data-v14-times] > summary').click()
        check(f'Expanded manual time fields fit {width}px {theme}',p.locator('#flight-form').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
    reset(p,"const old=state.flights.find(f=>f.id==='demo-605');const scan={...structuredClone(old),actual:{...old.actual,out:'2026-10-06T04:28:00.000Z'}};delete scan.actual.on;testOpen(old.id,prepareScanDraft(old,scan),'ON chưa đọc: cần kiểm tra giá trị cũ',scan);")
    p.set_viewport_size({'width':390,'height':844});p.evaluate('document.documentElement.dataset.theme="light"')
    p.screenshot(path=str(OUT/'phone-v14-scan-review.png'))
    check('Scan comparison fits phone without horizontal overflow',p.locator('#flight-form').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'))
    reset(p,"testOpen('demo-605');");p.locator('[data-v14-times] > summary').click();p.locator('[data-v14-times]').scroll_into_view_if_needed()
    p.screenshot(path=str(OUT/'phone-v14-time-fields.png'))
    reset(p,"testOpen(null);");blur(p,'date','2026-10-24');blur(p,'flightNo','VN605');p.screenshot(path=str(OUT/'phone-v14-autofill.png'))
    check('No unhandled JavaScript errors in V14 interactions',not errors)
    report={'scope':'Isolated Chromium component; actual editor/save functions with in-memory persistence. Not real cloud, full app, OCR engine or physical iOS.','passed':len(checks),'checks':checks,'pageErrors':errors}
    (OUT/'browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
    print('V14 component checks:',len(checks))
if __name__=='__main__': main()
