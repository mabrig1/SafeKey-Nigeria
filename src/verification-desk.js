/**
 * Private, operator-only professional-review *coordination*, not certification.
 * Structured fields only: no property address, client contact, raw documents,
 * allegation, free-text notes, bank numbers, or public verification badges.
 */
import { templatesFor, WORKSPACE_KINDS, WORKSPACE_JURISDICTIONS } from "../public/workspace-core.js";

export const DESK_STATES = [
  ["requested", "Requested from professional"],
  ["received_unverified", "Material received — unverified"],
  ["review_reported", "Professional review reported — unverified by SafeKey"],
  ["needs_clarification", "Clarification required"]
];
export const EVIDENCE_KINDS = [
  ["none", "None yet"],
  ["seller_document", "Seller-provided document (unverified)"],
  ["legal_opinion_described", "Legal opinion described (not authenticated)"],
  ["survey_report_described", "Survey report described (not authenticated)"],
  ["registry_result_described", "Official search result described (not authenticated)"],
  ["site_visit_described", "Site visit described (not independently confirmed)"],
  ["agreement_described", "Draft agreement described (not authenticated)"]
];

const states = new Set(DESK_STATES.map(([key]) => key));
const kinds = new Set(WORKSPACE_KINDS);
const jurisdictions = new Set(WORKSPACE_JURISDICTIONS.map(([key]) => key));
const evidence = new Set(EVIDENCE_KINDS.map(([key]) => key));
const uuid = s => typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const object = x => x && typeof x === "object" && !Array.isArray(x);
const only = (raw, allowed) => Object.keys(raw).every(key => allowed.includes(key));

export function isCaseId(value) { return uuid(value); }

export function checkCaseInput(raw) {
  if (!object(raw) || !only(raw, ["kind", "jurisdiction", "professionalId"]) ||
      !kinds.has(raw.kind) || !jurisdictions.has(raw.jurisdiction) ||
      (raw.professionalId != null && !uuid(raw.professionalId))) {
    return { error: "Select a valid transaction, jurisdiction, and optional published professional." };
  }
  return { value: {
    kind: raw.kind,
    jurisdiction: raw.jurisdiction,
    professionalId: raw.professionalId || null
  }};
}

export function checkEventInput(raw, kind) {
  let possible = [];
  try { possible = templatesFor(kind).map(row => row.id); } catch { /* invalid kind */ }
  if (!object(raw) || !only(raw, ["checkId", "status", "evidenceKind"]) ||
      typeof raw.checkId !== "string" || !possible.includes(raw.checkId) ||
      !states.has(raw.status) || !evidence.has(raw.evidenceKind)) {
    return { error: "Choose a known checklist item, a review status and a permitted evidence category." };
  }
  return { value: {
    checkId: raw.checkId, status: raw.status, evidenceKind: raw.evidenceKind
  }};
}

export function summarizeCase(kind, events = []) {
  const items = templatesFor(kind).map(({id,title,owner}) => ({
    id,title,owner,status:"not_started",evidenceKind:"none",recordedAt:null
  }));
  // Events are supplied oldest to newest by the query: later events supersede
  // earlier progress while the full immutable audit trail remains available.
  for (const event of events) {
    const item = items.find(x => x.id === event.check_id);
    if (item && states.has(event.status) && evidence.has(event.evidence_kind)) {
      item.status = event.status;
      item.evidenceKind = event.evidence_kind;
      item.recordedAt = event.created_at;
    }
  }
  return {
    items,
    updated: items.filter(i => i.status !== "not_started").length,
    total: items.length,
    authorizationToPay: false,
    titleVerified: false,
    notice: "Administrative tracking only. The reported evidence has not been authenticated by SafeKey; this is not legal or financial clearance."
  };
}
