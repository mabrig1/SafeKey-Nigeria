import test from "node:test";
import assert from "node:assert/strict";
import {aiQuestions, alertModerator, aiReady, emailReady} from "../src/integrations.js";

const aiEnv={
  AI_EXPLANATION_ENABLED:"true",
  OPENROUTER_API_KEY:"sk-or-v1-mock-private-key-for-unit-tests-12345",
  OPENROUTER_MODEL:"openai/gpt-4o-mini"
};
const emailEnv={
  EMAIL_ALERTS_ENABLED:"true",
  RESEND_API_KEY:"re_mock-private-key-for-unit-tests-12345",
  RESEND_FROM_EMAIL:"notifications@verified.example.com",
  ALERT_RECIPIENT_EMAIL:"moderator@example.com"
};

test("OpenRouter is disabled unless feature flag and usable key are present",()=>{
  assert.equal(aiReady({...aiEnv,AI_EXPLANATION_ENABLED:"false"}),false);
  assert.equal(aiReady({...aiEnv,OPENROUTER_API_KEY:"replace-with-key"}),false);
  assert.equal(aiReady(aiEnv),true);
});
test("OpenRouter receives generic codes only, never raw property or buyer details",async()=>{
  let outbound;
  const fake=async(url, options)=>{
    assert.equal(url,"https://openrouter.ai/api/v1/chat/completions");
    outbound=JSON.parse(options.body);
    assert.equal(options.headers.Authorization,"Bearer "+aiEnv.OPENROUTER_API_KEY);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({
      questions:[
        "Can a licensed professional check the title at the official land registry?",
        "Does the proposed payment recipient have documented authority from the seller?",
        "Can an independent surveyor confirm the property's boundaries before payment?"
      ]})}}]}),{status:200});
  };
  const result=await aiQuestions(aiEnv,{
    findings:[{code:"payment_name",title:"Seller Jane Doe",detail:"Phone 08031234567 Plot 49"}]
  },"land",fake);
  assert.equal(result.status,"available");
  assert.equal(result.questions.length,3);
  const text=JSON.stringify(outbound);
  assert.equal(text.includes("Jane Doe"),false);
  assert.equal(text.includes("08031234567"),false);
  assert.equal(text.includes("Plot 49"),false);
  assert.ok(text.includes("payment_name"));
});
test("AI does not call providers when disabled",async()=>{
  const result=await aiQuestions({...aiEnv,AI_EXPLANATION_ENABLED:"false"},{},"land",
    async()=>{throw Error("must not call provider")});
  assert.equal(result.status,"disabled");
});
test("Resend requires both key and a sender/recipient address",()=>{
  assert.equal(emailReady(emailEnv),true);
  assert.equal(emailReady({...emailEnv,RESEND_API_KEY:"replace-with-key"}),false);
  assert.equal(emailReady({...emailEnv,EMAIL_ALERTS_ENABLED:"false"}),false);
});
test("Resend sends random case reference but never a private allegation",async()=>{
  const id="2aac4abf-e30d-47b1-8dfd-b6b7c410fab1";
  let mail;
  const result=await alertModerator(emailEnv,id,async(url,options)=>{
    assert.equal(url,"https://api.resend.com/emails");
    assert.equal(options.headers["Idempotency-Key"],"safekey-report/"+id);
    mail=JSON.parse(options.body);
    return new Response('{"id":"email-test"}',{status:200});
  });
  assert.equal(result.status,"accepted");
  assert.deepEqual(mail.to,["moderator@example.com"]);
  assert.ok(mail.text.includes(id));
  assert.equal(JSON.stringify(mail).includes("private allegation"),false);
});
