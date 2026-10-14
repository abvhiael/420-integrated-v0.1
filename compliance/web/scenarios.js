/* C06.3 informational scenario model. No policy evaluator or authorization API. */
(function (root) {
  "use strict";
  const choices = Object.freeze({
    jurisdiction: Object.freeze(["federal", "british-columbia", "vancouver", "other", "unknown"]),
    topic: Object.freeze(["product", "delivery", "business", "travel"]),
    actor: Object.freeze(["retailer", "employee", "common-carrier", "independent-courier", "traveller", "unknown"]),
    stage: Object.freeze(["planning", "pickup", "handover", "return", "crossing"]),
    evidence: Object.freeze(["unavailable", "self-reported", "claimed-authenticated"])
  });
  const base = Object.freeze([
    "Current law and source freshness have not been independently confirmed.",
    "No reviewed policy version, effective period or change history is published for this preview.",
    "Applicable federal, provincial, municipal and Indigenous authority needs independent review.",
    "Individual licence conditions and site or venue permissions remain unresolved.",
    "The public page cannot validate credentials, identity, permissions or authenticated evidence.",
    "A regulated action needs a fresh authenticated evaluation bound to its actor, operation and stage; this page cannot provide one."
  ]);
  const topicGuidance = Object.freeze({
    product: Object.freeze(["Check the operative product, packaging and promotion instruments and the exact product category.", "Source titles and product tags do not prove that a product or sale is permitted."]),
    delivery: Object.freeze(["Identify who is carrying the product and which delivery arrangement is being considered.", "A retailer employee, common carrier and independent courier can have different requirements; one role's permission cannot be transferred to another."]),
    business: Object.freeze(["Check each business permission separately, including retailer, courier and municipal requirements.", "A listed source or retailer licence does not establish permission for a separate business."]),
    travel: Object.freeze(["Review the rules for the origin, destination and any border or venue involved.", "Travel information, policy coverage and courier availability are separate; none establishes permission to buy, carry or receive cannabis."])
  });
  const actorQuestions = Object.freeze({
    retailer: "The retailer's current issuer-specific licence, conditions and applicable business permissions have not been validated.",
    employee: "The employment relationship, retailer authorization and employee-specific duties have not been validated.",
    "common-carrier": "Carrier classification, contract, custody duties and any carrier-specific restrictions have not been independently reviewed.",
    "independent-courier": "Independent courier classification and separate business/licence permissions have not been independently reviewed.",
    traveller: "Personal possession, destination, border and venue requirements have not been independently reviewed.",
    unknown: "The relevant actor or carrier class is unknown; requirements cannot be resolved by guessing."
  });
  const stageQuestions = Object.freeze({
    planning: "Planning information does not establish readiness to accept an order or begin an operation.",
    pickup: "Pickup/dispatch requires current operation-specific authorization and custody evidence; no such evidence is checked here.",
    handover: "Handover requires a new stage-specific check, recipient evidence and current policy; a prior pickup result is insufficient.",
    return: "Refusal, safe custody and return need a separately reviewed recovery workflow; a sale halt does not grant return permission.",
    crossing: "Crossing a provincial, national or uncertain authority boundary requires separate review; permission cannot be carried across by assumption."
  });
  function unknown() {
    return {status: "INFORMATION_UNAVAILABLE", eligibility_assessed: false, legal_authorization: false,
      guidance: ["Choose a supported hypothetical scenario. No permission is established."],
      unresolved: [...base, "The selected scenario is missing, unsupported or malformed."], sourcePages: []};
  }
  function explain(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.keys(input).length !== Object.keys(choices).length ||
        Object.keys(input).some(key => !Object.hasOwn(choices, key)) ||
        Object.entries(choices).some(([key, values]) => !values.includes(input[key]))) return unknown();
    const unresolved = [...base, actorQuestions[input.actor], stageQuestions[input.stage]];
    if (input.jurisdiction === "other" || input.jurisdiction === "unknown") {
      unresolved.push("This region is outside the discovery catalogue or is unknown. No local rules or precise geographic applicability are established.");
    } else {
      unresolved.push("The chosen region is a broad discovery label, not proof that an address, boundary or service zone is within an approved jurisdiction.");
    }
    if (input.evidence === "claimed-authenticated") {
      unresolved.push("Selecting 'authenticated evidence exists' is a public claim only. This page does not authenticate it, inspect a receipt or verify expiry/revocation.");
    } else if (input.evidence === "self-reported") {
      unresolved.push("Self-reported facts or credentials cannot satisfy mandatory authenticated evidence.");
    } else {
      unresolved.push("Required authenticated evidence is unavailable; no regulated action can be inferred to be authorized.");
    }
    const sourcePages = [];
    if (input.jurisdiction !== "other" && input.jurisdiction !== "unknown") {
      sourcePages.push({href: "./rule-federal-product.html", label: "Federal product source discovery"});
      if (input.jurisdiction !== "federal") {
        sourcePages.push({href: input.topic === "travel" ? "./rule-bc-travel.html" : "./rule-bc-delivery.html",
          label: input.topic === "travel" ? "BC travel source discovery" : "BC delivery source discovery"});
      }
      if (input.jurisdiction === "vancouver") sourcePages.push({href: "./rule-vancouver-business.html", label: "Vancouver business source discovery"});
    }
    return {status: "INFORMATION_ONLY", eligibility_assessed: false, legal_authorization: false,
      guidance: [...topicGuidance[input.topic], "Read the linked sources and unresolved requirements. The current preview has no published reviewed rules."],
      unresolved, sourcePages};
  }
  const api = Object.freeze({explain, choices});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ComplianceScenarios = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
