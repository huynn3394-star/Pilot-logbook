// Open real collapsed controls without bypassing the UI handlers.
async function accountMenu(page){if(['/', '/atpl/', '/atpl/index.html'].includes(new URL(page.url()).pathname))await page.locator('[data-account-menu]').waitFor({state:'attached'});const menu=page.locator('[data-account-menu]');if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();}
async function weatherManage(page){const menu=page.locator('[data-weather-manage]');if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();}
module.exports={accountMenu,weatherManage};

async function pageManage(page){const menu=page.locator('[data-page-manage]');if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();}
async function settingsSection(page,index=0){const menu=page.locator('[data-settings-section]').nth(index);if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();}
async function libraryManage(page,code){for(const item of await page.locator('[data-card-manage][open]').all())await item.locator(':scope>summary').click();const menu=page.locator('[data-bank="'+code+'"] [data-card-manage]');if(await menu.count())await menu.locator(':scope>summary').click();}
async function bankManage(page){await page.locator('[data-bank-manage]').waitFor();const menu=page.locator('[data-bank-manage]');if(await menu.count()&&!await menu.evaluate(n=>n.open))await menu.locator(':scope>summary').click();}
Object.assign(module.exports,{pageManage,settingsSection,libraryManage,bankManage});

// Flight editor v12: operate the real tab/details controls before editing hidden fields.
async function flightTab(page,name='log'){const tab=page.locator('[data-flight-tab="'+name+'"]');if(await tab.count()&&await tab.getAttribute('aria-selected')!=='true')await tab.click();}
async function flightCrew(page){await flightTab(page,'log');const details=page.locator('[data-fe-crew-details]');if(await details.count()&&!await details.evaluate(n=>n.open))await details.locator(':scope>summary').click();}
async function flightScheduled(page){await flightTab(page,'log');const details=page.locator('[data-fe-scheduled]');if(await details.count()&&!await details.evaluate(n=>n.open))await details.locator(':scope>summary').click();}
Object.assign(module.exports,{flightTab,flightCrew,flightScheduled});
