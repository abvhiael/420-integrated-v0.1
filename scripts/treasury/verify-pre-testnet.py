#!/usr/bin/env python3
"""Treasury REC-10: verify retained source lineage and current local release inputs."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / "contracts"
def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)
def read(p):
    return json.loads((ROOT / p).read_text())
def need(condition, message):
    if not condition:
        raise RuntimeError(message)
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def same(rev, paths):
    for p in paths:
        path = str(p.relative_to(ROOT)) if isinstance(p, Path) else p
        need((ROOT / path).read_bytes() == git("show", rev + ":" + path), "changed qualified input: " + path)
def unchanged(rev, paths):
    need(subprocess.run(["git", "diff", "--quiet", rev, "HEAD", "--", *paths], cwd=ROOT).returncode == 0,
         "qualified tree drift: " + str(paths))
def ancestor(rev):
    need(subprocess.run(["git", "merge-base", "--is-ancestor", rev, "HEAD"], cwd=ROOT).returncode == 0,
         "source provenance not in candidate ancestry: " + rev)
release = "70895129b186e98d98e3aa5bb4b02f4d139750a2"
review = "282e2cf6d9f4cde8c3b3b7a027724de1e0d0a63c"
consumer = "c1507c3f8885246843da51a930468ec354eff22b"
runtime = "3d655c47a674bf4e2e1fadaf19973c6129deea24"
final_review = "82f4221e1461a06f36db7596494c25027a11052b"
runs = {
    44571486048: "45d8b4d0eecb8049229d79b6633d227273a2b9a6",
    44574638401: "e649d3a5b0dcae0aa0859750fe5a8808c5a9ed03",
    44580443875: "6c627ce4ebb1bb9dcb384a388124687bc50a077e",
    44583083947: "4c8e448de67122d6c45f703c86075f6ec6ae664b",
    44590461793: consumer,
    44597319428: "cf0b38f38d337de9f5009ff63e0e7c8f4c5ecb8e",
    44610899469: runtime,
    44614034940: release,
    44614506921: "639d72f129952e05d2acac2f723eef81489dd30f",
    44614506846: "639d72f129952e05d2acac2f723eef81489dd30f",
    44614506908: "639d72f129952e05d2acac2f723eef81489dd30f",
    44614506834: "639d72f129952e05d2acac2f723eef81489dd30f",
    44619508029: final_review, 44619508030: final_review, 44619508070: final_review,
}
for rev in set(runs.values()) | {review, "7e6956898b811b13613d13f551f3d04250e2ac0d"}:
    ancestor(rev)
run_records = json.loads(Path(sys.argv[1]).read_text())
need({int(r["id"]): r["head_sha"] for r in run_records} == runs, "workflow identity mismatch")
need(all(r["status"] == "completed" and r["conclusion"] == "success" for r in run_records), "required retained workflow not successful")

spec = importlib.util.spec_from_file_location("closure", ROOT / "scripts/qualify-stake-isolated.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
core = ["TreasuryAuthorization420", "TreasuryPolicyRegistry420", "TreasuryBudgetRegistry420",
        "TreasuryDisbursementRegistry420", "TreasuryRouter420"]
executor = "TreasuryReleaseExecutor420"
libraries = ["TreasuryIds420", "TreasuryVaultBinding420"]
owners = sorted((C / "src/treasury").glob("*.sol"))
need({p.stem for p in owners} == set(core + [executor] + libraries), "Treasury inventory drift")
release_deps = mod.closure(owners + [C / p for p in ["src/system/CapabilityRegistry420.sol",
    "src/governance/GovernanceTimelock.sol", "src/apps/ProtocolRegistry.sol"]])
same(release, release_deps + [C / "foundry.toml"])
same(release, ["scripts/treasury/deployment.mjs", "scripts/treasury/deployment.integration.test.mjs",
    "scripts/treasury/materialize-deployment-closure.py", "scripts/treasury/package.json",
    "scripts/treasury/package-lock.json", "contracts/config/genesis-address-namespace.json",
    "contracts/config/predeploy/GovernanceTimelock-predeploy-state.json",
    "contracts/config/predeploy/ProtocolRegistry-predeploy-state.json",
    "contracts/artifacts/GovernanceTimelock.json", "contracts/artifacts/ProtocolRegistry.json",
    "contracts/config/treasury/treasury-release-executor.json"])
for path, key, expected in [
    ("contracts/config/420treasury-genesis.json", "status", "REPOSITORY_QUALIFIED_LIVE_TESTNET_DEFERRED"),
    ("contracts/config/treasury/treasury-audit-6-release-materialization.json", "repository_ready", True),
]:
    actual = read(path)
    need(actual[key] == expected, "stale readiness metadata")
    old = json.loads(git("show", release + ":" + path))
    actual.pop(key); old.pop(key)
    need(actual == old, "release input drift: " + path)
cfg = read("contracts/config/420treasury-genesis.json")
need(cfg["deployment_inventory"]["deployable"] == core, "principal inventory mismatch")
need(cfg["deployment_inventory"]["designated_executor_candidate"] == executor, "executor mismatch")
need(cfg["deployment_inventory"]["internal_libraries"] == libraries, "library mismatch")
need(cfg["vault_release_evidence_model"]["mode"] == "AUTHORIZED_EXECUTOR_COMMITMENT_ONLY", "trust model drift")
need(cfg["vault_release_evidence_model"]["treasury_verifies_vault_release"] is False, "fabricated payment proof")
for p in owners:
    need(not re.search(r"\b(?:TODO|FIXME|REPLACE_ME|not implemented)\b", p.read_text(), re.I), "placeholder: " + str(p))
retained = read("docs/audit/420TREASURY-REC-8-REHEARSAL.json")
need(retained["chainId"] == 31337 and retained["liveQualified"] is False, "fixture promoted to live")
need(retained["tests"]["passed"] == 6 and retained["tests"]["failed"] == 0, "release test evidence")
for phase in ("rehearsal", "corrective"):
    need([d["name"] for d in retained[phase]["deployments"]] == core + [executor], "deployment inventory mismatch")
    need(len({d["transactionHash"] for d in retained[phase]["deployments"]}) == 6, "duplicate deployment")

security_inputs = mod.closure(owners + [C / p for p in ["src/governance/GovernanceTimelock.sol",
    "src/governance/CivicGovernor420.sol", "src/system/StakeSystemSafety420.sol",
    "src/apps/ProtocolRegistry.sol", "test/TreasuryRec9Security420.t.sol", "test/TreasuryRec9Governance420.t.sol"]])
same(review, security_inputs + [C / "foundry.toml"])
same(review, ["scripts/treasury/qualify-security.py", "scripts/qualify-stake-isolated.py"])
same(final_review, ["docs/audit/420TREASURY-REC-9-STATIC-REVIEW.json", "docs/audit/420TREASURY-REC-9-REVIEW-RESULT.json",
                   "scripts/treasury/review-security.py"])
sec = read("docs/audit/420TREASURY-REC-9-REVIEW-RESULT.json")
need(sec["result"] == "PASS" and sec["unresolvedFindings"] == 0 and sec["foundryTestsPassed"] == 6 and
     sec["fuzzRuns"] == 50000 and sec["invariantCalls"] == 524288 and sec["invariantReverts"] == 0 and
     sum(sec["staticCounts"].values()) == 63 and sec["reviewedHighReports"] == 4, "security evidence mismatch")
need(sec["externalReviewComplete"] is False and sec["liveAcceptanceComplete"] is False, "false acceptance")
need(sec["reviewSha256"] == sha(ROOT / "docs/audit/420TREASURY-REC-9-STATIC-REVIEW.json"), "static review digest")
for path, digest in sec["stakeSafetyExecution"]["closureSha256"].items():
    need(sha(ROOT / path) == digest, "Stake safety input changed: " + path)
consumers = mod.closure([C / p for p in ["test/TreasuryGrantsIntegration420.t.sol", "test/GrantsGenesis420.t.sol",
                                         "test/TownAuthorityTreasury420.t.sol", "test/highcountry/integration/R04TreasuryIdentity.t.sol"]])
same(consumer, consumers + [C / "foundry.toml"])
unchanged(consumer, ["wallet/web", "contracts/src/grants", "contracts/src/town",
                     "contracts/src/highcountry/organization/CanonicalOrganizationTreasuryGateway.sol"])
unchanged(runtime, ["420-indexer", "indexer", "explorer", "analytics", "packages/420-sdk",
                    "go.mod", "go.sum", "deployments/indexer/docker-compose.yml",
                    "scripts/verify-treasury-audit-5-descriptor.py"])
for p in ["docs/apps/treasury/reference.md", "docs/apps/treasury/operator-guide.md", "docs/apps/treasury/deployment.md",
          "docs/apps/treasury/release-executor.md", "docs/ROADMAP.md", "docs/audit/420TREASURY-AUDIT-REMEDIATION-ROADMAP.md"]:
    need((ROOT / p).is_file(), "missing documentation " + p)
for script in ["scripts/verify-treasury-audit-6-release.py", "scripts/verify-treasury-audit-7-docs.py"]:
    subprocess.run([sys.executable, script], cwd=ROOT, check=True)
out = {
    "schema": "420-treasury-rec10-readiness-v1",
    "candidate": git("rev-parse", "HEAD").decode().strip(),
    "tree": git("rev-parse", "HEAD^{tree}").decode().strip(),
    "retainedRuns": run_records,
    "releaseSource": release, "securitySource": review, "securityFinal": final_review,
    "sourceSha256": {str(p.relative_to(ROOT)): sha(p) for p in sorted(set(release_deps + security_inputs + consumers))},
    "foundrySha256": sha(C / "foundry.toml"),
    "reviewSha256": sec["reviewSha256"], "releaseManifestHash": retained["rehearsal"]["manifestHash"],
    "localChecks": "PASS", "liveAcceptanceComplete": False, "externalReviewComplete": False
}
Path(sys.argv[2]).write_text(json.dumps(out, indent=2, sort_keys=True) + "\n")
print("REC-10 retained execution provenance, scoped source identity, inventory, security and documentation PASS")
