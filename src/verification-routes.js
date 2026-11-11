import { isCaseId, checkCaseInput, checkEventInput, summarizeCase } from "./verification-desk.js";

/**
 * PRIVATE admin routes only. Caller must first check X-Admin-Key and admin
 * rate limits. The feature flag is off by default, even if a D1 binding exists.
 */
export async function handleVerificationRoutes(request, env, path, {json, failure, readJson}) {
  if (env.VERIFICATION_DESK_ENABLED !== "true")
    return failure("The private verification desk is not enabled.", 503);

  const collection = "/api/admin/verification-cases";
  const relative = path.slice(collection.length);
  if (path === collection && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, kind, jurisdiction, professional_id, created_at FROM verification_cases ORDER BY created_at DESC LIMIT 50"
    ).all();
    return json({
      cases: rows.results || [],
      notice: "Private coordination records only. No land title, practitioner credential or buyer payment is verified."
    });
  }

  if (path === collection && request.method === "POST") {
    const parsed = checkCaseInput(await readJson(request));
    if (parsed.error) return failure(parsed.error, 422);
    const {kind, jurisdiction, professionalId} = parsed.value;
    if (professionalId) {
      const professional = await env.DB.prepare(
        "SELECT id FROM professionals WHERE id = ? AND active = 1 LIMIT 1"
      ).bind(professionalId).first();
      if (!professional) return failure("Select an active professional directory record.", 422);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO verification_cases (id, kind, jurisdiction, professional_id, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, kind, jurisdiction, professionalId, now).run();
    return json({
      id, kind, jurisdiction, professionalId, createdAt: now,
      verificationStatus: "not_verified",
      message: "Private case created. No title, credential, document or payment has been verified."
    }, 201);
  }

  const match = relative.match(/^\/([a-f0-9-]{36})(?:\/(events))?$/i);
  if (!match || !isCaseId(match[1])) return failure("Verification desk route not found.", 404);
  const id = match[1];
  const row = await env.DB.prepare(
    "SELECT id, kind, jurisdiction, professional_id, created_at FROM verification_cases WHERE id = ?"
  ).bind(id).first();
  if (!row) return failure("Case not found.", 404);

  if (!match[2] && request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id, check_id, status, evidence_kind, created_at FROM verification_events WHERE case_id = ? ORDER BY created_at ASC, id ASC LIMIT 150"
    ).bind(id).all();
    const events = result.results || [];
    return json({
      case: row,
      summary: summarizeCase(row.kind, events),
      events,
      access: "administrator_only",
      notice: "These are administrative observations, not a certified property review."
    });
  }

  if (match[2] === "events" && request.method === "POST") {
    const parsed = checkEventInput(await readJson(request), row.kind);
    if (parsed.error) return failure(parsed.error, 422);
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM verification_events WHERE case_id = ?"
    ).bind(id).first();
    if (Number(count?.total || 0) >= 120)
      return failure("This case has reached its review-event limit. Open a new case after an internal review.", 409);

    const eventId = crypto.randomUUID();
    const now = new Date().toISOString();
    const event = parsed.value;
    // A conditional insert protects the event cap against concurrent requests.
    const result = await env.DB.prepare(
      "INSERT INTO verification_events (id, case_id, check_id, status, evidence_kind, created_at) " +
      "SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM verification_events WHERE case_id = ?) < 120"
    ).bind(eventId, id, event.checkId, event.status, event.evidenceKind, now, id).run();
    if (Number(result.meta?.changes || 0) !== 1)
      return failure("This case can no longer accept events.", 409);
    return json({
      recorded: true, eventId, caseId: id, recordedAt: now,
      verificationStatus: "not_verified",
      notice: "An unverified review step was recorded. The audit history is append-only."
    }, 201);
  }

  return failure("Verification desk route not found.", 404);
}
