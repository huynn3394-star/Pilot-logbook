import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {navigationItems,destinationURL,renderNavigation,renderBottomNavigation} from '../public/ui/navigation.js';
test('main and study navigation use one destination list and validated return URLs',()=>{
 assert.equal(navigationItems.length,7);assert.equal(destinationURL('atpl'),'/atpl/');assert.equal(destinationURL('logbook'),'/?tab=logbook');assert.throws(()=>destinationURL('https://other.test'));
 const links=renderNavigation({active:'atpl',links:true}),buttons=renderNavigation({active:'logbook'});
 for(const [id]of navigationItems){assert(links.includes('data-tab="'+id+'"'));assert(buttons.includes('data-tab="'+id+'"'));}
 assert.match(links,/data-tab="atpl"[^>]*aria-current="page"/);assert.match(buttons,/data-action="tab"/);
 assert.match(renderBottomNavigation({active:'atpl',links:true}),/data-study-more/);assert.match(renderBottomNavigation({active:'atpl',links:true}),/compose=flight/);
});
test('study frame adapters preserve the existing quiz/store ownership and source banks',async()=>{
 const shell=await readFile('public/ui/study-shell.js','utf8'),bridge=await readFile('public/atpl/bank-bridge.js','utf8');
 assert.doesNotMatch(shell,/localStorage\.setItem|indexedDB|openWorkspaceSession|innerHTML\s*=.*bank-data/);
 assert.match(bridge,/setupAccountUI\(\{element:studyShell.accountElement,bankStore\}\)/);
 const worker=await readFile('public/sw.js','utf8');for(const name of ['navigation.js','study-shell.js','study-shell.css'])assert(worker.includes('"/ui/'+name+'"'));
});
