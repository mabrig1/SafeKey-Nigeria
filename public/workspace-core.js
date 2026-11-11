/**
 * SafeKey personal due-diligence workspace.
 * Independent original implementation. Session memory ONLY; no automatic
 * storage, server writes, network calls or legal verification claims.
 */
export const WORKSPACE_SCHEMA="safekey.due-diligence-workspace.v1";
export const WORKSPACE_KINDS=["land","house","rental"];
export const WORKSPACE_STATES=[
  ["not_started","Not started"],
  ["requested","Information requested"],
  ["records_received","Documents received (unverified)"],
  ["independent_review_reported","Independent review reported by buyer"]
];
export const REGISTRY_SOURCES={
  lagos:[
    {label:"Lagos State Land Administration Portal",url:"https://landonline.lagosstate.gov.ng/",
      purpose:"Property searches, land administration and applications; account or professional assistance may be required."},
    {label:"Lagos State Lands Bureau",url:"https://landsbureau.lagosstate.gov.ng/",
      purpose:"Government lands administration information and official contact channels."}
  ],
  fct:[
    {label:"Abuja Geographic Information Systems (AGIS)",url:"https://www.agis.fcta.gov.ng/services/",
      purpose:"FCT land records and verification services; follow the agency's current requirements."}
  ],
  enugu:[
    {label:"Enugu Geographic Information System (ENGIS)",url:"https://engis.enugustate.gov.ng/services",
      purpose:"Land title verification, search reports and related land services, subject to agency procedures."}
  ],
  other:[]
};
export const WORKSPACE_JURISDICTIONS=[
  ["lagos","Lagos State"],
  ["fct","Federal Capital Territory (Abuja)"],
  ["enugu","Enugu State"],
  ["other","Other Nigerian state"]
];
const STEP_DEFINITIONS=[
  {id:"seller_authority",kinds:["land","house","rental"],title:"Confirm seller or landlord authority",owner:"Independent lawyer",
    detail:"Ask who has legal authority to transact and whether an agent has written authorization.",
    evidence:"Identity and written authority; independent professional confirmation."},
  {id:"title_search",kinds:["land","house"],title:"Commission an official land-title search",owner:"Independent property lawyer",
    detail:"Check ownership, encumbrances, restrictions and chain of title using the appropriate official registry. A screenshot is not a certified search.",
    evidence:"Date-stamped official search result and professional written advice."},
  {id:"survey",kinds:["land","house"],title:"Confirm location, survey and boundaries",owner:"Independent registered surveyor",
    detail:"Compare the advertised site with beacons, survey references and physical boundaries.",
    evidence:"Surveyor's independent site findings and supporting survey documentation."},
  {id:"inspect",kinds:["land","house","rental"],title:"Arrange an independent physical inspection",owner:"Buyer and independent inspector",
    detail:"Confirm the address, occupancy, property condition and existence before sending money.",
    evidence:"Dated inspection notes and permission-based photographs."},
  {id:"beneficiary",kinds:["land","house","rental"],title:"Validate proposed payment instructions",owner:"Buyer with independent lawyer",
    detail:"Confirm who receives funds and why. Never rely only on a WhatsApp message or matching account name.",
    evidence:"Written, independently reconfirmed payment instructions; no transfer until checks finish."},
  {id:"contract",kinds:["land","house","rental"],title:"Review contractual terms",owner:"Independent lawyer",
    detail:"Confirm parties, property description, obligations, fees, refund terms and conditions precedent.",
    evidence:"Reviewed agreement and dated written advice before signing."},
  {id:"dispute",kinds:["land","house"],title:"Investigate acquisition and dispute risks",owner:"Independent lawyer / surveyor",
    detail:"Check whether government acquisition, litigation, third-party claims or planning restrictions may affect the land.",
    evidence:"Current registry enquiries, legal findings and relevant planning responses."},
  {id:"planning",kinds:["land","house"],title:"Check intended use and planning constraints",owner:"Planning professional / local authority",
    detail:"Confirm that proposed development or occupation is permitted; land title alone does not establish planning approval.",
    evidence:"Relevant planning information and written professional advice."},
  {id:"rent_terms",kinds:["rental"],title:"Verify tenancy terms and deposits",owner:"Tenant / independent adviser",
    detail:"Check the actual landlord, occupancy rights, written tenancy terms, fees, deposit conditions and receipts.",
    evidence:"Written tenancy agreement, fee breakdown and landlord authority documentation."},
  {id:"rent_possession",kinds:["rental"],title:"Confirm access and occupancy arrangements",owner:"Tenant / independent inspector",
    detail:"Check who occupies the property, when possession begins and how keys will be transferred.",
    evidence:"Dated viewing record and written handover terms."}
];
const STATES=new Set(WORKSPACE_STATES.map(s=>s[0]));
const KINDS=new Set(WORKSPACE_KINDS);
const JURISDICTIONS=new Set(WORKSPACE_JURISDICTIONS.map(s=>s[0]));
export function templatesFor(kind){
  if(!KINDS.has(kind))throw Error("Select land, house or rental.");
  return STEP_DEFINITIONS.filter(s=>s.kinds.includes(kind))
    .map(({id,title,owner,detail,evidence})=>({id,title,owner,detail,evidence}));
}
export function createWorkspace(kind="land",jurisdiction="other",now=new Date().toISOString()){
  if(!JURISDICTIONS.has(jurisdiction))throw Error("Unknown jurisdiction.");
  return {
    schema:WORKSPACE_SCHEMA,kind,jurisdiction,createdAt:now,updatedAt:now,
    steps:templatesFor(kind).map(s=>({id:s.id,status:"not_started",note:""}))
  };
}
export function validateWorkspace(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.schema!==WORKSPACE_SCHEMA)
    throw Error("This file is not a supported SafeKey due-diligence workspace.");
  if(!KINDS.has(raw.kind)||!JURISDICTIONS.has(raw.jurisdiction))
    throw Error("Unsupported property type or state.");
  const expected=templatesFor(raw.kind).map(x=>x.id);
  if(!Array.isArray(raw.steps)||raw.steps.length!==expected.length)
    throw Error("The checklist does not match the selected property type.");
  const seen=new Set();
  const steps=raw.steps.map(step=>{
    if(!step||typeof step!=="object"||Array.isArray(step)||typeof step.id!=="string"
       ||seen.has(step.id)||!expected.includes(step.id)||!STATES.has(step.status)
       ||typeof step.note!=="string"||step.note.length>240)
      throw Error("A checklist item has invalid or unsupported content.");
    seen.add(step.id);
    return {id:step.id,status:step.status,note:step.note};
  });
  const iso=value=>typeof value==="string"&&value.length<=35 &&
    !Number.isNaN(Date.parse(value))&&/^\d{4}-\d{2}-\d{2}T/.test(value);
  if(!iso(raw.createdAt)||!iso(raw.updatedAt))
    throw Error("The workspace dates are invalid.");
  return {
    schema:WORKSPACE_SCHEMA,kind:raw.kind,jurisdiction:raw.jurisdiction,
    createdAt:raw.createdAt,updatedAt:raw.updatedAt,
    steps:expected.map(id=>steps.find(x=>x.id===id))
  };
}
export function updateStep(workspace,id,status,note,now=new Date().toISOString()){
  const clean=validateWorkspace(workspace);
  if(!STATES.has(status))throw Error("Unknown progress status.");
  if(typeof note!=="string"||note.length>240)throw Error("Notes cannot exceed 240 characters.");
  const step=clean.steps.find(s=>s.id===id);
  if(!step)throw Error("Unknown checklist item.");
  step.status=status;step.note=note;
  clean.updatedAt=now;
  return validateWorkspace(clean);
}
export function workspaceSummary(workspace){
  const clean=validateWorkspace(workspace);
  return {
    total:clean.steps.length,
    started:clean.steps.filter(s=>s.status!=="not_started").length,
    independentReviewReported:clean.steps.filter(s=>s.status==="independent_review_reported").length,
    safeToPay:false,
    note:"Statuses are self-reported and are NOT verified by SafeKey. No checklist completion authorizes payment."
  };
}
export function registryLinks(jurisdiction){
  if(!JURISDICTIONS.has(jurisdiction))throw Error("Unknown jurisdiction.");
  return REGISTRY_SOURCES[jurisdiction].map(r=>({...r}));
}
