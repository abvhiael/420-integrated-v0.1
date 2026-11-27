#!/usr/bin/env python3
"""Qualify intentional 8A3 ABI/bytecode changes without rewriting historical evidence."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "5308e7fcfe14db640619ede99a5c3b545c7a5508"
spec = importlib.util.spec_from_file_location("historical", ROOT / "scripts/resource-8a2-artifacts.py")
historical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(historical)
ALLOWED_SOURCE_CHANGES = {
    "contracts/src/resource/ResourceAuthorization420.sol",
    "contracts/src/resource/ResourceProviderRegistry420.sol",
    "contracts/src/resource/ResourceIds420.sol",
    "contracts/src/resource/ResourceSessionRegistry420.sol",
}
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    head = historical.run(["git", "rev-parse", "HEAD"]).strip()
    changes = set(historical.run(["git","diff","--name-only",BASE,head,"--",
                                  "contracts/src","contracts/foundry.toml"]).splitlines())
    # Unrelated changes on main must not be mistaken for Resource changes.
    relevant = {p for p in changes if p.startswith(("contracts/src/resource/","contracts/src/vault/"))
                or p == "contracts/foundry.toml"}
    assert relevant == ALLOWED_SOURCE_CHANGES, ("unexpected Resource source delta", sorted(relevant))
    package = json.loads((ROOT/"contracts/config/resource/resource-audit-8-deployment-package.json").read_text())
    names = [x["contract"] for x in package["deployment_order"] if x["contract"] != "ProtocolRegistry"]
    assert len(names) == 16 and len(set(names)) == 16
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        work = tmp/"baseline"
        historical.run(["git","worktree","add","--detach",str(work),BASE])
        try:
            before = historical.compile_revision(work,tmp/"before-stage",names,out/"before")
            after = historical.compile_revision(ROOT,tmp/"after-stage",names,out/"after")
        finally:
            historical.run(["git","worktree","remove","--force",str(work)])
    report = []
    for name in names:
        old,new = before[name],after[name]
        oldabi = {historical.canonical(a):a for a in old["abi"]}
        newabi = {historical.canonical(a):a for a in new["abi"]}
        removed = [oldabi[k] for k in sorted(oldabi.keys()-newabi.keys())]
        added = [newabi[k] for k in sorted(newabi.keys()-oldabi.keys())]
        if name == "ResourceSessionRegistry420":
            # Legacy selector remains but deliberately rejects arbitrary IDs.
            assert len(removed)==1 and removed[0]["name"]=="openSession", removed
            assert len(added)==2 and {a["name"] for a in added}=={"openSession","openCanonicalSession"}, added
            legacy = next(a for a in added if a["name"]=="openSession")
            assert legacy["stateMutability"]=="pure" and [x["type"] for x in legacy["inputs"]]==[x["type"] for x in removed[0]["inputs"]]
            canonical = next(a for a in added if a["name"]=="openCanonicalSession")
            assert [x["type"] for x in canonical["inputs"]]==["bytes32","uint128","uint64","uint256"]
            assert [x["type"] for x in canonical["outputs"]]==["bytes32"]
        elif name == "ResourceProviderRegistry420":
            assert not removed and len(added)==3 and {a["name"] for a in added}=={"canonicalProviderId","setRegistrationConsent","RegistrationConsentChanged"}, added
            expected = {"canonicalProviderId": ["address","uint96"], "setRegistrationConsent": ["bytes32","address","bytes32","bytes32"], "RegistrationConsentChanged": ["bytes32","bytes32"]}
            assert all([x["type"] for x in a["inputs"]]==expected[a["name"]] for a in added)
        else:
            assert not removed and not added, (name,"unapproved ABI delta",removed,added)
        oldlayout = historical.normalized_layout(old["storageLayout"])
        newlayout = historical.normalized_layout(new["storageLayout"])
        if name == "ResourceProviderRegistry420":
            assert newlayout[:-1]==oldlayout and newlayout[-1]["label"]=="_registrationConsent" and newlayout[-1]["type"]["label"]=="mapping(bytes32 => bytes32)", (name,"unapproved layout delta")
        else:
            assert oldlayout==newlayout, (name,"storage drift")
        report.append({"contract":name,"removedABI":removed,"addedABI":added,"storagePreserved":True,
                       "oldRuntime":old["runtimeBytecodeTemplate"],"newRuntime":new["runtimeBytecodeTemplate"]})
    historical.write(out/"comparison.json",{"baseline":BASE,"qualified":head,"contracts":report,
                      "scopeMigration":"Provider/node/session grants must be regenerated; legacy session selector deliberately rejects."})
    historical.write(out/"sha256.json",{str(f.relative_to(out)):hashlib.sha256(f.read_bytes()).hexdigest()
                     for f in sorted(out.rglob("*.json"))})
    print("Verified 8A3 compiler comparison for",len(report),"contracts at",head)
if __name__=="__main__":
    main()
