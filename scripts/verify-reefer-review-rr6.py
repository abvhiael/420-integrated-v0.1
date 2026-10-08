#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def need(ok, msg):
    if not ok:
        errors.append(msg)

def read(rel):
    p = ROOT / rel
    need(p.exists(), f"missing {rel}")
    return p.read_text() if p.exists() else ""

integrations = read("reefer-review/rr6_integrations.go")
outbox = read("reefer-review/rr6_outbox.go")
composition = read("reefer-review/rr6_service.go")
tests = read("reefer-review/rr6_test.go")
service = read("reefer-review/service.go")
doc = read("docs/reefer-review/RR-6-ECOSYSTEM-INTEGRATIONS.md")
roadmap = read("docs/reefer-review/RR-ROADMAP.md")

for marker in [
    "Search420Adapter", "search/result", "SourceRights", "ReeferSearchCategory",
    "StatusPublished", "VisibilityPublic", "RightsProvenance", "Reconcile(",
    "NotificationPublishRequest", "TargetService", "notifyarch.ServiceID",
    "SourceService", "IdempotencyKey", "Mail420Adapter", "mail420.ServiceID",
    "MailAudience", "Recipients(",
]:
    need(marker in integrations, f"RR-6 integration contract missing {marker}")

for marker in [
    "IntegrationOutboxSchemaVersion", "syscall.Flock", "os.CreateTemp", "tmp.Sync()",
    "os.Rename", "os.Chmod(o.path, 0o600)", "dirFile.Sync()", "IntegrationSearchUpsert",
    "IntegrationSearchDelete", "IntegrationNotifications", "IntegrationMail",
    "QueuedSearch", "QueuedNotifications", "QueuedMail", "IntegrationReconciler", "ReconcileOnce",
]:
    need(marker in outbox, f"RR-6 durable reconciliation missing {marker}")

for marker in ["NewEcosystemIntegrationBundle", "QueuedSearch", "QueuedNotifications", "QueuedMail", "IntegrationReconciler"]:
    need(marker in composition, f"RR-6 composition missing {marker}")

for marker in [
    "TestRR6SearchAdapterPublicOnlyAndRebuildable",
    "TestRR6NotificationsAdapterPreservesProvenanceAndConsentSuppression",
    "TestRR6MailAdapterUsesCanonicalMailSourceAndIdempotency",
    "TestRR6DurableOutboxAndFailureReconciliation",
    "TestRR6SearchDeleteFailureSurvivesIgnoredModerationProjectionError",
    "TestRR6IntegrationBundleRequiresCompleteDependencies",
]:
    need(marker in tests, f"RR-6 test missing {marker}")

if "type NotificationPublishRequest struct {" in integrations:
    request_body = integrations.split("type NotificationPublishRequest struct {", 1)[1].split("}", 1)[0]
    for field in ["Body ", "BodyRef ", "Session ", "Token ", "PrivateKey "]:
        need(field not in request_body, f"notification request exposes forbidden field {field.strip()}")

need('warnings = append(warnings, "search:"' in service, "publication Search failure warning path missing")
need('warnings = append(warnings, "notifications:"' in service, "publication Notifications failure warning path missing")
need('warnings = append(warnings, "mail:"' in service, "publication Mail failure warning path missing")

for suffix in "ABCDEFGH":
    need(f"RR-6.{suffix}" in doc, f"RR-6 requirement {suffix} missing")
need("RR-6 — Ecosystem Integrations" in roadmap, "canonical RR-6 roadmap entry missing")
need("RR-7 — Newsfeed Security" in roadmap, "next canonical step missing")

if errors:
    for e in errors:
        print("ERROR:", e)
    sys.exit(1)

print("Reefer Review RR-6 verifier: PASS")
