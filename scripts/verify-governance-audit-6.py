#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/governance-deployment-v1.json"
FOUNDRY = ROOT / "contracts/foundry.toml"
SYSTEM = ROOT / "config/system-addresses.json"
CANON = ROOT / "contracts/config/genesis-canonical-addresses.json"
STORAGE = ROOT / "contracts/config/predeploy/storage-init.json"

CIVIC = [
    "CivicConstitution420",
    "CivicProposalRegistry420",
    "CivicElectorateRegistry420",
    "CivicVoting420",
    "CivicGovernor420",
]
EXPECTED_PREIMAGES = {
    "CivicConstitution420": "420/component/governance/civic-constitution/v1",
    "CivicProposalRegistry420": "420/component/governance/civic-proposal-registry/v1",
    "CivicElectorateRegistry420": "420/component/governance/civic-electorate-registry/v1",
    "CivicVoting420": "420/component/governance/civic-voting/v1",
    "CivicGovernor420": "420/component/governance/civic-governor/v1",
}

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def main(argv=None):
    require_ready = "--require-ready" in (argv or sys.argv[1:])
    errors, blockers = [], []
    try:
        cfg, system, canon, storage = load(CFG), load(SYSTEM), load(CANON), load(STORAGE)
        foundry = FOUNDRY.read_text(encoding="utf-8")
    except Exception as exc:
        print(json.dumps({"step":"GOV-AUDIT-6","pass":False,"errors":[str(exc)]}, indent=2))
        return 2

    compiler = cfg.get("compiler", {})
    for key, expected in {
        "solidity":"0.8.24","evmVersion":"cancun","optimizer":True,"optimizerRuns":200,"viaIR":True
    }.items():
        if compiler.get(key) != expected:
            errors.append(f"compiler.{key} mismatch")
    for token in ['solc_version = "0.8.24"', 'evm_version = "cancun"', 'optimizer = true',
                  'optimizer_runs = 200', 'via_ir = true']:
        if token not in foundry:
            errors.append("foundry pin missing: " + token)

    assignments = {x.get("name"): x.get("address","").lower() for x in system.get("assignments", [])}
    fixed = {x["name"]: x["address"].lower() for x in cfg.get("fixedPredeploys", [])}
    if fixed != {
        "GovernanceTimelock":"0x0000000000000000000000000000000000000429",
        "Governance420":"0x0000000000000000000000000000000000000437",
    }:
        errors.append("fixed Governance predeploy set/address mismatch")
    for name, addr in fixed.items():
        if assignments.get(name) != addr:
            errors.append(f"{name} does not match frozen system address authority")

    registry = cfg.get("registry", {})
    if registry.get("address","").lower() != "0x0000000000000000000000000000000000000434":
        errors.append("ProtocolRegistry address mismatch")
    sid = registry.get("serviceId", {})
    if sid.get("algorithm") != "keccak256(utf8)" or sid.get("preimage") != "420/service/governance/v1":
        errors.append("canonical Governance service ID definition mismatch")

    components = cfg.get("registryResolvedComponents", [])
    if [x.get("name") for x in components] != CIVIC:
        errors.append("Civic component inventory/order mismatch")
    seen = set()
    for item in components:
        name = item.get("name")
        cid = item.get("componentId", {})
        if item.get("fixedAddress") is not None:
            errors.append(f"{name} illegally claims fixed address")
        if cid.get("algorithm") != "keccak256(utf8)" or cid.get("preimage") != EXPECTED_PREIMAGES.get(name):
            errors.append(f"{name} canonical component ID mismatch")
        if cid.get("preimage") in seen:
            errors.append("duplicate Civic component ID preimage")
        seen.add(cid.get("preimage"))
        source = ROOT / str(item.get("source",""))
        if not source.is_file():
            errors.append(f"missing source {item.get('source')}")

    registry_resolved = {x.get("contract") for x in canon.get("registry_resolved", [])}
    # GOV-AUDIT-6 owns the Civic publication profile; the generic Genesis file must not assign them fixed addresses.
    for name in CIVIC:
        if name in assignments:
            errors.append(f"{name} unexpectedly appears in fixed system address map")

    order = cfg.get("initializationOrder", [])
    required_order_tokens = [
        "materialize GovernanceTimelock",
        "materialize Governance420",
        "deploy CivicConstitution420",
        "deploy CivicProposalRegistry420",
        "deploy CivicElectorateRegistry420",
        "configure COMMUNITY electorate source",
        "install canonical initial constitutional rules G1-G4",
        "deploy CivicVoting420",
        "deploy CivicGovernor420",
        "bind CivicProposalRegistry420 proposalAuthority",
        "bind CivicElectorateRegistry420 snapshotAuthority",
        "bind Governance420 compatibility civicGovernor pointer",
        "register all five Civic component IDs",
        "publish governance service profile",
        "activate GovernanceTimelock Civic authority last",
    ]
    cursor = -1
    for token in required_order_tokens:
        found = next((i for i,x in enumerate(order) if token in x), -1)
        if found <= cursor:
            errors.append("initialization order missing/out of order: " + token)
        cursor = found

    inputs = cfg.get("canonicalInputs", {})
    unresolved = []
    for key in ("bootstrapGovernor","communityElectorateSource"):
        if inputs.get(key, {}).get("value") in (None, ""):
            unresolved.append(key)
    rules = inputs.get("initialConstitutionalRules", {})
    for cls in ("G1","G2","G3","G4"):
        if rules.get(cls) is None:
            unresolved.append("initialConstitutionalRules."+cls)
    if storage.get("entries", {}).get("GovernanceTimelock", {}).get("constructor") != ["bootstrap_governor"]:
        errors.append("storage-init GovernanceTimelock constructor authority drift")
    if storage.get("bootstrap_governor") not in (None, "UNRESOLVED_DO_NOT_INVENT"):
        # A real value is allowed only when the deployment spec agrees with it.
        if inputs.get("bootstrapGovernor",{}).get("value","").lower() != str(storage.get("bootstrap_governor")).lower():
            errors.append("bootstrap governor authority mismatch")

    blockers.extend(sorted(set(unresolved)))
    ready = not blockers and cfg.get("status") == "READY_FOR_REPRODUCIBLE_DEPLOYMENT"
    if require_ready and not ready:
        errors.append("canonical initialization inputs unresolved: " + ", ".join(blockers))

    result = {
        "step":"GOV-AUDIT-6",
        "pass": not errors,
        "ready": ready,
        "status": cfg.get("status"),
        "structuralErrors": errors,
        "canonicalInputBlockers": blockers,
        "fixedPredeploys": fixed,
        "registryResolvedComponents": [x.get("name") for x in components],
    }
    print(json.dumps(result, indent=2))
    return 0 if not errors else 2

if __name__ == "__main__":
    raise SystemExit(main())
