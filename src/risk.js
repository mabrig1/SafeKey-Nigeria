/**
 * SafeKey's V0 risk engine. It assesses user-provided claims and prior
 * platform submissions only; it NEVER verifies ownership, titles or people.
 * No external URLs are fetched and no automated blacklists are generated.
 */
export const MAX = {
  address: 220, area: 90, plot: 100, listingUrl: 500,
  agentPhone: 35, advertiserName: 100, paymentName: 100, listingText: 1800
};
const KINDS = new Set(["land", "house", "rental"]);
export function tidy(value, maximum = 200) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}
export function normalizePhone(input) {
  const raw = tidy(input, MAX.agentPhone).replace(/[\s().-]/g, "");
  if (!raw) return "";
  if (/^0[789][01]\d{8}$/.test(raw)) return "+234" + raw.slice(1);
  if (/^234[789][01]\d{8}$/.test(raw)) return "+" + raw;
  if (/^\+234[789][01]\d{8}$/.test(raw)) return raw;
  return null;
}
export function normalizeListingUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (!["https:", "http:"].includes(u.protocol) || !u.hostname || u.username || u.password) return null;
    u.hash = "";
    u.search = ""; // discard tracking and potentially sensitive query parameters
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/$/, "") || "/";
    return u.toString();
  } catch { return null; }
}
export function normalizeIdentity(value) {
  return tidy(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function parseCheck(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Enter the property details to check." };
  const kind = typeof input.kind === "string" ? input.kind : "";
  if (!KINDS.has(kind)) return { error: "Choose land, house or rental." };
  for (const [key, limit] of Object.entries(MAX)) {
    if (typeof input[key] === "string" && input[key].length > limit) return { error: key + " exceeds the maximum length." };
  }
  const value = { kind };
  for (const [key, limit] of Object.entries(MAX)) value[key] = tidy(input[key], limit);
  const phone = normalizePhone(value.agentPhone);
  const url = normalizeListingUrl(value.listingUrl);
  if (url === null) return { error: "Use a valid HTTP or HTTPS listing link without login credentials." };
  if (!value.address && !value.plot && !value.listingUrl && !value.agentPhone) {
    return { error: "Provide at least an address, plot number, listing link or agent phone." };
  }
  return { value: { ...value, phone, url } };
}
export function evaluate(check, history = { propertyOtherAgent: false, listingOtherAgent: false }) {
  const findings = [];
  function flag(code, level, title, detail, source = "Buyer-submitted information") {
    findings.push({ code, level, title, detail, source, confidence: source.startsWith("Previous") ? "Low" : "Input-based" });
  }
  if (check.agentPhone && check.phone === null) flag("phone_format", "attention", "Phone format could not be confirmed", "The supplied number does not match a typical Nigerian mobile-number format. This does not establish fraud.");
  if (check.advertiserName && check.paymentName &&
    normalizeIdentity(check.advertiserName) !== normalizeIdentity(check.paymentName)) {
    flag("payment_name", "caution", "Different advertiser and payment names", "Ask for independent evidence that the proposed recipient is authorized to receive funds. Different names can have legitimate explanations.");
  }
  if (/\b(pay (now|today|immediately|first)|rush (payment|deposit)|limited time deposit|deposit before (viewing|inspection)|send (a )?deposit (first|now)|no inspection before payment)\b/i.test(check.listingText)) {
    flag("payment_pressure", "caution", "Potential pressure to pay before verification", "The submitted advertisement uses payment-pressure language. Preserve the message and independently verify claims.");
  }
  if (/\b(guaranteed title|100% government approved|no need (for )?(lawyer|survey|verification)|no title search needed)\b/i.test(check.listingText)) {
    flag("unverified_claim", "attention", "Strong assurance in advertisement", "Marketing promises are not official evidence of title, ownership or allocation.");
  }
  if (history.propertyOtherAgent) flag("property_contact_difference", "attention", "Different agent identifiers in earlier checks", "Previous SafeKey submissions associated another agent identifier with matching supplied property details. Multiple legitimate agents may advertise one property.", "Previous SafeKey submissions (unverified)");
  if (history.listingOtherAgent) flag("listing_contact_difference", "attention", "Different contacts associated with this link", "Previous submissions used a different agent identifier for this listing link. Treat this as a question to investigate, not proof of duplication or fraud.", "Previous SafeKey submissions (unverified)");
  if (!check.address && !check.plot) flag("limited_location", "attention", "Property location is not specific", "A listing link or phone number cannot establish where a property exists.");
  if (!check.agentPhone) flag("missing_agent", "attention", "Agent identity not supplied", "Request the agent's verifiable professional credentials and authorization.");
  const elevated = findings.some(f => f.level === "caution");
  return {
    level: elevated ? "elevated_caution" : "unverified",
    heading: elevated ? "Important warning signs need investigation" : "Verification is still required",
    description: "This is an early-warning screen, not a title search, identity certification or transaction guarantee.",
    findings,
    checks: [
      { name: "Ownership and legal title", status: "Not checked", note: "Confirm at the relevant official land registry through an authorized professional." },
      { name: "Seller or agent authority", status: "Not checked", note: "Request identity, licensing evidence and written authorization; verify independently." },
      { name: "Physical property and boundaries", status: "Not checked", note: "Commission an independent visit and survey checks before payment." },
      { name: "Payment beneficiary", status: "Not checked", note: "Independently verify account ownership and any deposit-protection terms." }
    ],
    nextSteps: [
      "Do not pay solely because this screen shows few warnings.",
      "Request and independently verify ownership, title and seller authority.",
      "Use a qualified lawyer or surveyor for formal due diligence."
    ],
    disclaimer: "SafeKey does not connect to government land registries, verify professional licences, authenticate uploaded documents, or protect deposits in this pilot."
  };
}
