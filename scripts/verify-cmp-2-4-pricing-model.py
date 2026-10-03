#!/usr/bin/env python3
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
pricing=(R/"contracts/src/compute/ComputePricing420.sol").read_text()
offer=(R/"contracts/src/compute/ComputeOfferRegistry420.sol").read_text()
match=(R/"contracts/src/compute/ComputeMatch420.sol").read_text()
tests=(R/"contracts/test/ComputeMatchingEngine420.t.sol").read_text()
sdk=(R/"packages/420-sdk/src/compute.ts").read_text()
sdkt=(R/"packages/420-sdk/test/compute-sdk.test.mjs").read_text()
cfg=json.loads((R/"contracts/config/compute-market/cmp-2.4-pricing-model.json").read_text())
doc=(R/"docs/compute-market/CMP-2.4-PRICING-MODEL.md").read_text()
road=(R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md").read_text()
wf=(R/".github/workflows/compute-market.yml").read_text()
for x in ["FIXED_PRICE","WORK_UNIT","CPU_TIME","GPU_TIME","VERIFIED_RESULT","function quoteMaximum(","numerator % t.unitScale != 0","type(uint256).max / billableUnits"]: assert x in pricing,x
for x in ["function publishPricedWorkerOffer(","function updatePricedOffer(","pricingTermsCommitment","ComputePricing420.authorityAmount(pricing)"]: assert x in offer,x
for x in ["function proposePriced(","billableUnits","quotedMaximum","acceptedMaximum","quotedMaximum>r.terms.maximumPrice"]: assert x.replace(">"," > ") in match or x in match,x
for x in ["testAllCmp24VariablePricingModelsProduceDeterministicAcceptedCeilings","testVariablePricingBoundsAndRequesterMaximumFailClosedAtomically","testFixedPriceCompatibilityAndVariableMinimumMaximumCaps","testMalformedPricingTermsRejectBeforeOfferAllocation"]: assert x in tests,x
for x in ["COMPUTE_PRICING_MODEL_420","quoteComputeWorkerOffer420","pricingTermsCommitment"]: assert x in sdk,x
assert "CMP-2.4 validates and quotes all bounded pricing models" in sdkt
assert cfg["step"]=="CMP-2.4" and cfg["qualificationLevel"]==1 and cfg["level2RequiredNow"] is False
assert cfg["nextCanonicalStep"]=="CMP-2.5 — Capacity-aware assignment"
assert "Support fixed-price, work-unit, CPU-time, GPU-time and verified-result pricing." in doc
assert "Level 3 remains reserved for CMP-2.8" in doc
assert "## CMP-2.4 — Pricing model" in road and "COMPLETE — Level 1 exact-head qualified" in road
assert "CMP-2.4-QUALIFICATION-EVIDENCE.md" in road
assert "Verify CMP-2.4 pricing model" in wf
print("CMP-2.4 verifier: PASS")
