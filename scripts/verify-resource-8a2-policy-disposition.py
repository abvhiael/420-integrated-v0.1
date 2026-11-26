#!/usr/bin/env python3
"""Verify the C6 unapproved policy disposition (not a production activation tool)."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
policy = json.loads((root / "contracts/config/resource/resource-8a2-collateral-policy.json").read_text())
assert policy["status"] == "GOVERNANCE_PARAMETER_APPROVAL_REQUIRED"
for key in ("minimumCollateral", "minimumSlashable", "withdrawalDelaySeconds", "coverageBps"):
    assert key in policy and policy[key] is None, key
assert policy["acceptingNew"] is False
d = policy["disposition"]
assert d["repositoryQualification"] == "NOT_BLOCKED_BY_UNAPPROVED_PRODUCTION_PARAMETERS"
assert d["productionAdmission"] == "DISABLED_UNTIL_APPROVED_POLICY_AND_AUTHORIZED_ACTIVATION"
assert d["noParameterInheritance"] is True
assert d["governanceWorkItem"] == "GOV-PRE-RESOURCE-COLLATERAL"
for key in ("approvalEvidence", "approvedPolicyRevision", "activationTransaction"):
    assert key in d and d[key] is None, key
roadmap = root / d["roadmap"].split("#")[0]
assert "## GOV-PRE-RESOURCE-COLLATERAL" in roadmap.read_text()
for name in ("420RESOURCE-AUDIT-REMEDIATION-ROADMAP.md", "420GOVERNANCE-TESTNET-WORK-ROADMAP.md"):
    assert d["governanceWorkItem"] in (root / "docs/audit" / name).read_text()
print("C6 PASS: unapproved values retained, admission disabled, governance handoff linked")
