#!/usr/bin/env python3
"""W15.3 offline Wallet Genesis preparation. No address approval or deployment attestation."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tomllib
from Crypto.Hash import keccak

ROOT = pathlib.Path(__file__).resolve().parents[1]
ADDR = re.compile(r"0x[0-9a-fA-F]{40}\Z")
HEX = re.compile(r"0x(?:[0-9a-fA-F]{2})*\Z")
SOURCES = {
    "EntryPoint420": "accounts/EntryPoint420.sol",
    "CapabilityRegistry420": "system/CapabilityRegistry420.sol",
    "SmartAccountFactory420": "accounts/SmartAccountFactory420.sol",
    "SmartAccount420": "accounts/SmartAccount420.sol",
    "SponsorshipPolicy420": "accounts/SponsorshipPolicy420.sol",
    "Paymaster420": "accounts/Paymaster420.sol",
    "Rip7212P256Verifier420": "accounts/Rip7212P256Verifier420.sol",
    "P256WebAuthnVerifier420": "accounts/P256WebAuthnVerifier420.sol",
}
ORDER = ["EntryPoint420", "CapabilityRegistry420", "SmartAccountFactory420",
         "SmartAccount420", "SponsorshipPolicy420", "Paymaster420",
         "Rip7212P256Verifier420", "P256WebAuthnVerifier420"]
CORE = {"EntryPoint420", "CapabilityRegistry420", "SmartAccountFactory420"}
CANDIDATES = {
    "EntryPoint420": ("0x000000000000000000000000000000000000041f",
                      "RESERVED_PENDING_PRODUCTION_IMPLEMENTATION"),
    "SmartAccountFactory420": ("0x0000000000000000000000000000000000000446",
                               "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN"),
    "CapabilityRegistry420": ("0x0000000000000000000000000000000000000447",
                              "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN"),
}
RETIRED = {int(x, 16) for x in ("0x0420", "0x0421", "0x0422",
            "0x0424", "0x0445", "0x0448", "0x0449", "0x043c", "0x0443")}


def load(name, root=ROOT):
    return json.loads((root / name).read_text(encoding="utf-8"))


def sha256(data):
    return "0x" + hashlib.sha256(data).hexdigest()


def json_bytes(obj):
    return (json.dumps(obj, indent=2, sort_keys=True) + "\n").encode()


def checks(docs):
    """Validate current namespace with no write-side effects."""
    errors = []
    ns = docs["namespace"]
    system = docs["system"]
    canonical = docs["canonical"]
    plan = docs["plan"]
    deploy = docs["deployment"]
    inventory = docs["inventory"]
    wallet = docs["wallet"]
    if ns.get("status") != "FROZEN_FOR_GENESIS_ADDRESS_AUTHORITY":
        errors.append("namespace not frozen")
    if ns.get("decision") != "PRESERVE_FROZEN_STEP6_2_PREDEPLOYS_AND_REGISTRY_RESOLVE_NON_PREDEPLOY_SERVICES":
        errors.append("unknown authoritative namespace decision")
    if ns.get("reservedRange") != {"start": "0x" + format(0x420, "040x"),
                                     "end": "0x" + format(0x4ff, "040x")}:
        errors.append("reserved range changed")
    frozen = system.get("assignments", [])
    expect = {x["name"]: x["address"].lower() for x in frozen}
    if len(expect) != len(frozen) or len(expect) != 29 or len(set(expect.values())) != len(expect):
        errors.append("duplicate or missing frozen system allocations")
    for key, entries in (("mirror", docs["mirror"].get("assignments", [])),
                         ("namespace fixed", ns.get("fixedAssignments", [])),
                         ("predeploy", plan.get("predeploys", [])),
                         ("deployment", deploy.get("contracts", []))):
        derived = {x["name"]: x["address"].lower() for x in entries}
        if len(entries) != len(expect) or derived != expect:
            errors.append(key + " differs from frozen Step 6.2 map")
    if plan.get("namespace_policy") != "FROZEN_STEP6_2_PRESERVED":
        errors.append("predeploy namespace policy drift")
    if wallet.get("walletCore", {}).get("createsIndependentWalletAuthority") is not False:
        errors.append("wallet attempts independent state authority")
    if wallet.get("walletCore", {}).get("reusesGenesisSmartAccounts") is not True:
        errors.append("wallet not using Genesis SmartAccounts")
    if inventory.get("readyForLiveTestnet") is not False:
        errors.append("unverified Wallet promoted to live status")
    if any(v is not False for v in inventory.get("walletAuthority", {}).get(x, {}).get("deploymentVerified")
           for x in ("entryPoint420", "smartAccountFactory420", "capabilityRegistry420")):
        errors.append("Wallet contract falsely deployment-verified")
    canonical_anchors = canonical.get("anchors", [])
    for x in canonical_anchors:
        name = x["contract"].removesuffix(".sol")
        if expect.get(name) != x["address"].lower():
            errors.append("canonical anchor drift: " + name)
    reserved = {x["id"]: x for x in canonical.get("reserved", [])}
    if reserved.get("entry-point", {}).get("address", "").lower() != CANDIDATES["EntryPoint420"][0]:
        errors.append("EntryPoint historical reservation drift")
    active = {x["name"]: x for x in ns.get("activeNonPredeployReservations", [])}
    for name, (address, status) in CANDIDATES.items():
        x = active.get(name, {})
        if x.get("address", "").lower() != address or x.get("status") != status:
            errors.append(name + " pending reservation changed")
        if address in expect.values():
            errors.append(name + " overwrites frozen predeploy")
        if any(int(y.get("address", "0x0"), 16) == int(address, 16)
               for y in ns.get("retiredClaims", [])):
            errors.append(name + " reuses retired address")
    retired = {int(x["address"], 16) for x in ns.get("retiredClaims", [])}
    if not RETIRED.issubset(retired):
        errors.append("retired address history truncated")
    for name in ("smartAccountFactory420", "capabilityRegistry420"):
        x = inventory.get("walletAuthority", {}).get(name, {})
        contract = "SmartAccountFactory420" if name.startswith("smart") else "CapabilityRegistry420"
        if x.get("address") is not None or x.get("candidateAddress", "").lower() != CANDIDATES[contract][0]:
            errors.append(name + " candidate promoted or changed")
    entry = inventory.get("walletAuthority", {}).get("entryPoint420", {})
    if entry.get("address", "").lower() != CANDIDATES["EntryPoint420"][0] or entry.get("deploymentVerified") is not False:
        errors.append("EntryPoint reserved-only status drift")
    for key, contract in (("protocolRegistry", "ProtocolRegistry"),
                          ("names420", "Names420"), ("identity420", "Identity420")):
        if inventory.get("walletAuthority", {}).get(key, {}).get("address", "").lower() != expect.get(contract):
            errors.append("Wallet dependency disagrees with frozen " + contract)
    if any(x.get("id") in ("smart-account-factory", "capability-registry")
           for x in canonical_anchors):
        errors.append("registry-resolved Wallet component incorrectly made fixed anchor")
    for x in canonical.get("registry_resolved", []):
        if x.get("id") in ("smart-account-factory", "capability-registry") and x.get("address"):
            errors.append("unapproved Wallet registry address published")
    if set(CANDIDATES) & set(expect):
        errors.append("Wallet independent authority added to system predeploys")
    if len({x["address"].lower() for x in ns.get("activeNonPredeployReservations", [])}) != len(ns.get("activeNonPredeployReservations", [])):
        errors.append("duplicate active nonpredeploy candidate address")
    return errors


def documents(root=ROOT):
    return {
        "namespace": load("contracts/config/genesis-address-namespace.json", root),
        "system": load("contracts/config/system-addresses.json", root),
        "mirror": load("config/system-addresses.json", root),
        "canonical": load("contracts/config/genesis-canonical-addresses.json", root),
        "plan": load("contracts/config/predeploy/predeploy-plan.json", root),
        "deployment": load("contracts/config/deployment-manifest.json", root),
        "inventory": load("wallet/deployment-inventory.json", root),
        "wallet": load("contracts/config/420wallet-genesis.json", root),
    }


def compiler_config(root=ROOT):
    with (root / "contracts/foundry.toml").open("rb") as f:
        profile = tomllib.load(f)["profile"]["default"]
    actual = {k: profile[k] for k in
              ("solc_version", "evm_version", "optimizer", "optimizer_runs", "via_ir")}
    expected = {"solc_version": "0.8.24", "evm_version": "cancun", "optimizer": True,
                "optimizer_runs": 200, "via_ir": True}
    if actual != expected:
        raise ValueError("Foundry pinned compiler input drift: " + str(actual))
    return actual


def evm_keccak(raw):
    k = keccak.new(digest_bits=256)
    k.update(raw)
    return "0x" + k.hexdigest()


def cast_verify(data, expected):
    proc = subprocess.run(["cast", "keccak", "0x" + data.hex()], check=True,
                          capture_output=True, text=True, timeout=40)
    if proc.stdout.strip().lower() != expected.lower():
        raise ValueError("independent cast keccak mismatch")


def artifact(root, name):
    src = SOURCES[name]
    path = root / "contracts" / "out" / (pathlib.PurePosixPath(src).name) / (name + ".json")
    if not path.is_file():
        raise ValueError("missing pinned Foundry artifact " + str(path))
    a = json.loads(path.read_text())
    bc = a.get("bytecode") or {}
    rt = a.get("deployedBytecode") or {}
    creation, runtime = bc.get("object"), rt.get("object")
    if not all(isinstance(x, str) and HEX.fullmatch(x) and len(x) > 2 and len(x) % 2 == 0
               for x in (creation, runtime)):
        raise ValueError("missing/invalid linked bytecode " + name)
    if bc.get("linkReferences") or rt.get("linkReferences"):
        raise ValueError("unresolved linked library " + name)
    if not isinstance(a.get("abi"), list) or not isinstance(a.get("storageLayout"), dict):
        raise ValueError("ABI/storageLayout absent " + name)
    md = a.get("metadata")
    if isinstance(md, str):
        md = json.loads(md)
    if not isinstance(md, dict):
        raise ValueError("compiler provenance missing " + name)
    settings = md.get("settings", {})
    ver = md.get("compiler", {}).get("version", "")
    if not ver.startswith("0.8.24+") or settings.get("evmVersion") != "cancun":
        raise ValueError("compiler version/EVM mismatch " + name)
    opt = settings.get("optimizer", {})
    if opt.get("enabled") is not True or opt.get("runs") != 200 or settings.get("viaIR") is not True:
        raise ValueError("optimizer/viaIR mismatch " + name)
    return a, bytes.fromhex(creation[2:]), bytes.fromhex(runtime[2:]), path


def make(root=ROOT, out=None):
    errors = checks(documents(root))
    if errors:
        raise ValueError("authoritative Genesis namespace mismatch: " + "; ".join(errors))
    compiler = compiler_config(root)
    if out is None:
        out = root / "artifacts/wallet-w15-3"
    out.mkdir(parents=True, exist_ok=True)
    (out / "contracts").mkdir(exist_ok=True)
    records = []
    unsigned = []
    for name in ORDER:
        a, creation, runtime, foundry_path = artifact(root, name)
        template_hash = evm_keccak(runtime)
        cast_verify(runtime, template_hash)
        refs = (a["deployedBytecode"].get("immutableReferences") or {})
        constructor = next((x.get("inputs", []) for x in a["abi"] if x.get("type") == "constructor"), [])
        # Immutables are patched by construction. An unlinked template is NEVER
        # mislabelled as the final deployed runtime code hash.
        is_final = not bool(refs)
        origin = root / "contracts/src" / SOURCES[name]
        code = {
            "contract": name, "source": "contracts/src/" + SOURCES[name],
            "sourceSha256": sha256(origin.read_bytes()),
            "foundryArtifact": str(foundry_path.relative_to(root)),
            "foundryArtifactSha256": sha256(foundry_path.read_bytes()),
            "abi": a["abi"], "storageLayout": a["storageLayout"],
            "creationBytecode": "0x" + creation.hex(),
            "runtimeTemplate": "0x" + runtime.hex(),
            "creationCodeSha256": sha256(creation),
            "runtimeTemplateCodeHashKeccak256": template_hash,
            "runtimeCodeHashKeccak256": template_hash if is_final else None,
            "immutableReferences": refs,
            "constructorInputs": constructor,
            "compiler": compiler, "deploymentAttested": False,
        }
        path = out / "contracts" / (name + ".json")
        path.write_bytes(json_bytes(code))
        records.append({
            "contract": name, "artifact": str(path.relative_to(out)),
            "artifactSha256": sha256(path.read_bytes()),
            "creationCodeSha256": code["creationCodeSha256"],
            "runtimeTemplateCodeHashKeccak256": template_hash,
            "runtimeCodeHashKeccak256": code["runtimeCodeHashKeccak256"],
            "immutableConstructorPatchingRequired": not is_final,
            "constructorInputs": constructor,
            "storageEntries": a["storageLayout"].get("storage", []),
            "sourceSha256": code["sourceSha256"],
        })
        if name in CORE:
            unsigned.append({
                "contract": name,
                "order": ORDER.index(name) + 1,
                "deploymentMechanism": "UNSIGNED_CREATE_TRANSACTION_AFTER_APPROVED_DEPLOYER_NONCE",
                "to": None, "from": None, "nonce": None,
                "chainIdExpectedNotVerified": 420,
                "valueWei": "0",
                "candidateAddressNotApproved": CANDIDATES[name][0],
                "creationArtifact": str(path.relative_to(out)),
                "constructorInputs": constructor,
                "constructorArguments": None if constructor else [],
                "transactionData": ("0x" + creation.hex()) if not constructor else None,
                "transactionDataComplete": not bool(constructor),
                "derivedContractAddress": None,
                "requiresApprovedSignerAndNetworkEvidence": True,
            })
    # Storage is not copied from a compiled runtime template. Constructor
    # assignments only materialize when an approved deployer executes creation
    # code; there is no Wallet fixed-address Genesis allocation to patch.
    inputs = {
        "deploymentPolicy": "INDEPENDENT_REGISTRY_RESOLVED_NOT_GENESIS_PREDEPLOY",
        "genesisAllocPatch": {}, "predeployState": {},
        "entrypoint": {"constructorArguments": [], "deploymentAddress": None,
                       "reservedUnapproved": CANDIDATES["EntryPoint420"][0],
                       "runtimeCodeHash": next(x["runtimeCodeHashKeccak256"] for x in records if x["contract"] == "EntryPoint420")},
        "capabilityRegistry": {"constructorArguments": [], "componentRegistrar": "TRANSACTION_SENDER_PENDING_APPROVAL",
                               "deploymentAddress": None, "runtimeCodeHash": next(x["runtimeCodeHashKeccak256"] for x in records if x["contract"] == "CapabilityRegistry420")},
        "smartAccountFactory": {"constructorArguments": ["DEPLOYED_ENTRYPOINT", "DEPLOYED_CAPABILITY_REGISTRY"],
                                "deploymentAddress": None, "runtimeCodeHash": None,
                                "immutables": "PATCHED_BY_CONSTRUCTOR_AFTER_APPROVED_INPUTS"},
        "smartAccount": {"constructorArguments": ["DEPLOYED_ENTRYPOINT", "DEPLOYED_CAPABILITY_REGISTRY",
                                                 "USER_OWNER", "USER_RECOVERY_AUTHORITY"],
                         "implementationDeployment": "FACTORY_CREATE2_PER_OWNER_SALT",
                         "runtimeCodeHash": None},
        "optionalPaymaster": {"policyOwner": "PENDING_APPROVAL",
                              "sponsorSigner": "PENDING_APPROVAL",
                              "enabled": False},
        "order": ["Check frozen Genesis contracts and network identity",
                  "Approve Wallet independent-deployment plan without reserving frozen addresses",
                  "Deploy EntryPoint420 with approved signer/nonce; verify chain, receipt and runtime hash",
                  "Deploy CapabilityRegistry420; confirm componentRegistrar equals approved sender",
                  "Deploy SmartAccountFactory420 with verified EntryPoint and Registry addresses",
                  "Verify constructor-patched factory runtime and publish via authorized ProtocolRegistry",
                  "Create user SmartAccounts via Factory CREATE2 after owner/recovery consent",
                  "Optional paymaster/p256 deployment only after independent approvals and dependencies"],
        "publicRpc": None, "explorer": None, "deploymentReceipt": None,
        "networkIdentityAttested": False, "registryPublicationAttested": False,
    }
    (out / "constructor-and-init.json").write_bytes(json_bytes(inputs))
    (out / "unsigned-deployment-plan.json").write_bytes(json_bytes(unsigned))
    provenance = {name: sha256((root / name).read_bytes()) for name in (
        "contracts/config/genesis-address-namespace.json",
        "contracts/config/genesis-canonical-addresses.json",
        "contracts/config/system-addresses.json", "config/system-addresses.json",
        "contracts/config/predeploy/predeploy-plan.json",
        "contracts/config/deployment-manifest.json",
        "contracts/config/420wallet-genesis.json", "wallet/deployment-inventory.json",
        "contracts/foundry.toml")}
    manifest = {
        "schema": "420wallet-w15-3-offline-artifact-v1",
        "status": "GENERATED_NOT_DEPLOYMENT_ATTESTED",
        "fixedGenesisPredeploysChanged": False,
        "approvedWalletFixedPredeploys": [],
        "approvedWalletDeploymentAddresses": {},
        "genesisAllocPatch": {},
        "networkVerified": False,
        "sourceManifestSha256": provenance,
        "compiler": compiler,
        "contracts": records,
        "unsignedPlanSha256": sha256((out / "unsigned-deployment-plan.json").read_bytes()),
        "constructorPlanSha256": sha256((out / "constructor-and-init.json").read_bytes()),
        "verification": "Runtime Keccak-256 independently agreed with cast for every compiled template",
    }
    (out / "manifest.json").write_bytes(json_bytes(manifest))
    return verify(root, out)


def verify(root=ROOT, out=None):
    if out is None:
        out = root / "artifacts/wallet-w15-3"
    errors = checks(documents(root))
    m = json.loads((out / "manifest.json").read_text())
    if m.get("status") != "GENERATED_NOT_DEPLOYMENT_ATTESTED":
        errors.append("deployment attestation improperly enabled")
    if m.get("networkVerified") is not False or m.get("genesisAllocPatch") != {}:
        errors.append("unapproved Genesis allocation or network status")
    if m.get("approvedWalletDeploymentAddresses") != {}:
        errors.append("unapproved Wallet contract promoted")
    if m.get("compiler") != compiler_config(root):
        errors.append("manifest compiler drift")
    for source, h in m.get("sourceManifestSha256", {}).items():
        if sha256((root / source).read_bytes()) != h:
            errors.append("authoritative input changed: " + source)
    for r in m["contracts"]:
        path = out / r["artifact"]
        if sha256(path.read_bytes()) != r["artifactSha256"]:
            errors.append("artifact integrity failed " + r["contract"])
        a = json.loads(path.read_text())
        runtime = bytes.fromhex(a["runtimeTemplate"][2:])
        creation = bytes.fromhex(a["creationBytecode"][2:])
        if evm_keccak(runtime) != r["runtimeTemplateCodeHashKeccak256"]:
            errors.append("runtime Keccak mismatch " + r["contract"])
        cast_verify(runtime, r["runtimeTemplateCodeHashKeccak256"])
        if sha256(creation) != r["creationCodeSha256"]:
            errors.append("creation bytecode hash mismatch " + r["contract"])
        if a["sourceSha256"] != sha256((root / a["source"]).read_bytes()):
            errors.append("source hash mismatch " + r["contract"])
        if bool(a["immutableReferences"]) == (r["runtimeCodeHashKeccak256"] is not None):
            errors.append("constructor immutables incorrectly marked final " + r["contract"])
    for field, name in (("unsignedPlanSha256", "unsigned-deployment-plan.json"),
                        ("constructorPlanSha256", "constructor-and-init.json")):
        if sha256((out / name).read_bytes()) != m[field]:
            errors.append("deployment plan hash mismatch: " + name)
    plan = json.loads((out / "unsigned-deployment-plan.json").read_text())
    if [x["contract"] for x in plan] != [x for x in ORDER if x in CORE]:
        errors.append("dependency deployment order altered")
    for tx in plan:
        if tx["derivedContractAddress"] is not None or tx["from"] is not None or tx["nonce"] is not None:
            errors.append("invented deployment signature/address")
    if errors:
        raise ValueError("; ".join(errors))
    return {"pass": True, "phase": "W15.3", "contracts": len(m["contracts"]),
            "independentCodeHashesVerified": len(m["contracts"]),
            "deploymentAttested": False, "genesisAllocationChanged": False}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--namespace-only", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--output", type=pathlib.Path)
    args = ap.parse_args()
    try:
        if args.namespace_only:
            result = {"pass": not checks(documents()), "errors": checks(documents()),
                      "deploymentAttested": False}
        elif args.verify_only:
            result = verify(out=args.output)
        else:
            result = make(out=args.output)
        print(json.dumps(result, indent=2))
        return 0 if result["pass"] else 1
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print(json.dumps({"pass": False, "error": str(exc), "deploymentAttested": False}, indent=2))
        return 2


if __name__ == "__main__":
    sys.exit(main())
