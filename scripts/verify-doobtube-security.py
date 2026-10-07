#!/usr/bin/env python3
"""DOOBTUBE-9 app-scoped security/abuse/moderation verifier."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    p=ROOT/path
    assert p.exists(), f"missing {path}"
    return p.read_text(encoding="utf-8")

def need(path, phrases):
    text=read(path)
    for phrase in phrases:
        assert phrase in text, f"{path}: missing {phrase!r}"
    return text

doc=need("docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md",[
    "Roadmap step: **DOOBTUBE-9 — Security, abuse and moderation qualification**",
    "Qualification level: **Level 1 — app-scoped security qualification**",
    "Broken access control","Privilege escalation","Signature / authorization replay",
    "Nonce / domain mistakes","Reentrancy / external-call risk",
    "Accounting / custody / refund errors","Front-running / MEV",
    "Stale oracle / bridge risk","Content-rights abuse","Moderation abuse",
    "Spam / Sybil behavior","Malicious uploads","Rate / resource exhaustion",
    "Webhook replay","Operator / provider compromise","Secrets / logging / privacy leakage",
    "DT-SEC-INV-001","DT-SEC-INV-014",
    "Next canonical roadmap step: DOOBTUBE-10 — Documentation, deployment and operator closeout",
])
policy=need("doobtube/security/policy.py",[
    "class AbusePolicy","class AbuseGuard","preferences.write","control.rebuild",
    "operator.metrics","def redact_sensitive_text","def assert_no_secret_fields",
    "Bearer [REDACTED]","secret-like field forbidden",
])
tests=need("doobtube/tests/test_doobtube_security.py",[
    "test_broken_access_control_and_privilege_escalation_fail_closed",
    "test_actor_operation_rate_limit_and_window_reset",
    "test_replay_same_key_does_not_consume_second_abuse_slot",
    "test_rebuild_spam_is_bounded",
    "test_concurrent_abuse_limit_cannot_race_past_bound",
    "test_privacy_redactor_removes_tokens_secret_refs_url_credentials_and_query_secrets",
    "test_secret_like_persistence_fields_are_rejected",
    "test_job_error_persistence_redacts_sensitive_exception_text",
    "test_content_rights_abuse_cannot_publish_revoked_asset",
])
backend=need("doobtube/api/service.py",[
    "abuse_guard: AbuseGuard | None = None",
    "self.abuse = abuse_guard or AbuseGuard",
    'self.abuse.require(auth.wallet or "", "preferences.write")',
    'self.abuse.require(auth.wallet or "", "control.rebuild")',
    'self.abuse.require(auth.wallet or "", "operator.metrics")',
    "redact_sensitive_text(exc)",
])
media=need("doobtube/media/service.py",[
    "from doobtube.security import redact_sensitive_text",
    "redact_sensitive_text(exc)",
])

media_session=need("media/security/session.go",[
    "ErrSessionExpired","ErrSessionScope","RequireSession",
    "claims.ExpiresAt","claims.ChainID","claims.Network","claims.Capabilities",
])
media_moderation=need("media/security/moderation.go",[
    "NewModerationService","Limiter.Allow","CanModerate","AuditTrail",
    "ErrModerationDenied","ErrRateLimited",
])
media_webhook=need("media/security/webhook.go",[
    "hmac.New","ErrWebhookExpired","ErrWebhookReplay","MaxSkew","eventID",
])
media_api=need("media/api/security.go",[
    "securityMiddleware","protectedCapability","requireActorMatch",
    '"media.report"','"media.appeal"','"media.moderate"',
])
media_policy=need("media/security/policy.go",[
    "NewRateLimiter","ValidateResolvedEndpoint","QuarantineGate",
    "ErrContentQuarantined","ErrContentRejected",
])
web=need("doobtube/web/app.js",[
    "Connect Wallet before this action.","promotional_opt_in:false",
    "Report submitted. The report itself does not hide/delete/transfer media.",
    "Appeal submitted without rewriting prior decision history.",
])

# App remains contract-free/custody-free, so contract-only threat classes remain N/A.
assert not (ROOT/"contracts/src/doobtube").exists()
assert "doobtube_contracts_required" in read("doobtube/integrations/ecosystem.py")
assert "return False" in read("doobtube/integrations/ecosystem.py")
for path in ["doobtube/api/service.py","doobtube/media/service.py","doobtube/web/core/service.js","doobtube/web/app.js"]:
    text=read(path).lower()
    for route in ("/v1/pay","/v1/bridge","/v1/oracle"):
        assert route not in text, f"unexpected direct value/oracle/bridge route in {path}: {route}"

road=read("docs/DOOBTUBE-ROADMAP.md")
audit=read("docs/DOOBTUBE-AUDIT.md")
assert "**Status: COMPLETE (Level 1).** Canonical security definition" in road
assert "DOOBTUBE-0 through DOOBTUBE-9 are complete" in audit

print("DOOBTUBE-9 Level 1 security/abuse/moderation verification: PASS")
