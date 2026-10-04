#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def need(ok, msg):
    if not ok:
        errors.append(msg)

def text(path):
    return (ROOT / path).read_text(encoding="utf-8")

def normalized(source):
    return " ".join(source.split())

def enum_members(source, enum_name):
    match = re.search(rf"enum\\s+{re.escape(enum_name)}\\s*\\{{([^}}]+)\\}}", source, flags=re.S)
    if not match:
        return None
    return [item.strip() for item in match.group(1).split(",") if item.strip()]

def struct_fields(source, struct_name):
    match = re.search(rf"struct\\s+{re.escape(struct_name)}\\s*\\{{([^}}]+)\\}}", source, flags=re.S)
    if not match:
        return None
    return [" ".join(item.strip().split()) for item in match.group(1).split(";") if item.strip()]

cfg = json.loads(text("contracts/config/420grants-genesis.json"))
need(cfg.get("schema") == "420-grants-genesis-v1", "unexpected Grants genesis schema")
need(cfg.get("class") == "GENESIS_IMPLEMENTATION_PROTOCOL", "Grants public/protocol classification drift")
need(cfg.get("publicStandaloneApplication") is False, "Grants must not invent a standalone Genesis app requirement")

required_contracts = {
    "GrantIds420.sol",
    "GrantAuthorization420.sol",
    "GrantProgramRegistry420.sol",
    "GrantApplicationRegistry420.sol",
    "GrantAwardRegistry420.sol",
    "GrantMilestoneRegistry420.sol",
    "GrantRouter420.sol",
}
need(set(cfg.get("contracts", [])) == required_contracts, "Grants contract inventory drift")

for name in required_contracts:
    need((ROOT / "contracts/src/grants" / name).is_file(), f"missing Grants source: {name}")

programs = text("contracts/src/grants/GrantProgramRegistry420.sol")
awards = text("contracts/src/grants/GrantAwardRegistry420.sol")
milestones = text("contracts/src/grants/GrantMilestoneRegistry420.sol")
applications = text("contracts/src/grants/GrantApplicationRegistry420.sol")
authorization = text("contracts/src/grants/GrantAuthorization420.sol")
router = text("contracts/src/grants/GrantRouter420.sol")
tests = text("contracts/test/GrantsGenesis420.t.sol")
arch = text("docs/architecture/protocols/stake-governance-treasury-grants.md")
wallet_cfg = text("contracts/config/420wallet-genesis.json")
treasury_disbursements = text("contracts/src/treasury/TreasuryDisbursementRegistry420.sol")
system_access = text("contracts/src/system/SystemAccess.sol")

need("address public awardRegistry" in programs, "program award-controller binding missing")
need("awardRegistry != address(0)" in programs, "award-controller one-time binding missing")
need("msg.sender != awardRegistry" in programs, "program award accounting is not controller-scoped")
need("programs.reserveAward(a.programId, amount)" in awards, "Award Registry does not update canonical program accounting")
need("function programAwarded(" in awards and "bytes32 programId" in awards, "compatibility programAwarded getter missing")
need("applicationAwarded" in awards and "ApplicationAwardCapExceeded" in awards, "cumulative application award cap missing")
need("|| !p.active" in awards.replace("\n", " "), "inactive programs can create new awards")

need("mapping(bytes32 => bytes32) public treasuryDisbursementMilestone" in milestones, "Treasury one-to-one binding map missing")
need("milestoneOrdinalUsed" in milestones, "milestone ordinal replay protection missing")
need("TreasuryDisbursementAlreadyBound" in milestones, "Treasury replay rejection missing")
need("a.state != GrantAwardRegistry420.State.ACTIVE" in milestones, "parent award state not enforced")
need("delete treasuryDisbursementMilestone" in milestones, "cancelled Treasury binding cannot be released")
need("d.state != ITreasuryDisbursementGrant420.State.CANCELLED" in milestones, "Grants can detach from a still-executable Treasury payment")
need("milestoneTotal[m.awardId] -= m.amount" in milestones, "cancelled milestone capacity is not released")

need(enum_members(milestones, "State") == enum_members(treasury_disbursements, "State"), "Grants Treasury state enum drift")
need(
    struct_fields(milestones, "Disbursement") == struct_fields(treasury_disbursements, "Disbursement"),
    "Grants Treasury disbursement view drift",
)
need("function disbursement(" in milestones and "returns (Disbursement memory)" in milestones, "Treasury disbursement getter view missing")
milestones_norm = normalized(milestones)
need("d.state != ITreasuryDisbursementGrant420.State.SCHEDULED" in milestones, "Treasury scheduled-state approval gate missing")
for field_check in (
    "d.budgetId != p.treasuryBudgetId",
    "d.recipient != a.recipient",
    "d.amount != m.amount",
    "d.civicActionHash != p.civicActionHash",
    "d.purposeHash != m.purposeHash",
):
    need(field_check in milestones, f"Treasury canonical binding check missing: {field_check}")
need(
    "d.state != ITreasuryDisbursementGrant420.State.EXECUTED || d.vaultReleaseHash == bytes32(0)" in milestones_norm,
    "PAID finalization no longer requires executed Treasury plus Vault release commitment",
)

need("address public immutable governanceTimelock" in system_access, "SystemAccess governance timelock binding missing")
need("msg.sender != governanceTimelock" in system_access, "SystemAccess no longer gates directly on GovernanceTimelock")
for source_name, source in (("programs", programs), ("awards", awards), ("milestones", milestones)):
    need("SystemAccess" in source, f"{source_name} no longer inherits governance access control")
for required_gate in (
    "function bindAwardRegistry",
    "function createProgram",
    "function setActive",
):
    start = programs.find(required_gate)
    need(start >= 0 and "onlyGovernance" in programs[start:start + 300], f"program governance gate missing: {required_gate}")
for required_gate in ("function createAward", "function cancel", "function markCompleted"):
    start = awards.find(required_gate)
    need(start >= 0 and "onlyGovernance" in awards[start:start + 300], f"award governance gate missing: {required_gate}")
for required_gate in ("function createMilestone", "function approve", "function cancel"):
    start = milestones.find(required_gate)
    need(start >= 0 and "onlyGovernance" in milestones[start:start + 350], f"milestone governance gate missing: {required_gate}")

need("CapabilityRegistry420" in authorization, "Capability Registry integration missing")
need("isProgramAuthorized" in authorization and "isAwardAuthorized" in authorization, "scoped capability checks missing")
authorization_norm = normalized(authorization)
need("GrantIds420.COMPONENT_GRANTS, actionId, scopeProgram(programId), 0" in authorization_norm, "program capability is not component/action/program-scope bound")
need("GrantIds420.COMPONENT_GRANTS, actionId, scopeAward(awardId), 0" in authorization_norm, "award capability is not component/action/award-scope bound")
need("canonicalId" in applications and "APPLICATION/V1" in applications, "application canonical identity missing")
need("applicationNonceUsed" in applications and "ApplicationNonceUsed" in applications, "application nonce replay protection missing")
need("GrantProgramRegistry420 public immutable programs" in router, "router program binding missing")
need("GrantAwardRegistry420 public immutable awards" in router, "router award binding missing")
need("GrantMilestoneRegistry420 public immutable milestones" in router, "router milestone binding missing")

combined_grants = "\n".join([programs, awards, milestones, applications, authorization, router])
for custody_primitive in ("payable", ".transfer(", ".send(", ".call{value", "IERC20", "IVault"):
    need(custody_primitive not in combined_grants, f"Grants custody/transfer primitive present: {custody_primitive}")

for primitive in ("delegatecall", "selfdestruct", "tx.origin"):
    combined = "\n".join([programs, awards, milestones, applications, authorization, router])
    need(primitive not in combined, f"forbidden Grants primitive present: {primitive}")

need("wrong program scope accepted" in tests, "application wrong-program-scope regression missing")
need("wrong application action accepted" in tests, "application wrong-action regression missing")
need("testGovernanceMutationsRejectNonTimelockCaller" in tests, "non-timelock governance mutation regression missing")
need("testApplicationNonceCannotBeReusedWithDifferentContent" in tests, "application nonce replay regression missing")
need("testApplicationCannotBeOverAwardedAcrossMultipleAwards" in tests, "application cumulative-award regression missing")
need("testTreasuryDisbursementCannotPayTwoMilestones" in tests, "Treasury replay regression missing")
need("testCancelledAwardCannotApproveClaimedMilestone" in tests, "cancelled-award regression missing")
need("testProgramAndAwardCapsFailClosedAndAccountingAgrees" in tests, "program accounting regression missing")
need("testExecutedTreasuryPaymentCannotBeHiddenByMilestoneCancellation" in tests, "executed-payment cancellation regression missing")
need("testApprovedMilestoneRequiresTreasuryCancellationBeforeGrantCancellation" in tests, "Treasury-first cancellation regression missing")
need("testMilestoneOrdinalCannotBeReusedAndCancelledCapacityCanBeReplaced" in tests, "milestone ordinal/capacity regression missing")
need("testPerAwardCapFailsClosed" in tests, "explicit per-award cap boundary regression missing")
need("testTreasuryBindingRejectsEveryCanonicalFieldMismatch" in tests, "Treasury canonical-field mismatch matrix missing")
need("testMilestoneDelegationIsDefaultDenyAndScopeBound" in tests, "milestone delegated capability boundary regression missing")

need("420 Grants" in arch and "Treasury" in arch and "Vault" in arch, "canonical architecture coverage missing")
need("420 Grants" in wallet_cfg, "Wallet Genesis inventory no longer recognizes Grants")

namespace = json.loads(text("contracts/config/genesis-address-namespace.json"))
entries = [x for x in namespace.get("assignments", []) if x.get("id") == "grants-router"]
if not entries:
    # current schema may use a differently named array; scan top-level list values.
    entries = []
    for value in namespace.values():
        if isinstance(value, list):
            entries.extend(x for x in value if isinstance(x, dict) and x.get("id") == "grants-router")
need(len(entries) == 1, "canonical Grants router namespace entry missing/duplicated")
if entries:
    need(entries[0].get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "Grants router address model drift")

dapp_map = json.loads(text("contracts/config/genesis-dapp-contract-map.json"))
if isinstance(dapp_map, list):
    dapp_rows = dapp_map
else:
    dapp_rows = dapp_map.get("apps", dapp_map.get("dapps", []))
rows = [x for x in dapp_rows if isinstance(x, dict) and x.get("dapp") == "420 Grants"]
need(len(rows) == 1, "420 Grants dApp-map row missing/duplicated")
if rows:
    need(set(rows[0].get("contracts", [])) == required_contracts, "420 Grants dApp-map contract inventory drift")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

print(json.dumps({
    "pass": True,
    "suite": "420Grants audit model",
    "contracts": sorted(required_contracts),
    "address_model": "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
    "standalone_public_app": False,
}, indent=2))
