import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("health endpoint refuses to invent backend readiness", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/health"), {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "stateless_preview");
  assert.equal(data.incidentReporting, false);
  assert.equal(data.aiAvailable, false);
  assert.equal(data.registryConnection, false);
});
test("property screening works without D1 but does not store or verify any records", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/check", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind:"land", address:"Lagos", aiExplain:true })
  }), {});
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.caseId, "not-saved");
  assert.equal(result.level, "unverified");
  assert.match(result.description, /not saved/i);
  assert.equal(result.aiAssist.status, "disabled");
});
test("private reports and admin routes stay closed without D1", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/reports", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "Test report" })
  }), {});
  assert.equal(response.status, 503);
  const admin = await worker.fetch(new Request("https://safekey.test/api/admin/reports"), {});
  assert.equal(admin.status, 503);
});
test("directory is empty rather than inventing professional verification", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/professionals"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.professionals, []);
});
test("static assets get conservative security headers", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/"), { ASSETS: { fetch: async () => new Response("SafeKey") } });
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});

test("health detects missing D1 schema despite a binding and hash secret", async () => {
  const env = {
    HASH_PEPPER: "p".repeat(48),
    DB: { prepare: () => ({
      all: async () => ({ results: [{ name: "checks" }, { name: "reports" }] })
    }) }
  };
  const response = await worker.fetch(new Request("https://safekey.test/api/health"), env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "migrations_required");
  assert.equal(data.database, "migrations_required");
  assert.equal(data.incidentReporting, false);
});

test("health confirms all four D1 tables, without claiming registry access", async () => {
  const env = {
    HASH_PEPPER: "p".repeat(48),
    REPORTS_ENABLED: "true",
    DB: { prepare: () => ({
      all: async () => ({ results: ["checks", "reports", "professionals", "rate_buckets"].map(name => ({ name })) })
    }) }
  };
  const response = await worker.fetch(new Request("https://safekey.test/api/health"), env);
  const data = await response.json();
  assert.equal(data.status, "configured");
  assert.equal(data.database, "ready");
  assert.equal(data.incidentReporting, true);
  assert.equal(data.registryConnection, false);
});

test("health reports an inaccessible D1 schema, not false readiness", async () => {
  const env = {
    HASH_PEPPER: "p".repeat(48),
    DB: { prepare: () => { throw new Error("no such table: checks"); } }
  };
  const response = await worker.fetch(new Request("https://safekey.test/api/health"), env);
  const data = await response.json();
  assert.equal(data.status, "database_unavailable");
  assert.equal(data.database, "unavailable");
  assert.equal(data.incidentReporting, false);
});
