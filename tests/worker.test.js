import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("health endpoint refuses to invent backend readiness", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/health"), {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "setup_required");
  assert.equal(data.registryConnection, false);
});
test("property requests fail closed without secrets and D1", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind:"land",address:"Lagos"}) }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
});
test("static assets get conservative security headers", async () => {
  const response = await worker.fetch(new Request("https://safekey.test/"), { ASSETS: { fetch: async () => new Response("SafeKey") } });
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
