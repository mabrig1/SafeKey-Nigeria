import { normalizeIdentity, normalizePhone, normalizeListingUrl, tidy } from "./risk.js";

/**
 * Independent comparison logic inspired by the NORMALIZE -> COMPARE approach,
 * not copied from any third-party repository.
 *
 * All content is buyer-supplied. URLs are parsed, NEVER fetched. No records
 * or identifiers are persisted. No score, verification claim or fraud verdict.
 */
const FIELDS = Object.freeze({
  area: 90, address: 220, plot: 100, listingUrl: 500,
  agentPhone: 35, advertiserName: 100, paymentName: 100,
  priceNgn: 32
});
function parseSide(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { error: name + " must be a property listing." };
  const result = {};
  for (const [field, limit] of Object.entries(FIELDS)) {
    if (value[field] !== undefined && typeof value[field] !== "string" && typeof value[field] !== "number")
      return { error: name + ": " + field + " must be text." };
    if (typeof value[field] === "string" && value[field].length > limit)
      return { error: name + ": " + field + " is too long." };
    result[field] = tidy(String(value[field] ?? ""), limit);
  }
  if (!result.listingUrl && !result.address && !result.plot)
    return { error: name + " needs a listing URL, property address or plot reference." };
  const url = normalizeListingUrl(result.listingUrl);
  if (url === null) return { error: name + " needs an HTTP or HTTPS listing URL without credentials." };
  const phone = normalizePhone(result.agentPhone);
  const moneyString = result.priceNgn.replace(/[\s,₦]/g, "");
  let price = null;
  if (moneyString) {
    if (!/^\d{1,12}$/.test(moneyString) || Number(moneyString) < 1)
      return { error: name + ": enter a valid positive price in naira, without decimals." };
    price = Number(moneyString);
  }
  return { value: {
    ...result,
    url,
    phone,
    price,
    areaKey: normalizeIdentity(result.area),
    addressKey: normalizeIdentity(result.address),
    plotKey: normalizeIdentity(result.plot),
    advertiserKey: normalizeIdentity(result.advertiserName),
    paymentKey: normalizeIdentity(result.paymentName)
  }};
}

export function compareListings(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Enter two listings to compare." };
  const a = parseSide(body.first, "Listing A");
  if (a.error) return a;
  const b = parseSide(body.second, "Listing B");
  if (b.error) return b;
  const first = a.value, second = b.value;
  const signals = [];
  const add = (code, title, explanation, priority = "review") => {
    signals.push({ code, title, explanation, priority, source: "Two buyer-supplied listings (unverified)" });
  };
  const areaMatches = !!first.areaKey && first.areaKey === second.areaKey;
  const addressMatches = areaMatches && !!first.addressKey && first.addressKey === second.addressKey;
  const plotMatches = areaMatches && !!first.plotKey && first.plotKey === second.plotKey;
  const sameUrl = !!first.url && first.url === second.url;
  const possibleMatch = addressMatches || plotMatches;
  let matchBasis = "not_established";
  if (addressMatches && plotMatches) matchBasis = "same_address_and_plot_text";
  else if (addressMatches) matchBasis = "same_address_text";
  else if (plotMatches) matchBasis = "same_plot_text";
  if (sameUrl) add("same_listing_url", "The same listing link was submitted twice",
    "Two copies of one link are not independent confirmation of an offer.", "information");
  if (!possibleMatch) {
    add("identity_unconfirmed", "The two advertisements could not be linked to one property",
      "Their supplied area/address/plot references do not provide a sufficiently specific exact match. Do not treat unrelated listings as duplicates.", "information");
  } else {
    add("property_reference_match", "Property references have matching text",
      "The same buyer-entered area and address or plot reference appears in both submissions. This is not independent evidence that the actual property exists.", "information");
    if (first.price != null && second.price != null && first.price !== second.price) {
      add("price_difference", "Advertised prices differ",
        "The amounts differ between the two submissions. Ask both advertisers about dates, terms, and what is included; prices may legitimately change.");
    }
    if (first.phone && second.phone && first.phone !== second.phone) {
      add("agent_contact_difference", "Different agent contact numbers",
        "Different numbers are associated with the matching textual reference. More than one authorized agent may represent the property.");
    }
    if (first.advertiserKey && second.advertiserKey && first.advertiserKey !== second.advertiserKey) {
      add("advertiser_name_difference", "Advertiser names differ",
        "Request evidence of each advertiser's authorization. Different names alone do not show fraud.");
    }
    if (first.paymentKey && second.paymentKey && first.paymentKey !== second.paymentKey) {
      add("payment_name_difference", "Proposed payment recipients differ",
        "Do not transfer money until the recipient and written payment instructions are independently verified.");
    }
    if (plotMatches && first.addressKey && second.addressKey && first.addressKey !== second.addressKey) {
      add("address_difference", "Different street or estate descriptions",
        "Even when plot text matches, identical plot numbers can exist in different places. Verify cadastral references and physical boundaries.");
    }
    if (addressMatches && first.plotKey && second.plotKey && first.plotKey !== second.plotKey) {
      add("plot_difference", "Different plot or unit references",
        "The supplied plot or unit references differ; ask for survey plans and independent confirmation.");
    }
  }
  return {
    status: "comparison_only",
    possibleMatch, matchBasis, signals, comparisonDate: new Date().toISOString(),
    source: "Information entered by the user. No listing websites or registry records were accessed.",
    retained: false,
    guidance: [
      "Request independent confirmation of the legal title and seller's authority.",
      "Ask each advertiser to explain differences and provide dated written evidence.",
      "Never pay based only on matching listing descriptions or an absence of warnings."
    ],
    disclaimer: "Comparison is not a fraud finding, legal opinion, title validation, or guarantee. Listings were not fetched or authenticated."
  };
}
