import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspace,validateWorkspace,updateStep,workspaceSummary,
  registryLinks,templatesFor,WORKSPACE_STATES
} from "../public/workspace-core.js";

test("creates different checklists for land, house and rental",()=>{
  const land=createWorkspace("land","lagos");
  const house=createWorkspace("house","fct");
  const rental=createWorkspace("rental","enugu");
  assert.ok(land.steps.some(x=>x.id==="title_search"));
  assert.ok(house.steps.some(x=>x.id==="planning"));
  assert.ok(rental.steps.some(x=>x.id==="rent_terms"));
  assert.ok(!rental.steps.some(x=>x.id==="title_search"));
  assert.equal(land.steps.length,templatesFor("land").length);
  assert.equal(house.steps.length,templatesFor("house").length);
  assert.equal(rental.steps.length,templatesFor("rental").length);
  assert.equal(land.steps.every(x=>x.status==="not_started"),true);
});
test("progress is self-reported, not a property-safety certificate",()=>{
  const starting=createWorkspace("house","other","2026-11-11T00:00:00.000Z");
  const changed=updateStep(starting,"title_search","independent_review_reported",
    "Buyer states lawyer reported a review; NOT verified by SafeKey.",
    "2026-11-11T00:01:00.000Z");
  assert.equal(workspaceSummary(changed).independentReviewReported,1);
  assert.equal(workspaceSummary(changed).safeToPay,false);
  assert.match(workspaceSummary(changed).note,/NOT verified/);
  assert.equal(starting.steps.find(x=>x.id==="title_search").status,"not_started");
});
test("export and import round-trip creates a clean copy",()=>{
  const initial=createWorkspace("rental","enugu","2026-11-11T00:00:00.000Z");
  const saved=updateStep(initial,"rent_terms","records_received","Tenancy terms received, not authenticated",
    "2026-11-11T00:01:00.000Z");
  const restored=validateWorkspace(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored,saved);
});
test("rejects unknown tasks, repeat IDs, unsupported status and oversized notes",()=>{
  const base=createWorkspace("land","fct");
  const malicious=structuredClone(base);
  malicious.steps[0].id="fraud_certified";
  assert.throws(()=>validateWorkspace(malicious),/invalid/);
  const dup=structuredClone(base);
  dup.steps[1].id=dup.steps[0].id;
  assert.throws(()=>validateWorkspace(dup),/invalid/);
  const state=structuredClone(base);
  state.steps[0].status="officially_verified";
  assert.throws(()=>validateWorkspace(state),/invalid/);
  const note=structuredClone(base);
  note.steps[0].note="x".repeat(241);
  assert.throws(()=>validateWorkspace(note),/invalid/);
  assert.throws(()=>updateStep(base,"title_search","officially_verified",""),/Unknown/);
});
test("restricts invalid jurisdictions, types and ISO timestamps",()=>{
  assert.throws(()=>createWorkspace("land","unknown"),/Unknown/);
  assert.throws(()=>createWorkspace("fraud","other"),/Select/);
  assert.throws(()=>validateWorkspace({...createWorkspace("land","lagos"),createdAt:"yesterday"}),/dates/);
  assert.throws(()=>validateWorkspace({schema:"other"}),/supported/);
});
test("curated sources are HTTPS agency domains without a fake fallback",()=>{
  const expected={
    lagos:["landonline.lagosstate.gov.ng","landsbureau.lagosstate.gov.ng"],
    fct:["www.agis.fcta.gov.ng"],
    enugu:["engis.enugustate.gov.ng"]
  };
  for(const [state,hosts] of Object.entries(expected)){
    const links=registryLinks(state);
    assert.deepEqual(links.map(x=>new URL(x.url).hostname),hosts);
    assert.equal(links.every(x=>x.url.startsWith("https://")),true);
  }
  assert.deepEqual(registryLinks("other"),[]);
  assert.equal(WORKSPACE_STATES.some(([status])=>status==="verified"),false);
});
test("workspace includes no network, session or persistence API",()=>{
  const doc=createWorkspace("land","other");
  assert.equal(typeof doc,"object");
  assert.ok(!Object.keys(doc).includes("titleVerified"));
  assert.ok(!Object.keys(doc).includes("paymentApproved"));
});
