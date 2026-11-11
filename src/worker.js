import { parseCheck, evaluate, normalizeIdentity } from "./risk.js";
import { aiQuestions, alertModerator, emailReady } from "./integrations.js";
import { compareListings } from "./comparison.js";
import { handleVerificationRoutes } from "./verification-routes.js";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY"
};
const statuses = new Set(["pending", "needs_more_evidence", "closed_unsubstantiated", "substantiated", "referred"]);
const categories = new Set(["advance_fee", "misleading_listing", "possible_double_sale", "suspected_document_issue", "other"]);
const kinds = new Set(["none", "message", "receipt", "photo", "document", "other"]);
const professions = new Set(["Lawyer", "Surveyor", "Estate surveyor", "Inspector"]);
const MAX_JSON = 10000;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function failure(message, status = 400) { return json({ error: message }, status); }
function ready(env) {
  return !!(env?.DB && typeof env.DB.prepare === "function" && typeof env.HASH_PEPPER === "string" && env.HASH_PEPPER.length >= 32);
}
async function sha(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function keyed(env, name, value) {
  return value ? sha(env.HASH_PEPPER + ":" + name + ":" + value) : null;
}
async function readJson(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw { status: 415, message: "Send JSON requests." };
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_JSON) throw { status: 413, message: "Request is too large." };
  const reader = request.body?.getReader();
  if (!reader) throw { status: 400, message: "Request body is required." };
  let length = 0, data = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > MAX_JSON) { await reader.cancel(); throw { status: 413, message: "Request is too large." }; }
      data += decoder.decode(next.value, { stream: true });
    }
    data += decoder.decode();
    return JSON.parse(data);
  } catch (error) {
    if (error?.status) throw error;
    throw { status: 400, message: "Invalid JSON body." };
  }
}
async function rateLimit(env, request, purpose, limit) {
  // HMAC-style peppered identifier; no raw IP address is written to D1.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await keyed(env, "rate:" + purpose, ip);
  const bucket = Math.floor(Date.now() / 3600000);
  const result = await env.DB.prepare(
    "INSERT INTO rate_buckets (key, bucket, count) VALUES (?, ?, 1) ON CONFLICT(key, bucket) DO UPDATE SET count = count + 1 RETURNING count"
  ).bind(key, bucket).first();
  return Number(result?.count || 1) <= limit;
}
async function adminAuthorized(request, env) {
  if (!env.ADMIN_API_KEY || env.ADMIN_API_KEY.length < 32) return false;
  const supplied = request.headers.get("X-Admin-Key") || "";
  if (supplied.length < 32 || supplied.length > 256) return false;
  const a = await sha(supplied), b = await sha(env.ADMIN_API_KEY);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function adminReady(env) { return ready(env) && !!env.ADMIN_API_KEY && env.ADMIN_API_KEY.length >= 32; }
function validShort(v, max, min = 1) { return typeof v === "string" && v.trim().length >= min && v.trim().length <= max; }
async function handleApi(request, env, ctx) {
  const url = new URL(request.url), method = request.method, path = url.pathname;
  if (path === "/api/health" && method === "GET") {
    const bound = ready(env);
    let status = bound ? "migrations_required" : "stateless_preview";
    let database = bound ? "unverified" : "unconfigured";
    if (bound) {
      try {
        // A D1 binding and HASH_PEPPER alone do not prove tables were migrated.
        const found = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('checks', 'reports', 'professionals', 'rate_buckets')"
        ).all();
        const tableNames = new Set((found?.results || []).map(row => row.name));
        if (["checks", "reports", "professionals", "rate_buckets"].every(name => tableNames.has(name))) {
          status = "configured";
          database = "ready";
        } else {
          database = "migrations_required";
        }
      } catch {
        status = "database_unavailable";
        database = "unavailable";
      }
    }
    return json({
      service: "SafeKey Check", status,
      mode: status === "stateless_preview" ? "no_storage" : "pilot",
      database, registryConnection: false,
      incidentReporting: status === "configured" && env.REPORTS_ENABLED === "true",
      aiAvailable: status === "configured" && env.AI_EXPLANATION_ENABLED === "true"
    });
  }
  if (method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== url.origin)
    return failure("Cross-origin writes are not allowed.", 403);

  // Buyer-submitted, zero-retention comparison. No external listing fetches,
  // registry calls, model calls or database writes.
  if (path === "/api/compare" && method === "POST") {
    if (ready(env) && !(await rateLimit(env, request, "compare", 24)))
      return failure("Comparison limit reached. Try again later.", 429);
    const submitted = await readJson(request);
    const comparison = compareListings(submitted);
    if (comparison.error) return failure(comparison.error, 422);
    return json(comparison);
  }

  // A fresh Cloudflare Worker can launch safely without a database. Stateless
  // screening never stores submitted inputs or calls billable integrations.
  // Allegation reporting, admin access and historical comparisons remain OFF.
  if (!ready(env)) {
    if (path === "/api/check" && method === "POST") {
      const input = await readJson(request);
      const parsed = parseCheck(input);
      if (parsed.error) return failure(parsed.error, 422);
      const assessment = evaluate(parsed.value);
      return json({
        caseId: "not-saved", issuedAt: new Date().toISOString(),
        ...assessment,
        description: assessment.description + " Stateless preview: this check was not saved and no past listings were compared.",
        nextSteps: [...assessment.nextSteps, "This preview does not retain a report or check previous submissions."],
        ...(input.aiExplain === true ? { aiAssist: { status: "disabled", questions: [] } } : {})
      });
    }
    if (path === "/api/professionals" && method === "GET")
      return json({ professionals: [], note: "The verified directory is not activated; no professionals are represented as credential-checked." });
    return failure("This feature requires a configured SafeKey database and administrator controls.", 503);
  }

  if (path === "/api/check" && method === "POST") {
    if (!(await rateLimit(env, request, "check", 30))) return failure("Check limit reached. Try again later.", 429);
    const input = await readJson(request);
    const parsed = parseCheck(input);
    if (parsed.error) return failure(parsed.error, 422);
    const c = parsed.value;
    const prop = normalizeIdentity([c.area, c.address, c.plot].filter(Boolean).join("|"));
    const propertyKey = prop ? await keyed(env, "property", prop) : null;
    const agentKey = c.phone ? await keyed(env, "agent", c.phone) : null;
    const listingKey = c.url ? await keyed(env, "listing", c.url) : null;
    let propertyOtherAgent = false, listingOtherAgent = false;
    if (agentKey && propertyKey) {
      const matching = await env.DB.prepare("SELECT 1 AS found FROM checks WHERE property_key = ? AND agent_key IS NOT NULL AND agent_key != ? LIMIT 1").bind(propertyKey, agentKey).first();
      propertyOtherAgent = !!matching;
    }
    if (agentKey && listingKey) {
      const matching = await env.DB.prepare("SELECT 1 AS found FROM checks WHERE listing_key = ? AND agent_key IS NOT NULL AND agent_key != ? LIMIT 1").bind(listingKey, agentKey).first();
      listingOtherAgent = !!matching;
    }
    const assessment = evaluate(c, { propertyOtherAgent, listingOtherAgent });
    let aiAssist;
    if (input.aiExplain === true) {
      if (env.AI_EXPLANATION_ENABLED !== "true") {
        aiAssist = { status: "disabled", questions: [] };
      } else if (!(await rateLimit(env, request, "ai", 8))) {
        aiAssist = { status: "rate_limited", questions: [] };
      } else {
        try { aiAssist = await aiQuestions(env, assessment, c.kind); }
        catch { aiAssist = { status: "unavailable", questions: [] }; }
      }
    }
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO checks (id, property_key, agent_key, listing_key, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, propertyKey, agentKey, listingKey, assessment.level, new Date().toISOString()).run();
    return json({ caseId: id, issuedAt: new Date().toISOString(), ...assessment, ...(aiAssist ? { aiAssist } : {}) });
  }

  if (path === "/api/reports" && method === "POST") {
    if (env.REPORTS_ENABLED !== "true") return failure("Incident intake is not enabled yet.", 503);
    if (!(await rateLimit(env, request, "reports", 4))) return failure("Submission limit reached. Try again later.", 429);
    const b = await readJson(request);
    if (!b || !categories.has(b.category) || !validShort(b.area, 100, 2) ||
        !validShort(b.description, 2000, 30) || !kinds.has(b.evidenceKind) || b.consent !== true)
      return failure("Supply a category, area, description (30–2000 characters), evidence type and consent.", 422);
    const id = crypto.randomUUID(), now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO reports (id, category, area, description, evidence_kind, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, b.category, b.area.trim(), b.description.trim(), b.evidenceKind, now).run();
    if (emailReady(env)) {
      const notification = alertModerator(env, id).catch(() => ({ status: "failed" }));
      // A mail outage must not prevent saving an allegation for private review.
      if (ctx?.waitUntil) ctx.waitUntil(notification);
      else await notification;
    }
    return json({ reference: id, status: "pending", message: "Submitted for private human review. This is not a police or regulator report." }, 201);
  }

  if (path === "/api/professionals" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id, name, profession, city, credential_label, evidence_url, verified_at FROM professionals WHERE active = 1 ORDER BY verified_at DESC LIMIT 50"
    ).all();
    return json({ professionals: result.results || [], note: "Professional records are manually entered and must be independently reconfirmed before engagement." });
  }

  if (path.startsWith("/api/admin/")) {
    if (!adminReady(env)) return failure("Admin access is not configured.", 503);
    if (!(await rateLimit(env, request, "admin", 80))) return failure("Admin request limit reached.", 429);
    if (!(await adminAuthorized(request, env))) return failure("Unauthorized.", 401);
    if (path.startsWith("/api/admin/verification-cases")) {
      // This code path is reachable only after DB, admin-key and rate-limit guards.
      return handleVerificationRoutes(request, env, path, { json, failure, readJson });
    }
    if (path === "/api/admin/reports" && method === "GET") {
      const list = await env.DB.prepare("SELECT id, category, area, description, evidence_kind, status, reviewer_note, created_at, reviewed_at FROM reports ORDER BY created_at DESC LIMIT 100").all();
      return json({ reports: list.results || [] });
    }
    if (path === "/api/admin/reports/decision" && method === "POST") {
      const b = await readJson(request);
      if (!b || !validShort(b.id, 50, 30) || !statuses.has(b.status) ||
          !validShort(b.note, 1000, 8) || b.status === "pending")
        return failure("Choose an allowed review status and enter a note of at least eight characters.", 422);
      const result = await env.DB.prepare("UPDATE reports SET status = ?, reviewer_note = ?, reviewed_at = ? WHERE id = ?")
        .bind(b.status, b.note.trim(), new Date().toISOString(), b.id).run();
      return json({ updated: Number(result.meta?.changes || 0) > 0 });
    }
    if (path === "/api/admin/professionals" && method === "POST") {
      const b = await readJson(request);
      if (!b || !validShort(b.name, 120, 3) || !professions.has(b.profession) ||
          !validShort(b.city, 80, 2) || !validShort(b.credentialLabel, 120, 5) ||
          !validShort(b.evidenceUrl, 500, 12))
        return failure("Provide a vetted professional's name, role, city, credential and public evidence URL.", 422);
      let link;
      try { link = new URL(b.evidenceUrl); } catch { return failure("Evidence must have an HTTPS URL.", 422); }
      if (link.protocol !== "https:" || link.username || link.password)
        return failure("Evidence must have an HTTPS URL without embedded credentials.", 422);
      const id = crypto.randomUUID(), now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO professionals (id, name, profession, city, credential_label, evidence_url, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, b.name.trim(), b.profession, b.city.trim(), b.credentialLabel.trim(), link.toString(), now, now).run();
      return json({ id, created: true }, 201);
    }
    return failure("Admin route not found.", 404);
  }
  return failure("API route not found.", 404);
}
function secureHeaders(response) {
  const h = new Headers(response.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "no-referrer");
  h.set("X-Frame-Options", "DENY");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  h.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/")) {
      if (!env.ASSETS) return new Response("Static assets unavailable", { status: 503 });
      return secureHeaders(await env.ASSETS.fetch(request));
    }
    try { return secureHeaders(await handleApi(request, env, ctx)); }
    catch (error) {
      if (error && Number.isInteger(error.status) && error.status >= 400 && error.status < 500)
        return secureHeaders(failure(error.message, error.status));
      console.error("SafeKey API error", error?.message || "Unknown");
      return secureHeaders(failure("Service temporarily unavailable. Please try again later.", 503));
    }
  },
  async scheduled(event, env) {
    if (!env.DB) return;
    const staleChecks = new Date(Date.now() - 30 * 86400000).toISOString();
    const staleReports = new Date(Date.now() - 180 * 86400000).toISOString();
    const staleBuckets = Math.floor(Date.now() / 3600000) - 48;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM checks WHERE created_at < ?").bind(staleChecks),
      env.DB.prepare("DELETE FROM reports WHERE created_at < ? AND status IN ('pending', 'closed_unsubstantiated')").bind(staleReports),
      env.DB.prepare("DELETE FROM rate_buckets WHERE bucket < ?").bind(staleBuckets)
    ]);
    // Case desk has its own 90-day maximum retention. Never delete or
    // change immutable event contents individually; purge entire old cases.
    // Without migration 0002, this optional cleanup is skipped safely.
    const staleCases = new Date(Date.now() - 90 * 86400000).toISOString();
    try {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM verification_events WHERE case_id IN (SELECT id FROM verification_cases WHERE created_at < ?)").bind(staleCases),
        env.DB.prepare("DELETE FROM verification_cases WHERE created_at < ?").bind(staleCases)
      ]);
    } catch {
      console.warn("SafeKey verification desk cleanup unavailable; check migration and cron configuration.");
    }
  }
};
