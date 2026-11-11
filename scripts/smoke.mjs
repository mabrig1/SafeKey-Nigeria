import assert from "node:assert/strict";

const base = process.env.SAFEKEY_SMOKE_URL || "http://127.0.0.1:8787";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeoutMs = 45000;

async function waitForWorker() {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
      latest = "health returned " + response.status;
    } catch (err) {
      latest = err.message;
    }
    await sleep(350);
  }
  throw new Error("Local Worker did not start: " + latest);
}

async function verify(path, expectedStatus, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    signal: AbortSignal.timeout(7000)
  });
  assert.equal(response.status, expectedStatus, path + " returned " + response.status + " instead of " + expectedStatus);
  assert.equal(response.headers.get("x-frame-options"), "DENY", "security headers for " + path);
  assert.match(response.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  return response;
}
const post = body => ({
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

await waitForWorker();

const homepage = await (await verify("/", 200)).text();
assert.match(homepage, /SafeKey Nigeria/i);
assert.match(homepage, /checkForm/);
assert.match(homepage, /privacy\.html/);

const script = await (await verify("/app.js", 200)).text();
assert.match(script, /renderAssessment/);
const css = await (await verify("/styles.css", 200)).text();
assert.match(css, /privacy-content/);

const workspaceModule = await (await verify("/workspace-core.js", 200)).text();
assert.match(workspaceModule, /WORKSPACE_SCHEMA/);
assert.match(workspaceModule, /safeToPay:false/);
const workspaceUI = await (await verify("/workspace-ui.js", 200)).text();
assert.match(workspaceUI, /workspaceImport/);
assert.match(workspaceUI, /workspaceList/);
assert.match(homepage, /id="workspaceForm"/);
assert.match(homepage, /id="workspaceSources"/);

const privacy = await (await verify("/privacy.html", 200)).text();
assert.match(privacy, /stateless preview/i);
assert.doesNotMatch(privacy, /\sstyle\s*=/i, "inline styles violate the current CSP");

const health = await (await verify("/api/health", 200)).json();
assert.equal(health.status, "stateless_preview");
assert.equal(health.database, "unconfigured");
assert.equal(health.incidentReporting, false);
assert.equal(health.registryConnection, false);

const risk = await (await verify("/api/check", 200, post({
  kind: "land", area: "Lagos", address: "Fictional estate",
  agentPhone: "08031234567", advertiserName: "Advertiser A",
  paymentName: "Recipient B", aiExplain: true
}))).json();
assert.equal(risk.caseId, "not-saved");
assert.equal(risk.level, "elevated_caution");
assert.equal(risk.aiAssist.status, "disabled");
assert.match(risk.description, /not saved/i);
assert.ok(risk.findings.some(item => item.code === "payment_name"));

const compare=await (await verify("/api/compare", 200, post({
  first:{area:"Lagos",address:"Fictional Estate 5",agentPhone:"08031234567",priceNgn:"12000000"},
  second:{area:"Lagos",address:"Fictional Estate 5",agentPhone:"08061234567",priceNgn:"13000000"}
}))).json();
assert.equal(compare.status,"comparison_only");
assert.equal(compare.possibleMatch,true);
assert.equal(compare.retained,false);
assert.ok(compare.signals.some(x=>x.code==="agent_contact_difference"));

const compareBad=await (await verify("/api/compare",422,post({
  first:{listingUrl:"javascript:alert(1)"},second:{address:"fictional estate"}
}))).json();
assert.match(compareBad.error,/HTTP or HTTPS/);

const compareScript=await (await verify("/compare-ui.js",200)).text();
assert.match(compareScript,/compareForm/);
const evidenceScript=await (await verify("/evidence.js",200)).text();
assert.match(evidenceScript,/SHA-256/);
assert.match(homepage,/evidenceFile/);
assert.match(homepage,/compareForm/);

const invalid = await (await verify("/api/check", 422, post({
  kind: "land", address: ""
}))).json();
assert.match(invalid.error, /provide/i);

await verify("/api/reports", 503, post({
  category: "advance_fee", area: "Lagos", description: "A report should not be persisted without a database.",
  evidenceKind: "none", consent: true
}));
await verify("/api/admin/reports", 503);

const professionals = await (await verify("/api/professionals", 200)).json();
assert.deepEqual(professionals.professionals, []);

await verify("/api/check", 403, {
  ...post({kind: "rental", address: "Lagos"}),
  headers: { "Content-Type": "application/json", "Origin": "https://untrusted.invalid" }
});

console.log("SafeKey Worker runtime smoke: PASS (static assets, CSP, stateless check, closed routes, validation, origin guard)");
