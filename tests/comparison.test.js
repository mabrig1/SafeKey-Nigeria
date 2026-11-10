import test from "node:test";
import assert from "node:assert/strict";
import { compareListings } from "../src/comparison.js";

const base={
  area:"Lekki, Lagos",address:"12 Fictional Avenue",plot:"Block A Plot 4",
  listingUrl:"https://example.com/property/123",
  agentPhone:"08031234567",advertiserName:"Advertiser One",
  paymentName:"Recipient A",priceNgn:"₦25,000,000"
};

test("same property text prompts cautious comparison, never a fraud verdict",()=>{
  const result=compareListings({
    first:base,
    second:{...base,
      listingUrl:"https://other.example/listing/2",
      agentPhone:"08061234567",
      paymentName:"Recipient B",
      priceNgn:"28000000"}
  });
  assert.equal(result.status,"comparison_only");
  assert.equal(result.possibleMatch,true);
  assert.equal(result.matchBasis,"same_address_and_plot_text");
  const codes=result.signals.map(x=>x.code);
  assert.ok(codes.includes("agent_contact_difference"));
  assert.ok(codes.includes("payment_name_difference"));
  assert.ok(codes.includes("price_difference"));
  assert.ok(codes.includes("property_reference_match"));
  assert.equal(result.retained,false);
  assert.match(result.disclaimer,/not a fraud finding/i);
  assert.equal(Object.hasOwn(result,"trustScore"),false);
});

test("unrelated locations are not flagged as duplicate agents or price differences",()=>{
  const result=compareListings({
    first:base,second:{...base,
      area:"A different city",
      address:"No matching address",plot:"Different plot",
      agentPhone:"08061234567",priceNgn:"10000000"}
  });
  assert.equal(result.possibleMatch,false);
  assert.deepEqual(result.signals.map(x=>x.code),["identity_unconfirmed"]);
});

test("matching link is not presented as independent supporting evidence",()=>{
  const result=compareListings({first:base,second:{
    listingUrl:"https://EXAMPLE.com/property/123?ref=campaign#photos",
    address:"A different city",area:"Ikeja"}
  });
  assert.ok(result.signals.some(x=>x.code==="same_listing_url"));
  assert.equal(result.possibleMatch,false);
});

test("matching plot reference in same area can flag conflicting address text",()=>{
  const result=compareListings({first:base,second:{...base,
    address:"Other Estate",listingUrl:"https://other.example/listing"}});
  assert.equal(result.possibleMatch,true);
  assert.equal(result.matchBasis,"same_plot_text");
  assert.ok(result.signals.some(x=>x.code==="address_difference"));
});

test("reject malformed URL, invalid money or missing location reference",()=>{
  assert.match(compareListings({first:{...base,listingUrl:"file:///etc/passwd"},second:base}).error,/HTTP or HTTPS/);
  assert.match(compareListings({first:{...base,priceNgn:"-120"},second:base}).error,/price/);
  assert.match(compareListings({first:{area:"Lagos",agentPhone:"08031234567"},second:base}).error,/needs a listing URL/);
});

test("reject oversized fields without silently truncating comparisons",()=>{
  assert.match(compareListings({first:{...base,address:"x".repeat(221)},second:base}).error,/too long/);
});

test("no buyer-submitted agent or payment names are echoed into the result",()=>{
  const result=compareListings({first:base,second:{...base,
    paymentName:"Secret Person Name",agentPhone:"08061234567"}});
  const body=JSON.stringify(result);
  assert.equal(body.includes("Secret Person Name"),false);
  assert.equal(body.includes("08061234567"),false);
});
