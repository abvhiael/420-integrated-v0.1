#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

cfg=json.loads((ROOT/"config/420town-security-v1.json").read_text())
api=json.loads((ROOT/"config/420town-api-v1.json").read_text())
workflow=(ROOT/".github/workflows/420town-audit.yml").read_text()
authority=(ROOT/"contracts/src/town/TownAuthority420.sol").read_text()
soltest=(ROOT/"contracts/test/TownSecurityHardening420.t.sol").read_text()
apitest=(ROOT/"town/api/security_test.go").read_text()
integrationtest=(ROOT/"town/integrations/security_test.go").read_text()
contenttest=(ROOT/"town/content/service_test.go").read_text()
moderationtest=(ROOT/"town/moderation/service_test.go").read_text()
wallet=(ROOT/"town/web/core/wallet.js").read_text()
doc=(ROOT/"docs/apps/town/security.md").read_text()

need(cfg.get("schema")=="420-town-security-v1","Town security schema drift")
need(cfg.get("serviceId")=="420/service/town/v1","Town security service ID drift")
need(cfg.get("roadmapStep")=="TOWN-AUDIT-9","Town security roadmap binding drift")
need(cfg.get("status")=="SECURITY_HARDENING_BASELINE","Town security status drift")

controls=cfg.get("controls",{})
required_tested=[
 "membershipRolePrivilegeEscalation","unauthorizedModeration","visibilityLeakage",
 "replayDuplicateWrites","spamSybilGriefingDos","indexSearchPoisoning",
 "storagePointerSubstitution","messageConfidentialityMetadata","alternatePathPermissionBypass"
]
for key in required_tested:
    need(controls.get(key)=="TESTED",f"Town security control not tested: {key}")

need(controls.get("signedActionDomainSeparationNonces")=="NOT_APPLICABLE_NO_SIGNED_ACTION_SURFACE","signed-action N/A drift")
need(controls.get("treasuryAccountingConservation")=="NOT_APPLICABLE_REFERENCE_ONLY_NO_CUSTODY","treasury N/A drift")
need(controls.get("reentrancyExternalCallValueMovement")=="NOT_APPLICABLE_NO_VALUE_MOVEMENT","reentrancy/value N/A drift")
need(controls.get("webhookReplay")=="NOT_APPLICABLE_WEBHOOKS_DISABLED","webhook N/A drift")
need(api.get("webhooks",{}).get("enabled") is False,"Town webhooks unexpectedly enabled")
need(len(cfg.get("acceptedDesignRisks",[]))>=3,"accepted design-risk inventory incomplete")
need(cfg.get("unresolvedVulnerabilities")==[],"unresolved vulnerability inventory must be explicit")
need(len(cfg.get("invariants",[]))>=16,"Town security invariant inventory incomplete")

for token in [
 "testFuzzNonOwnerCannotMutateAuthority",
 "testFuzzRoleAuthorityCannotCrossCommunity",
 "testPrivilegedRoleDoesNotResurrectAfterRemovalAndReAdd",
 "testTreasurySurfaceRemainsReferenceOnlyAndNonPayable",
]:
    need(token in soltest,f"Town security Foundry property missing {token}")

for token in [
 "TestSecurityMutationBodyAndIdempotencyKeyAreBounded",
 "TestSecurityAuthenticationDoesNotAcceptMalformedBearerVariants",
]:
    need(token in apitest,f"Town API security test missing {token}")

for token in [
 "TestSecuritySearchPoisoningFailsClosed",
 "TestSecurityMessengerEnvelopeContainsNoPlaintextSurface",
 "TestSecurityMessengerRejectsMalformedEnvelopeBeforeTransport",
]:
    need(token in integrationtest,f"Town integration security test missing {token}")

for token in [
 "TestCommunityAggregateWriteLimitBlocksSwarm",
 "TestDeviceScopeLimitsOneDeviceAcrossMultipleIdentities",
 "TestIdempotencyKeyCannotBeReusedForDifferentPayload",
 "TestVisibilityScopesFailClosedAndRespectTownRoles",
]:
    need(token in contenttest,f"Town content security regression missing {token}")

for token in [
 "TestModeratorAuthorityIsCommunityScoped",
 "TestOrdinaryMemberCannotUsePrivilegedModerationActions",
 "TestHideCannotBeBypassedThroughReadVoteRevisionOrThreadPaths",
 "TestModerationIdempotencyAndConflictingReplay",
]:
    need(token in moderationtest,f"Town moderation security regression missing {token}")

need("no custody API" in authority,"Town authority custody boundary drift")
need("value:'0x0'" in wallet,"Town browser transaction value pinning drift")
for token in [
 "config/420town-security-v1.json",
 "scripts/verify-420town-security.py",
 "Verify Town security hardening",
]:
    need(token in workflow,f"Town workflow missing security gate {token}")

for token in [
 "signed-action domain separation/nonces",
 "treasury/accounting conservation",
 "webhook replay",
 "Accepted design risks",
]:
    need(token in doc,f"Town security documentation missing {token}")

if errors:
    print("420Town security verifier FAILED")
    for e in errors: print("-",e)
    raise SystemExit(1)

print("420Town security verifier PASS")
print("roadmap=TOWN-AUDIT-9")
print("unresolved_vulnerabilities=0")
print(f"accepted_design_risks={len(cfg['acceptedDesignRisks'])}")
print(f"invariants={len(cfg['invariants'])}")
