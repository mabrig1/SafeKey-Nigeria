import test from "node:test";
import assert from "node:assert/strict";
import { parseCheck, normalizePhone, normalizeListingUrl, evaluate } from "../src/risk.js";

test("normalizes Nigerian mobile numbers without guessing invalid identifiers", () => {
  assert.equal(normalizePhone("0803 123 4567"), "+2348031234567");
  assert.equal(normalizePhone("+234 803 123 4567"), "+2348031234567");
  assert.equal(normalizePhone("123"), null);
});
test("cannot submit an empty check", () => {
  assert.match(parseCheck({ kind: "land" }).error, /Provide/);
});
test("rejects non-web and credential-bearing URLs", () => {
  assert.equal(normalizeListingUrl("file:///etc/passwd"), null);
  assert.equal(normalizeListingUrl("https://user:pass@example.com/test"), null);
  assert.equal(normalizeListingUrl("https://EXAMPLE.com/p/?token=secret#frag"), "https://example.com/p");
});
test("never falsely asserts verification when no warnings exist", () => {
  const { value } = parseCheck({ kind: "land", address: "Plot 5", agentPhone: "08031234567" });
  const r = evaluate(value);
  assert.equal(r.level, "unverified");
  assert.match(r.description, /not a title search/i);
  assert.equal(r.checks[0].status, "Not checked");
});
test("name mismatch is a caution, not a criminal accusation", () => {
  const { value } = parseCheck({ kind: "house", address: "Estate A", advertiserName: "Agent One", paymentName: "Other Recipient" });
  const r = evaluate(value);
  assert.equal(r.level, "elevated_caution");
  assert.ok(r.findings.some(f => f.code === "payment_name"));
});
test("past checks are low confidence signals only", () => {
  const { value } = parseCheck({ kind: "rental", listingUrl: "https://example.com/listing", agentPhone: "08031234567" });
  const r = evaluate(value, { listingOtherAgent: true });
  assert.equal(r.findings.find(f => f.code === "listing_contact_difference").confidence, "Low");
  assert.equal(r.level, "unverified");
});
test("limits input length", () => {
  assert.match(parseCheck({ kind: "land", address: "x".repeat(221) }).error, /maximum/);
});
