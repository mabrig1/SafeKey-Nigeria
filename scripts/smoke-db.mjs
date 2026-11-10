import assert from "node:assert/strict";
const base=process.env.SAFEKEY_SMOKE_DB_URL||"http://127.0.0.1:8788";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function healthReady(){
  const deadline=Date.now()+45000;
  let last="no response";
  while(Date.now()<deadline){
    try{
      const r=await fetch(base+"/api/health",{signal:AbortSignal.timeout(2500)});
      if(r.ok){
        const health=await r.json();
        if(health.status==="configured") return health;
        last=JSON.stringify(health);
      }
    } catch(e){last=e.message}
    await sleep(400);
  }
  throw Error("D1 Worker did not become ready: "+last);
}
const health=await healthReady();
assert.equal(health.database,"ready");
assert.equal(health.registryConnection,false);
assert.equal(health.incidentReporting,true);
const post=(path,data,headers={})=>fetch(base+path,{
  method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(data),
  signal:AbortSignal.timeout(8000)
});
const property={kind:"land",area:"Lagos",address:"A fictional test estate",agentPhone:"08031234567"};
const first=await post("/api/check",property);
assert.equal(first.status,200);
const report1=await first.json();
assert.equal(report1.level,"unverified");
assert.notEqual(report1.caseId,"not-saved");
assert.match(report1.caseId,/^[0-9a-f-]{36}$/i);
const second=await post("/api/check",{...property,agentPhone:"08061234567"});
assert.equal(second.status,200);
const report2=await second.json();
assert.ok(report2.findings.some(item=>item.code==="property_contact_difference"));
assert.equal(report2.level,"unverified");

const report=await post("/api/reports",{
  category:"misleading_listing",area:"Lagos (fictional)",description:"A fictional example was listed twice using two different fictional contact points.",evidenceKind:"none",consent:true
});
assert.equal(report.status,201);
const ref=(await report.json()).reference;
assert.match(ref,/^[0-9a-f-]{36}$/i);
const unauth=await fetch(base+"/api/admin/reports");
assert.equal(unauth.status,401);
const authed=await fetch(base+"/api/admin/reports",{headers:{"X-Admin-Key":"b".repeat(48)}});
assert.equal(authed.status,200);
const privateCases=(await authed.json()).reports;
assert.ok(privateCases.some(x=>x.id===ref&&x.status==="pending"));
const decision=await post("/api/admin/reports/decision",{
  id:ref,status:"closed_unsubstantiated",note:"Synthetic CI-only report; no actual property or person is involved."
},{"X-Admin-Key":"b".repeat(48)});
assert.equal(decision.status,200);
assert.equal((await decision.json()).updated,true);
const pros=await fetch(base+"/api/professionals");
assert.equal(pros.status,200);
assert.deepEqual((await pros.json()).professionals,[]);
console.log("SafeKey D1 local smoke: PASS (migration, health, saved checks, duplicate signals, report moderation, admin auth)");
