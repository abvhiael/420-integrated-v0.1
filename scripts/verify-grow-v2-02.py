#!/usr/bin/env python3
"""V2-02 architecture, role-policy and separation invariants."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "docs/audit/420GROW-V2-02-ARCHITECTURE-TENANCY-SECURITY.md"
spec = p.read_text(encoding="utf-8")
code = (root / "grow/security/policy.go").read_text(encoding="utf-8")
tests = (root / "grow/security/policy_test.go").read_text(encoding="utf-8")
for required in (
    "Tenant isolation", "Principal", "Membership", "Role and action matrix",
    "OWNER", "MANAGER", "TECHNICIAN", "REVIEWER", "MAINTAINER",
    "DEVICE_CONTROL", "V2-03", "V2-07", "cross-tenant",
    "revocation", "CSRF", "object", "audit", "public 420Location",
    "NOT IMPLEMENTED", "GROW-V2-03",
):
    assert required.casefold() in spec.casefold(), f"Missing specification boundary: {required}"
for required in ("func Authorize(", "DeviceControl", "membership.State != Active",
                 "membership.TenantID != resource.TenantID", "p.SubjectID != membership.SubjectID",
                 "membership.FacilityID != resource.FacilityID",
                 "membership.ZoneID != resource.ZoneID"):
    assert required in code, f"Missing policy enforcement: {required}"
for required in ("TestRoleMatrixAndDenyByDefault", "TestCrossTenantSubjectAndMembershipDeny",
                 "TestFacilityZoneScopesNeverWiden", "TestDeviceControlIsNeverRoleGranted"):
    assert required in tests, f"Missing negative test: {required}"
old = (root / "grow/service/handler.go").read_text(encoding="utf-8")
assert '"/v1/grow/places"' in old
assert "http.MethodGet" in old
assert "enabled:false" in (root / "grow/web/runtime-config.js").read_text(encoding="utf-8")
assert "GROW-V2-02" in (root / "docs/audit/420GROW-V2-ROADMAP.md").read_text(encoding="utf-8")
print("GROW-V2-02 app security/architecture invariants: PASS")
