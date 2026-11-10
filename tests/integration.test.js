import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

// Minimal D1 contract double to exercise request flow without Cloudflare credentials.
function fakeDb() {
  const checks = [], reports = [], buckets = new Map(), professionals = [];
  return {
    checks, reports, professionals,
    prepare(sql) {
      return {
        async all() {
          if (sql.includes("FROM reports ORDER BY")) return { results: reports };
          if (sql.includes("FROM professionals WHERE active")) return { results: [] };
          throw new Error("Unsupported mocked all query: " + sql);
        },
        bind(...values) {
          return {
            async first() {
              if (sql.startsWith("INSERT INTO rate_buckets")) {
                const key = values[0] + ":" + values[1];
                const count = (buckets.get(key) || 0) + 1;
                buckets.set(key, count);
                return { count };
              }
              if (sql.includes("FROM checks WHERE property_key")) {
                return checks.find(c => c.property_key === values[0] && c.agent_key &&
                  c.agent_key !== values[1]) ? { found: 1 } : null;
              }
              if (sql.includes("FROM checks WHERE listing_key")) {
                return checks.find(c => c.listing_key === values[0] && c.agent_key &&
                  c.agent_key !== values[1]) ? { found: 1 } : null;
              }
              throw new Error("Unsupported mocked first query: " + sql);
            },
            async run() {
              if (sql.startsWith("INSERT INTO checks")) {
                const [id, property_key, agent_key, listing_key, risk_level, created_at] = values;
                checks.push({ id, property_key, agent_key, listing_key, risk_level, created_at });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO reports")) {
                const [id, category, area, description, evidence_kind, created_at] = values;
                reports.push({ id, category, area, description, evidence_kind, created_at, status: "pending" });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("INSERT INTO professionals")) {
                professionals.push(values);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE reports SET status")) {
                const r = reports.find(item => item.id === values[3]);
                if (r) { r.status = values[0]; r.reviewer_note = values[1]; r.reviewed_at = values[2]; }
                return { meta: { changes: r ? 1 : 0 } };
              }
              throw new Error("Unsupported mocked run query: " + sql);
            },
            async all() {
              if (sql.includes("FROM reports ORDER BY")) return { results: reports };
              if (sql.includes("FROM professionals WHERE active")) return { results: [] };
              throw new Error("Unsupported mocked all query: " + sql);
            }
          };
        }
      };
    }
  };
}
const pepper = "k".repeat(48);
const admin = "p".repeat(48);
const req = (path, payload, key = "") => new Request("https://safekey.example" + path, {
  method: "POST",
  headers: { "content-type": "application/json", ...(key ? { "X-Admin-Key": key } : {}) },
  body: JSON.stringify(payload)
});
test("check saves only hashed identifiers and flags previously conflicting submissions", async () => {
  const db = fakeDb(), env = { DB: db, HASH_PEPPER: pepper };
  const first = await worker.fetch(req("/api/check", {
    kind: "land", area: "Lagos", address: "Plot 6, Harmony Estate", agentPhone: "08031234567"
  }), env);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).level, "unverified");
  assert.equal(db.checks.length, 1);
  const stored = JSON.stringify(db.checks);
  assert.equal(stored.includes("Harmony"), false);
  assert.equal(stored.includes("08031234567"), false);

  const second = await worker.fetch(req("/api/check", {
    kind: "land", area: "Lagos", address: "Plot 6, Harmony Estate", agentPhone: "08061234567"
  }), env);
  assert.equal(second.status, 200);
  const data = await second.json();
  assert.ok(data.findings.some(item => item.code === "property_contact_difference"));
  assert.equal(data.level, "unverified"); // prior unverified submissions are not proof
});
test("public allegation intake is disabled unless explicitly enabled", async () => {
  const env = { DB: fakeDb(), HASH_PEPPER: pepper };
  const result = await worker.fetch(req("/api/reports", {
    category: "advance_fee", area: "Lagos", description: "The advertisement requested a payment before any visit or inspection.", evidenceKind: "message", consent: true
  }), env);
  assert.equal(result.status, 503);
});
test("reports stay private and moderator credentials are checked", async () => {
  const db = fakeDb(), env = { DB: db, HASH_PEPPER: pepper, ADMIN_API_KEY: admin, REPORTS_ENABLED: "true" };
  const report = await worker.fetch(req("/api/reports", {
    category: "advance_fee", area: "Lagos", description: "The advertiser requested an advance deposit before any inspection.", evidenceKind: "message", consent: true
  }), env);
  assert.equal(report.status, 201);
  const ref = (await report.json()).reference;
  assert.equal(db.reports.length, 1);

  const unauthorized = await worker.fetch(new Request("https://safekey.example/api/admin/reports",
    { headers: { "X-Admin-Key": "not-the-admin-key" } }), env);
  assert.equal(unauthorized.status, 401);
  const authorized = await worker.fetch(new Request("https://safekey.example/api/admin/reports",
    { headers: { "X-Admin-Key": admin } }), env);
  assert.equal(authorized.status, 200);
  assert.equal((await authorized.json()).reports[0].id, ref);
});
