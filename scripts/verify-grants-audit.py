#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def need(ok, msg):
    if not ok:
        errors.append(msg)

def text(path):
    return (ROOT / path).read_text(encoding="utf-8")

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

need("address public awardRegistry" in programs, "program award-controller binding missing")
need("awardRegistry != address(0)" in programs, "award-controller one-time binding missing")
need("msg.sender != awardRegistry" in programs, "program award accounting is not controller-scoped")
need("programs.reserveAward(a.programId, amount)" in awards, "Award Registry does not update canonical program accounting")
need("function programAwarded(bytes32 programId)" in awards, "compatibility programAwarded getter missing")
need("|| !p.active" in awards.replace("\n", " "), "inactive programs can create new awards")

need("mapping(bytes32 => bytes32) public treasuryDisbursementMilestone" in milestones, "Treasury one-to-one binding map missing")
need("TreasuryDisbursementAlreadyBound" in milestones, "Treasury replay rejection missing")
need("a.state != GrantAwardRegistry420.State.ACTIVE" in milestones, "parent award state not enforced")
need("delete treasuryDisbursementMilestone" in milestones, "cancelled unexecuted Treasury binding cannot be released")
need("d.state == ITreasuryDisbursementGrant420.State.EXECUTED" in milestones, "executed Treasury payment can be hidden by cancellation")

need("CapabilityRegistry420" in authorization, "Capability Registry integration missing")
need("isProgramAuthorized" in authorization and "isAwardAuthorized" in authorization, "scoped capability checks missing")
need("canonicalId" in applications and "APPLICATION/V1" in applications, "application canonical identity missing")
need("GrantProgramRegistry420 public immutable programs" in router, "router program binding missing")
need("GrantAwardRegistry420 public immutable awards" in router, "router award binding missing")
need("GrantMilestoneRegistry420 public immutable milestones" in router, "router milestone binding missing")

for primitive in ("delegatecall", "selfdestruct", "tx.origin"):
    combined = "\n".join([programs, awards, milestones, applications, authorization, router])
    need(primitive not in combined, f"forbidden Grants primitive present: {primitive}")

need("testTreasuryDisbursementCannotPayTwoMilestones" in tests, "Treasury replay regression missing")
need("testCancelledAwardCannotApproveClaimedMilestone" in tests, "cancelled-award regression missing")
need("testProgramAndAwardCapsFailClosedAndAccountingAgrees" in tests, "program accounting regression missing")
need("testExecutedTreasuryPaymentCannotBeHiddenByMilestoneCancellation" in tests, "executed-payment cancellation regression missing")

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
rows = [x for x in dapp_map if isinstance(x, dict) and x.get("dapp") == "420 Grants"] if isinstance(dapp_map, list) else [
    x for x in dapp_map.get("dapps", []) if x.get("dapp") == "420 Grants"
]
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
