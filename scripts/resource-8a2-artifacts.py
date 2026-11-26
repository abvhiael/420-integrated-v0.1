#!/usr/bin/env python3
"""Compile the frozen pre/post collateral graph, verify compatibility, and retain deterministic evidence."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "b1a7ad6bed675655385c082ce9df5dd87ecce2de"
QUALIFIED = "6837f137229ff0d9496d2d74d1cb0bea50680de5"
NAMES = ["ResourceProviderCollateral420", "ResourceProviderRegistry420",
         "ResourceNodeRegistry420", "ResourceSessionRegistry420", "StorageAgreementRegistry420",
         "StorageCapacityRegistry420", "StorageCommitmentRegistry420", "StorageProofRegistry420",
         "StorageSettlementRegistry420", "AssetVault420"]
ADDITIONS = {
    "ResourceProviderRegistry420": """governanceTimelock collateral collateralCodeHash collateralPolicyRevision
        admissionSuspended disciplinarySuspension permanentlyDisqualified disciplineEvidence disciplineRevision
        collateralSponsor CollateralPolicyPublished AdmissionSuspensionChanged ProviderDisqualified
        ProviderReinstated CollateralAuthorityBound ProviderDisciplineChanged CollateralSponsorChanged
        bindCollateral publishCollateralPolicy collateralPolicy collateralPolicyCommitment minimumCollateral
        setAdmissionSuspended requiredSlashable setCollateralSponsor setDisciplinarySuspension
        disqualifyProvider reinstateProvider""".split(),
    "ResourceSessionRegistry420": "collateralReservation collateralReleased economicSettlementController economicSettlementCodeHash bindEconomicSettlementController releaseDischargedSession".split(),
    "StorageAgreementRegistry420": """collateralReservation settlementForAgreement settlementFinalized collateralReleased
        agreementForCommitment settlementController settlementControllerCodeHash AgreementSettlementBound
        AgreementSettlementFinalized AgreementCollateralReleased bindSettlementController registerSettlement
        finalizeSettlement releaseDischargedAgreement""".split(),
    "StorageCapacityRegistry420": ["collateralReservation"],
    "StorageCommitmentRegistry420": ["collateralReservation", "collateralReleaseAfter", "collateralReleased", "releaseExpiredCommitment"],
    "AssetVault420": ["RESOURCE_PROVIDER_COLLATERAL_TYPE"],
}
def run(args, cwd=ROOT, env=None):
    return subprocess.check_output(args, cwd=cwd, env=env, text=True)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + "\n")

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def digest(value):
    return hashlib.sha256(value).hexdigest()

def source(name):
    return Path("src") / ("vault" if name == "AssetVault420" else "resource") / (name + ".sol")

def normalized_layout(layout):
    types = layout.get("types") or {}
    def typ(key, seen=()):
        t = types[key]
        if key in seen:
            return {"recursive": t["label"]}
        out = {k: t[k] for k in ("encoding", "label", "numberOfBytes") if k in t}
        for k in ("base", "key", "value"):
            if k in t:
                out[k] = typ(t[k], seen+(key,))
        if "members" in t:
            out["members"] = [member(m, seen+(key,)) for m in t["members"]]
        return out
    def member(m, seen=()):
        return {**{k:m[k] for k in ("label", "slot", "offset")}, "type":typ(m["type"], seen)}
    return [member(m) for m in layout["storage"]]

def bytecode_commitment(obj):
    code = obj["object"].removeprefix("0x")
    raw = bytes.fromhex(code)  # unresolved library links are forbidden
    return {"bytes": len(raw), "sha256": digest(raw),
            "linkReferences": obj.get("linkReferences", {}),
            "immutableReferences": obj.get("immutableReferences", {})}

def compile_revision(work, stage, names, out):
    spec = importlib.util.spec_from_file_location("stage", ROOT/"scripts/qualify-resource-solidity.py")
    stager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stager)
    stager.stage(work/"contracts", stage, [], [source(n) for n in names])
    env = dict(os.environ, FOUNDRY_PROFILE="ci", FOUNDRY_TEST="test/__empty__")
    config = json.loads(run(["forge", "config", "--json"], stage, env))
    assert config["solc"] == "0.8.24", config["solc"]
    assert config["evm_version"] == "cancun" and config["optimizer"] and config["optimizer_runs"] == 200 and config["via_ir"]
    version = run(["forge", "--version"], stage, env).splitlines()[0]
    assert "1.9.0" in version, version
    run(["forge", "build", "--extra-output", "storageLayout"], stage, env)
    result = {}
    for name in names:
        raw = json.loads((stage/"out"/(name+".sol")/(name+".json")).read_text())
        abi = sorted(raw["abi"], key=canonical)
        storage = raw["storageLayout"]
        result[name] = {"source": str(Path("contracts")/source(name)),
            "sourceBlob": run(["git", "rev-parse", "HEAD:contracts/"+str(source(name))], work).strip(),
            "abi": abi, "storageLayout": storage,
            "creationBytecode": bytecode_commitment(raw["bytecode"]),
            "runtimeBytecodeTemplate": bytecode_commitment(raw["deployedBytecode"])}
        write(out/(name+".json"), result[name])
    return result

def compare(before, after, manifest):
    report = []
    deps = {x["contract"]: x["constructor"] for x in manifest["deployment_order"] if "constructor" in x}
    expected_types = {"ResourceProviderRegistry420": ["address", "address"], "ResourceProviderCollateral420": ["address"]*4}
    for n in NAMES:
        new = after[n]
        old = before.get(n)
        constructor = next((a for a in new["abi"] if a["type"]=="constructor"), {"inputs":[]})
        types = [x["type"] for x in constructor["inputs"]]
        if n in deps:
            assert types == ["address"]*len(deps[n]), (n, types, deps[n])
        if n in expected_types:
            assert types == expected_types[n]
        row = {"contract":n, "constructorInputs":constructor["inputs"], "deploymentDependencies":deps.get(n),
               "runtimeCommitmentKind":"compiler template; immutable values require deployment-specific verification"}
        if old is None:
            row.update(disposition="NEW_CANONICAL_BASELINE", addedABI=new["abi"], appendedStorage=normalized_layout(new["storageLayout"]))
        else:
            oa = {canonical(a):a for a in old["abi"] if a["type"]!="constructor"}
            na = {canonical(a):a for a in new["abi"] if a["type"]!="constructor"}
            removed = [oa[k] for k in sorted(oa.keys()-na.keys())]
            added = [na[k] for k in sorted(na.keys()-oa.keys())]
            assert not removed, (n, "legacy ABI drift", removed)
            # Exact expected additions; no implicit approval of future surface growth.
            assert {a.get("name") for a in added} == set(ADDITIONS.get(n, [])), (n, "unexpected ABI additions", added)
            oldc = next((a for a in old["abi"] if a["type"]=="constructor"), {"inputs":[]})
            assert oldc == constructor or n == "ResourceProviderRegistry420", (n, "constructor drift")
            ol, nl = normalized_layout(old["storageLayout"]), normalized_layout(new["storageLayout"])
            assert nl[:len(ol)] == ol, (n, "existing storage moved or changed")
            row.update(disposition="INTENTIONAL_ADDITIVE_INTERFACE" if added else "LEGACY_ABI_PRESERVED",
                       addedABI=added, removedABI=removed, oldConstructor=oldc,
                       appendedStorage=nl[len(ol):], legacyStoragePreserved=True)
        report.append(row)
    return report

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--check", type=Path, help="compare generated evidence with permanent archive")
    p.add_argument("--historical-only", action="store_true", help="Reproduce frozen archive; current changes must be qualified by the successor comparison")
    args = p.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    # Verify that the current production source/import graph still equals the qualified revision.
    if not args.historical_only:
        for path in ("contracts/src/resource", "contracts/src/vault", "contracts/foundry.toml"):
            subprocess.run(["git", "diff", "--exit-code", QUALIFIED, "HEAD", "--", path], cwd=ROOT, check=True)
    else:
        assert args.check, "Historical qualification requires permanent archive comparison"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        results = {}
        for label, sha in (("before", BASE), ("after", QUALIFIED)):
            run(["git", "fetch", "--no-tags", "origin", sha])
            work = tmp/label
            run(["git", "worktree", "add", "--detach", str(work), sha])
            try:
                assert run(["git","rev-parse","HEAD"],work).strip() == sha
                names = [n for n in NAMES if n != "ResourceProviderCollateral420" or label=="after"]
                results[label] = compile_revision(work, tmp/(label+"-stage"), names, out/label)
            finally:
                run(["git", "worktree", "remove", "--force", str(work)])
    manifest = json.loads((ROOT/"contracts/config/resource/resource-audit-8-deployment-package.json").read_text())
    report = compare(results["before"], results["after"], manifest)
    write(out/"comparison.json", {"baseline":BASE, "qualified":QUALIFIED, "compiler":"0.8.24", "profile":"ci",
          "foundry":"1.9.0", "contracts":report})
    files = sorted(out.rglob("*.json"))
    write(out/"sha256.json", {str(f.relative_to(out)):digest(f.read_bytes()) for f in files})
    if args.check:
        reference = args.check.resolve()
        assert {str(f.relative_to(out)):f.read_bytes() for f in out.rglob("*.json")} == {
            str(f.relative_to(reference)):f.read_bytes() for f in reference.rglob("*.json")}, "archived compiler evidence drift"
    print("Verified compiler compatibility for", len(report), "contracts")
if __name__ == "__main__":
    main()
