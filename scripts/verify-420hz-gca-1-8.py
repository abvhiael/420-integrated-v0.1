#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
PRIV=ROOT/"hz"/"config"/"gca-privacy-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.8-STORAGE-RETENTION.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
PROVIDER=ROOT/"services"/"420ai-provider"/"src"/"private-payload-store.js"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [STORE,PRIV,DOC,ROADMAP,PROVIDER]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    store=json.loads(STORE.read_text())
    priv=json.loads(PRIV.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()
    provider=PROVIDER.read_text()

    need(store.get("schema")=="420hz-gca-storage-retention-v1","storage/retention schema drift")
    need(store.get("version")==1,"storage/retention version drift")
    need(store.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(store.get("workPackage")=="HZ-GCA-1.8","work package drift")
    need(store.get("level")==1,"HZ-GCA-1.8 must remain Level 1")
    need(store.get("milestoneRequired") is False,"HZ-GCA-1.8 must not become Level-2 milestone")
    need(priv.get("workPackage")=="HZ-GCA-1.7","HZ-GCA-1.7 prerequisite drift")

    classes={x.get("class"):x for x in store.get("storageClasses",[])}
    expected={"EPHEMERAL_PROVIDER_PRIVATE","HZ_PRIVATE_PRIMARY","HZ_PRIVATE_ARCHIVE","PUBLIC_MEDIA","PUBLIC_COMMITMENT_HISTORY","SECURITY_AUDIT_METADATA"}
    need(set(classes)==expected,f"storage class drift: {sorted(set(classes)^expected)}")
    for cls in ["EPHEMERAL_PROVIDER_PRIVATE","HZ_PRIVATE_PRIMARY","HZ_PRIVATE_ARCHIVE","SECURITY_AUDIT_METADATA"]:
        need(classes[cls].get("offChain") is True,f"{cls} must remain off-chain")
    for cls in ["EPHEMERAL_PROVIDER_PRIVATE","HZ_PRIVATE_PRIMARY","HZ_PRIVATE_ARCHIVE","SECURITY_AUDIT_METADATA"]:
        need(classes[cls].get("encrypted") is True,f"{cls} must remain encrypted")

    policies={x.get("id"):x for x in store.get("retentionPolicies",[])}
    expected_policies={
        "provider-private-payload","failed-cancelled-generation-private","unsaved-generated-takes",
        "active-project-private","archived-project-private","export-package","private-consent-evidence",
        "dispute-evidence-hold","security-audit-metadata","deleted-community-private-state",
        "published-media","public-history"
    }
    need(set(policies)==expected_policies,f"retention policy set drift: {sorted(set(policies)^expected_policies)}")

    expected_retention={
      "provider-private-payload":"24 hours",
      "failed-cancelled-generation-private":"7 days after terminal FAILED/CANCELLED",
      "unsaved-generated-takes":"30 days after generation unless explicitly saved/pinned into an active project",
      "active-project-private":"365 days after last authenticated project activity unless refreshed by user activity/export/save policy",
      "archived-project-private":"30 days after archive/expiry transition",
      "export-package":"24 hours after export package creation",
      "private-consent-evidence":"30 days after the gated action completes unless a live dispute/evidence hold requires longer",
      "dispute-evidence-hold":"through the canonical challenge/appeal window plus 30 days",
      "security-audit-metadata":"90 days",
      "deleted-community-private-state":"30 days after deletion/tombstone",
      "public-history":"indefinite immutable/history-preserving",
    }
    for pid,val in expected_retention.items():
        need(policies[pid].get("maxRetention")==val,f"{pid} retention drift")

    need("maxRetentionMs=24*60*60*1000" in provider,"qualified provider 24h default retention missing")
    provider_rules=" ".join(store.get("providerRules",[]))
    need("defaults to 24h" in provider_rules,"provider 24h retention linkage missing")
    need("must not configure provider private payload retention above" in provider_rules,"provider max-retention guard missing")
    need("plaintext is not persisted" in provider_rules,"provider plaintext persistence prohibition missing")

    deletion=store.get("deletionSemantics",{})
    bounded=" ".join(deletion.get("boundedPhysicalDeletion",[]))
    for token in ["<=24h","<=7d","<=30d","<=24h absolute maximum"]:
        need(token in bounded,f"bounded deletion SLA missing: {token}")
    anti=" ".join(deletion.get("antiResurrection",[]))
    for token in ["tombstone wins","reapply deletion/tombstone ledger","must not resurrect","must not restore expired private payloads"]:
        need(token in anti,f"anti-resurrection rule missing: {token}")

    quota=" ".join(store.get("quotaRules",[]))
    need("not invented as protocol constants" in quota,"quota non-protocol-constant rule missing")
    need("never silently discard unrelated saved work" in quota,"quota no-silent-discard rule missing")
    need("never silently deleted" in quota,"published/history quota protection missing")

    backups=" ".join(store.get("backupRecoveryRules",[]))
    need("ordinary private backups expire within 30 days" in backups,"backup 30d limit missing")
    need("replay deletion/tombstone state before serving restored objects" in backups,"restore anti-resurrection missing")
    need("must not become a hidden retention bypass" in backups,"provider backup bypass prohibition missing")

    authority=" ".join(store.get("storageAuthorityRules",[]))
    need("420Hz owns only application-controlled private project/archive/export stores" in authority,"420Hz storage authority bound missing")
    need("retain authority over their own agreements" in authority,"external storage authority missing")
    need("not deleted by private-data erasure" in authority,"immutable history exception missing")

    failures=set(store.get("failureRules",[]))
    required_failures={
      "attempt to configure provider private-payload retention above 24h fails closed",
      "expired provider payload access fails closed and triggers deletion",
      "quota exhaustion cannot silently delete saved/pinned or published content",
      "restore that cannot reconcile deletion/tombstone state fails closed before serving private objects",
      "Search/Indexer/Notifications resurrection of deleted private state is invalid",
      "deletion of private application data cannot be represented as erasure of immutable public canonical history"
    }
    for f in required_failures:
        need(f in failures,f"required failure rule missing: {f}")

    inv=store.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-STORE-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-STORE-{i:03d} "),f"invariant numbering drift at {i}")

    for source in store.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled storage source: {source}")

    for token in [
      "provider execution payloads may never be retained longer than 24 hours",
      "maximum **7 days** after terminal FAILED/CANCELLED",
      "maximum **30 days** after generation",
      "maximum **365 days after last authenticated project activity**",
      "Backup restore must replay deletion/tombstone state",
      "quota exhaustion must not silently destroy unrelated saved/pinned work",
      "Private-data deletion must **not** be described as erasing immutable canonical history.",
      "HZ-GCA-1.9 — Define generation economics"
    ]:
        need(token in doc,f"normative storage token missing: {token}")

    need("HZ-GCA-1.8 — Define storage & retention rules" in roadmap,"roadmap HZ-GCA-1.8 missing")
    need("machine-readable retention manifest" in roadmap,"roadmap retention deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.8 storage retention",
  "level":1,
  "policies":0 if errors else len(store.get("retentionPolicies",[])),
  "errors":errors,
},indent=2))
raise SystemExit(0 if not errors else 2)
