import {test} from 'node:test';import assert from 'node:assert/strict';
import * as client from '../public/atpl/firebase-client.js';
test('desktop-mode iPad uses redirect while a desktop Mac keeps popup',()=>{
 assert.equal(client.prefersRedirect?.({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',maxTouchPoints:5}),true);
 assert.equal(client.prefersRedirect({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:1}),true);
 assert.equal(client.prefersRedirect({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:0}),false);
 assert.equal(client.prefersRedirect({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',maxTouchPoints:5}),true);
});
