import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {questionList,questionRow} from '../public/atpl/quick-review.js';

test('quick review includes every usable question and bolds the original key across all banks',async()=>{
 const catalog=JSON.parse(await readFile('public/atpl/catalog.json','utf8'));
 for(const bank of catalog.banks){
  const html=await readFile('public'+bank.url,'utf8');
  const data=JSON.parse(html.match(/id="bank-data"[^>]*>(.*?)<\/script>/s)[1])[bank.code];
  const before=JSON.stringify(data),questions=questionList(data.questions);
  assert.equal(questions.length,bank.count,bank.code);
  for(const q of questions){
   const row=questionRow(q);
   assert.equal((row.match(/<strong>/g)||[]).length,1,q.uid);
   assert(row.includes(`<strong><span class="quick-review-letter">${q.answer}.</span>`),q.uid);
  }
  const first=questions[0];
  assert(questionList(data.questions,{search:first.uid}).some(q=>q.id===first.id));
  if(first.topic)assert(questionList(data.questions,{topic:first.topic}).every(q=>q.topic===first.topic));
  assert.equal(questionList(data.questions,{search:'no-such-question-xyz98765'}).length,0);
  assert.equal(JSON.stringify(data),before,'review does not mutate '+bank.code);
 }
});
