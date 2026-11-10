/**
 * Optional integrations, disabled unless explicitly enabled and configured.
 * OpenRouter only receives non-identifying risk codes and property category.
 * Resend only receives a random case reference for a private moderator alert.
 */
const CODES = new Set(["phone_format","payment_name","payment_pressure","unverified_claim",
  "property_contact_difference","listing_contact_difference","limited_location","missing_agent"]);
const goodKey = s => typeof s === "string" && s.length >= 20 && !/replace|placeholder|xxxxxxxx|example/i.test(s);
const email = s => typeof s === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s) && s.length < 255;

export function aiReady(env) {
  return env?.AI_EXPLANATION_ENABLED === "true" &&
    goodKey(env.OPENROUTER_API_KEY) &&
    typeof env.OPENROUTER_MODEL === "string" &&
    /^[\w./:-]{3,120}$/.test(env.OPENROUTER_MODEL) &&
    !env.OPENROUTER_MODEL.includes("example");
}
export function emailReady(env) {
  return env?.EMAIL_ALERTS_ENABLED === "true" && goodKey(env.RESEND_API_KEY) &&
    email(env.RESEND_FROM_EMAIL) && email(env.ALERT_RECIPIENT_EMAIL);
}
export async function aiQuestions(env, assessment, kind, httpFetch = fetch) {
  if (!aiReady(env)) return {status:"disabled", questions:[]};
  const codeList = (assessment?.findings || []).map(x=>x?.code).filter(x=>CODES.has(x)).slice(0,8);
  const payload = {
    model:env.OPENROUTER_MODEL, temperature:0.2, max_tokens:210,
    messages:[
      {role:"system",content:"Generate exactly 3 concise, practical due-diligence QUESTIONS for a Nigerian property buyer. Return only a JSON object containing a questions array with exactly three strings. The input consists only of generic risk signal codes, never actual property evidence. Never imply ownership, title, legitimacy, wrongdoing or safety has been verified; never accuse a person or give legal conclusions. Recommend independent official/professional checks."},
      {role:"user",content:JSON.stringify({
        category:["land","house","rental"].includes(kind)?kind:"property",
        genericRiskCodes:codeList, officialVerificationCompleted:false
      })}
    ]
  };
  const response = await httpFetch("https://openrouter.ai/api/v1/chat/completions",{
    method:"POST", headers:{
      "Authorization":"Bearer "+env.OPENROUTER_API_KEY,
      "Content-Type":"application/json", "X-Title":"SafeKey Nigeria"
    }, body:JSON.stringify(payload), signal:AbortSignal.timeout(6000)
  });
  if(!response.ok) throw Error("OpenRouter unavailable");
  const body=await response.json();
  const content=body?.choices?.[0]?.message?.content;
  if(typeof content!=="string"||content.length>3000) throw Error("Invalid AI response");
  let obj;
  try { obj=JSON.parse(content.trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"")); }
  catch { throw Error("Invalid AI JSON"); }
  if(!Array.isArray(obj?.questions)||obj.questions.length!==3||
     obj.questions.some(q=>typeof q!=="string"||q.trim().length<15||q.length>180||/[<>]/.test(q)))
    throw Error("Unsafe AI output");
  return {status:"available",questions:obj.questions.map(q=>q.trim()),
    note:"AI suggestions only; no property, identity or legal facts have been verified."};
}
export async function alertModerator(env, reference, httpFetch=fetch) {
  if(!emailReady(env)) return {status:"disabled"};
  if(!/^[0-9a-f-]{36}$/i.test(reference)) return {status:"invalid_reference"};
  const response=await httpFetch("https://api.resend.com/emails",{
    method:"POST",headers:{
      "Authorization":"Bearer "+env.RESEND_API_KEY,
      "Content-Type":"application/json",
      "Idempotency-Key":"safekey-report/"+reference
    },
    body:JSON.stringify({
      from:env.RESEND_FROM_EMAIL,
      to:[env.ALERT_RECIPIENT_EMAIL],
      subject:"SafeKey — private report pending review",
      text:"A new report is awaiting private review. Reference: "+reference+
      "\nOpen the protected moderator workspace to review the report. No allegation details are included."
    }), signal:AbortSignal.timeout(6000)
  });
  return {status:response.ok?"accepted":"failed"};
}
