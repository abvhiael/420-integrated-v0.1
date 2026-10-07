#!/usr/bin/env python3
"""Verify MEDIA-AUDIT-11 repository security/operations closeout artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / "media" / "deploy" / "security-profile.json"

errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def require_file(path: str, tokens: list[str] | None = None) -> str:
    target = ROOT / path
    require(target.exists(), f"missing required file: {path}")
    if not target.exists():
        return ""
    text = target.read_text(encoding="utf-8")
    for token in tokens or []:
        require(token in text, f"{path}: missing {token!r}")
    return text


def main() -> int:
    require(PROFILE.exists(), "missing media/deploy/security-profile.json")
    if PROFILE.exists():
        profile = json.loads(PROFILE.read_text(encoding="utf-8"))
        require(profile.get("schema") == "420-media-security-profile-v1", "security profile schema mismatch")
        require(profile.get("service_id") == "420/service/media/v1", "security profile service id mismatch")
        require(profile.get("authority") == "REPLACEABLE_APPLICATION", "Media authority classification changed")
        network = profile.get("network", {})
        for key in ("chain_id", "network", "api_origin", "web_origin", "registry_record"):
            require(network.get(key) is None, f"security profile must not invent live {key}")
        api = profile.get("api", {})
        require(api.get("secure_server_required") is True, "secure API composition must be required")
        require(api.get("verified_session_required_for_writes") is True, "verified write sessions must be required")
        require(api.get("chain_network_scope_required") is True, "session chain/network scope must be required")
        require(api.get("capability_scope_required") is True, "session capability scope must be required")
        require(api.get("max_request_bytes") == 131072, "request bound drift")
        require(api.get("max_page_limit") == 200, "page bound drift")
        media = profile.get("media", {})
        require(media.get("max_upload_bytes") == 8589934592, "upload resource bound drift")
        require(media.get("content_scanner_required") is True, "scanner must be required")
        require(media.get("quarantine_before_ready") is True, "quarantine-before-ready must be required")
        outbound = profile.get("outbound", {})
        for key in ("deny_loopback", "deny_private_ranges", "deny_link_local", "deny_local_hostnames",
                    "dns_resolution_validation_required", "egress_network_policy_required"):
            require(outbound.get(key) is True, f"outbound control {key} must be true")
        require(outbound.get("whip_whep_schemes") == ["https"], "WHIP/WHEP must remain HTTPS-only")
        require(outbound.get("rtmp_schemes") == ["rtmps"], "RTMP must remain RTMPS-only")
        sandbox = profile.get("process_sandbox", {})
        for key in ("shell_execution_forbidden", "static_operator_profiles_required", "no_new_privileges",
                    "drop_all_linux_capabilities", "read_only_root_filesystem", "private_tmp", "seccomp_required"):
            require(sandbox.get(key) is True, f"sandbox control {key} must be true")
        require(0 < int(sandbox.get("pids_limit", 0)) <= 1024, "PID bound missing/unbounded")
        require(0 < int(sandbox.get("memory_max_bytes", 0)) <= 16 * (1 << 30), "memory bound missing/unbounded")
        require(0 < int(sandbox.get("max_parallel_jobs", 0)) <= 16, "parallel job bound missing/unbounded")
        webhook = profile.get("webhooks", {})
        for key in ("signed_hmac_sha256", "timestamp_expiry_required", "event_id_replay_cache_required",
                    "key_version_required", "key_rotation_required"):
            require(webhook.get(key) is True, f"webhook control {key} must be true")
        moderation = profile.get("moderation", {})
        require(moderation.get("domain_scoped_moderator_capability") is True, "moderator scope missing")
        require(moderation.get("appeals_preserve_decision_history") is True, "appeal history requirement missing")
        require(moderation.get("may_mutate_protocol_ownership_rights_or_funds") is False,
                "moderation must not gain protocol/fund authority")
        secrets = profile.get("secrets", {})
        require(secrets.get("stream_keys_in_chain_state") is False, "stream keys must remain off-chain")
        require(secrets.get("stream_keys_in_urls") is False, "stream keys must not appear in URLs")
        require(secrets.get("opaque_credential_refs_only") is True, "opaque credential refs required")
        require(secrets.get("secret_manager_required") is True, "secret manager requirement missing")
        observability = profile.get("observability", {})
        require(observability.get("no_raw_media_or_secret_logging") is True, "secret/raw-media logging must be forbidden")
        require(profile.get("status") == "FAIL_CLOSED_UNTIL_TESTNET_RUNTIME_MATERIALIZED",
                "repository profile must stay fail-closed until testnet runtime")

    require_file("media/security/policy.go", [
        "ValidateResolvedEndpoint", "NewRateLimiter", "QuarantineGate", "ErrContentQuarantined"
    ])
    require_file("media/security/session.go", [
        "SessionVerifier", "RequireSession", "ErrSessionExpired", "ErrSessionScope"
    ])
    require_file("media/security/webhook.go", [
        "WebhookVerifier", "ErrWebhookReplay", "hmac.Equal"
    ])
    require_file("media/security/moderation.go", [
        "REPORT", "HIDE", "SUSPEND", "APPEAL", "MODERATOR_DECISION", "RESTORE", "LOCK",
        "CanModerate", "AuditTrail"
    ])
    require_file("media/security/security_test.go", [
        "TestOutboundEndpointRejectsLocalPrivateAndResolvedSSRF",
        "TestWebhookVerifierRejectsTamperExpiryReplayAndSupportsKeyVersion",
        "TestModerationIsScopedAuditableAndAppealable",
        "TestSessionBoundaryValidatesExpiryChainNetworkAndCapability",
        "TestGENSVCMediaFixturePersonasAndJourneys",
    ])
    require_file("media/api/security.go", [
        "NewSecureServer", "media.upload", "media.livestream", "media.moderate",
        "handleModerationReport", "handleModerationDecision", "handleModerationAppeal",
    ])
    require_file("media/api/security_test.go", [
        "TestSecureServerRejectsMissingSessionAndActorSubstitution",
        "TestSecureServerAllowsScopedUploadAndModerationAppealTrail",
        "TestSecureServerRejectsUnsafeLivestreamAndInvalidUploadMetadata",
    ])
    require_file("media/fixtures/fixtures.go", [
        "USER", "CREATOR", "MODERATOR",
        "SVC-JOURNEY-001", "SVC-JOURNEY-008", "SVC-JOURNEY-009", "SVC-JOURNEY-010",
    ])
    require_file("docs/apps/media/security.md", [
        "MEDIA-SEC-001", "SSRF / endpoint abuse", "Parser/codec/process isolation",
        "Malicious media", "Operator compromise", "WEBHOOK_REPLAY",
    ])
    require_file("docs/apps/media/operator-guide.md", [
        "Process isolation", "Network egress", "Malicious media", "Operator compromise", "Monitoring", "Recovery"
    ])
    require_file("docs/apps/media/user-guide.md", ["Upload", "Playback", "Livestreaming", "Reports and appeals"])
    require_file("docs/apps/media/developer-guide.md", [
        "NewSecureServer", "SessionTokenProvider", "Moderation API", "Webhook verification"
    ])
    require_file("docs/apps/media/configuration-deployment.md", [
        "MEDIA-AUDIT-12", "secure Media API composition", "Session model", "Scanner and quarantine",
        "Egress policy", "Process sandbox", "Observability",
    ])
    require_file("docs/apps/media/known-limitations.md", [
        "MEDIA-AUDIT-11 closes the repository audit phase", "MEDIA-AUDIT-12/13"
    ])

    web = json.loads((ROOT / "media" / "web" / "runtime-config.json").read_text(encoding="utf-8"))
    require(web.get("site", {}).get("productionOrigin") is None, "web runtime must not claim a production origin")
    require(web.get("api", {}).get("baseUrl") is None, "web runtime must not claim a production API")
    require(web.get("network", {}).get("chainId") is None, "web runtime must not claim a chain ID")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("420Media MEDIA-AUDIT-11 security closeout verifier: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
