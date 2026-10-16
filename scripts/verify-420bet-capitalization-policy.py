#!/usr/bin/env python3
"""Static fail-closed preflight for proposed 420Bet capitalization policy.

This validates canonical source conservation and policy consistency only.
It does NOT authorize transfer of Genesis funds or attest an on-chain profit waterfall.
"""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT/path).read_text())
p=read("contracts/config/420bet-capitalization-profit-waterfall-v1.json")
g=read("config/genesis-allocations.json")
r=read("contracts/config/application-revenue-policy-v1.json")
alloc={x["id"]:x for x in g["allocations"]}
assert g["genesis_supply_420"] == 42_000_000
assert sum(x["amount_420"] for x in g["allocations"]) == g["genesis_supply_420"]
assert int(g["genesis_supply_kief"]) == g["genesis_supply_420"]*10**18
assert p["funding"]["sourceAllocationId"]=="protocol-reserve"
assert alloc["protocol-reserve"]["amount_420"]==int(p["funding"]["sourceGenesisAmount420"])
assert alloc["protocol-reserve"]["destination"].lower()=="0x0000000000000000000000000000000000000424"
earmark=int(p["funding"]["earmarkAmount420"])
assert earmark==1_000_000
assert int(p["funding"]["remainderAvailableForOtherProtocolReservePurposes420"])+earmark==alloc["protocol-reserve"]["amount_420"]
assert int(p["funding"]["genesisTotalUnchanged420"])==g["genesis_supply_420"]
assert p["funding"]["token"]=="native-$420"
assert p["funding"]["noFounderValidatorCommunityRewardOrDevelopmentBootstrapDiversion"] is True
assert p["repayment"]["destinationKind"]=="GOVERNED_COMMUNITY_TREASURY_VAULT"
assert p["repayment"]["destinationVaultId"] is None, "Cannot invent authorized community vault"
assert p["repayment"]["destinationResolution"].startswith("BLOCK_")
assert p["repayment"]["disallowTokenCreationFeeVaultSubstitution"] is True
assert p["repayment"]["neverUseCustomerEscrowOrLPPrincipal"] is True
assert int(p["repayment"]["cumulativeRepaymentCap420"])==earmark
d=p["developerCompensation"]
assert d["governingPolicyId"]==r["policyId"]
assert d["beneficiaryId"]==r["developmentCompensation"]["beneficiaryId"]
assert d["developerBps"]==r["defaultCommercialSplitBps"]["leadDeveloperCompensation"]==1000
assert d["developerBps"]<=r["developmentCompensation"]["maxBpsV1"]
assert d["applyCanonicalFullSplitBps"]==r["defaultCommercialSplitBps"]
assert sum(d["applyCanonicalFullSplitBps"].values())==10000
assert d["epochRule"]=="RESERVE_AT_NEXT_EPOCH_START_FROM_PREVIOUS_FINALIZED_EPOCH_ELIGIBLE_NET_PROTOCOL_REVENUE"
assert d["noForecastPrefunding"] and d["doNotDeductFromPrincipalOrEscrow"]
assert d["zeroEligibleRevenueMeansZeroCompensation"]
assert d["avoidDoubleCountingStakeAndPrincipalRepayment"]
assert p["enforcement"]["status"]=="REQUIRES_ON_CHAIN_INTEGRATION_AND_TESTS_BEFORE_FUNDS_MOVE"
assert p["enforcement"]["noTransfersOrPublicWagerAcceptanceUntilReconciliation"]
print("PASS: 420Bet capitalization policy; 42M conserved, 1M earmarked, 10% net-revenue ceiling, community destination fail-closed")
