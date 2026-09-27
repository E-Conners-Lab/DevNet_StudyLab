import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrompt, redactPrompt, askTutor, tutorConfiguration } from '../tutor.mjs';
import { equalSecret, HttpError } from '../http.mjs';
const env={TUTOR_MODEL:'test-model',TUTOR_ANTHROPIC_KEY:'test-key'};
const question={messages:[{role:'user',content:'What is HTTP?'}]};
test('long provider answers remain valid conversation history with a visible limit notice',async()=>{
 const answer=await askTutor(validatePrompt(question),{env,fetchImpl:async()=>Response.json({content:[{type:'text',text:'x'.repeat(5000)}]})});
 assert.ok(answer.length<=4000);
 assert.match(answer,/Response shortened/);
 assert.doesNotThrow(()=>validatePrompt({messages:[...question.messages,{role:'assistant',content:answer},{role:'user',content:'Explain further.'}]}));
});
test('prompt boundary rejects schema, role, domain and length abuse',()=>{
 for(const body of [null,[],{}, {...question,extra:true},{...question,domain:'wrong'},{messages:[{role:'assistant',content:'hi'}]},{messages:[{role:'user',content:' '}]},{messages:Array.from({length:21},()=>({role:'user',content:'x'}))},{messages:Array.from({length:5},()=>({role:'user',content:'x'.repeat(4000)}))}])assert.throws(()=>validatePrompt(body),HttpError);
 const valid=validatePrompt(question);assert.equal(valid.domain,null);assert.match(valid.messages[0].content,/<<STUDY_CONTENT>>/);
 assert.equal(equalSecret(null,'test'),false);assert.equal(equalSecret('short','longer'),false);assert.equal(equalSecret('match','match'),true);
});
test('redacts recognizable credentials and email before vendor context',()=>{
 const text=redactPrompt('email user@example.invalid password=private sk-ant-fakefixture ABC -----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----');
 assert.ok(!text.includes('user@example'));assert.ok(!text.includes('private '));assert.ok(!text.includes('fakefixture'));assert.ok(!text.includes('\nsecret\n'));
 assert.equal(tutorConfiguration({}).configured,false);
});
test('malformed/oversized vendor bodies and transport failures stay generic',async()=>{
 for(const fetchImpl of [async()=>{throw Error('PRIVATE');},async()=>new Response('bad'),async()=>Response.json({foo:'PRIVATE'}),async()=>Response.json({content:[]}),async()=>new Response('x'.repeat(131073)),async()=>new Response('x',{headers:{'content-length':'200000'}}),async()=>new Response(null)]){
 await assert.rejects(askTutor(validatePrompt(question),{env,fetchImpl}),e=>e.status===502&&!e.message.includes('PRIVATE'));
 }
 await assert.rejects(askTutor(validatePrompt(question),{env:{},fetchImpl:()=>{throw Error('must not call')}}),e=>e.status===503);
 await assert.rejects(askTutor(validatePrompt(question),{env,fetchImpl:async()=>new Response('',{status:429})}),e=>e.status===429);
});
