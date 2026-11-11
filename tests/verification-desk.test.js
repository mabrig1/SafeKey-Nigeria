import test from "node:test";
import assert from "node:assert/strict";
import {
  checkCaseInput,checkEventInput,summarizeCase,isCaseId,
  DESK_STATES,EVIDENCE_KINDS
} from "../src/verification-desk.js";

test("private cases allow only the enumerated types, jurisdictions and UUIDs",()=>{
  assert.deepEqual(checkCaseInput({kind:"land",jurisdiction:"lagos"}).value,{
    kind:"land",jurisdiction:"lagos",professionalId:null
  });
  assert.match(checkCaseInput({kind:"land",jurisdiction:"unknown"}).error,/valid/);
  assert.match(checkCaseInput({kind:"land",jurisdiction:"lagos",address:"private estate"}).error,/valid/);
  assert.match(checkCaseInput({kind:"land",jurisdiction:"lagos",professionalId:"abc"}).error,/valid/);
  assert.equal(isCaseId("5a57ebd4-dcd1-4a68-9a10-95b2d3f48570"),true);
  assert.equal(isCaseId("not-a-case-id"),false);
});
test("review events reject unbounded notes, personal data and fictional evidence classifications",()=>{
  const a={checkId:"title_search",status:"review_reported",evidenceKind:"registry_result_described"};
  assert.deepEqual(checkEventInput(a,"land").value,a);
  assert.match(checkEventInput({...a,email:"private@example.com"},"land").error,/known/);
  assert.match(checkEventInput({...a,notes:"secret"}, "land").error,/known/);
  assert.match(checkEventInput({...a,status:"verified_legal_title"},"land").error,/known/);
  assert.match(checkEventInput({...a,evidenceKind:"official_approved"},"land").error,/known/);
  assert.match(checkEventInput(a,"rental").error,/known/);
});
test("case summary preserves event history semantics and never certifies",()=>{
  const events=[
    {check_id:"title_search",status:"requested",evidence_kind:"none",created_at:"2026-11-11T01:00:00.000Z"},
    {check_id:"title_search",status:"received_unverified",evidence_kind:"seller_document",created_at:"2026-11-11T02:00:00.000Z"},
    {check_id:"title_search",status:"needs_clarification",evidence_kind:"registry_result_described",created_at:"2026-11-11T03:00:00.000Z"}
  ];
  const result=summarizeCase("land",events);
  assert.equal(result.items.find(x=>x.id==="title_search").status,"needs_clarification");
  assert.equal(result.updated,1);
  assert.equal(result.authorizationToPay,false);
  assert.equal(result.titleVerified,false);
  assert.match(result.notice,/not been authenticated/);
  assert.ok(result.items.some(x=>x.id==="seller_authority"));
});
test("rental case cannot inherit title-search review state",()=>{
  const r=summarizeCase("rental",[
    {check_id:"title_search",status:"review_reported",evidence_kind:"registry_result_described",created_at:"2026-11-11T01:00:00.000Z"}
  ]);
  assert.equal(r.updated,0);
  assert.equal(r.titleVerified,false);
});
test("all review and evidence enums explicitly avoid any verified status",()=>{
  assert.ok(DESK_STATES.every(([key])=>!key.includes("verified")||key==="received_unverified"));
  assert.ok(EVIDENCE_KINDS.every(([key])=>!key.includes("certified")));
});
