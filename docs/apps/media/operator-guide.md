---
title: 420Media Operator Guide
audience:
  - operator
  - security
  - developer
category: how-to
status: current
version: current
---

# 420Media operator guide

## Preflight

Before enabling Media traffic, verify:

1. intended chain/network identity;
2. qualified exact release SHA;
3. Media contract/runtime identities where deployed;
4. canonical Identity/Rights/Storage/Pay/Compute dependencies;
5. `420/service/media/v1` discovery record when materialized;
6. secure Media API composition, never the internal unsecured constructor;
7. verified-session provider and expiry policy;
8. scanner/quarantine availability;
9. DNS-aware SSRF validation and egress policy;
10. secret-manager-backed credential resolution;
11. codec/process sandbox policy;
12. rate-limit and moderation stores;
13. observability and rollback readiness.

If any authority/dependency identity is ambiguous, fail closed.

## Secrets

Never put stream keys, bearer tokens, signer secrets or provider credentials in:

- chain state;
- Media job input refs;
- stream endpoint URLs;
- logs;
- runtime JSON checked into the repository.

Persist only opaque credential references.

Remote signer tokens are referenced by environment-variable name. Diagnostics redact URL paths/query/userinfo.

Rotate a suspected credential before restarting affected sessions.

## Process isolation

FFmpeg/GStreamer profiles are operator-controlled static configuration. Requesters do not supply command text.

Executors must:

- execute binaries directly with argv;
- never invoke a shell;
- run with no-new-privileges;
- drop Linux capabilities;
- use a read-only root filesystem where practical;
- isolate temporary storage;
- apply seccomp or equivalent syscall filtering;
- bound memory/CPU/PIDs and parallel jobs;
- terminate work at Media job/session deadlines.

Do not loosen sandboxing to make malformed media process successfully.

## Network egress

Media transport workers require explicit egress policy.

The application rejects obvious local/private endpoints and secure-composition deployments must additionally validate resolved IPs.

The infrastructure egress layer must prevent DNS rebinding from reaching:

- loopback;
- cloud metadata;
- cluster control-plane networks;
- private databases;
- signer/secret-manager admin interfaces;
- internal RPC endpoints not explicitly required.

## Malicious media

Every externally sourced upload must pass the configured scanner/quarantine gate before it is promoted as safe/READY for user consumption.

Treat parser crashes, codec hangs, extreme dimensions/bitrates and decompression bombs as hostile input.

On scanner/process anomaly:

1. preserve asset/upload/provenance identifiers;
2. quarantine application visibility;
3. do not publish to Search;
4. stop downstream processing;
5. retain forensic hashes, not raw secrets;
6. alert operator/security;
7. require explicit re-scan/review before restore.

## Moderation

Moderator authority is Media-domain scoped.

Allowed application outcomes include hide, suspend, restore, lock and an auditable moderator decision.

Moderators cannot:

- transfer assets;
- revoke 420Identity;
- rewrite 420Rights;
- release/refund Pay;
- mutate Compute authority;
- sign Wallet transactions.

Appeals preserve the original decision.

## Operator compromise

If an operator or processing node is suspected:

1. stop accepting new jobs on that operator;
2. deactivate/suspend the operator through the canonical Media governance path where applicable;
3. rotate signer/credential material;
4. invalidate affected leases/sessions;
5. compare finalized chain job/stream/settlement state;
6. quarantine outputs produced during the suspected window;
7. rebuild derived projections;
8. preserve audit evidence;
9. re-enable only after runtime/config/hash and dependency validation.

Never compensate for a compromised operator by editing canonical settlement/rights history in an application database.

## Monitoring

Alert on:

- unexpected operator capability/lifecycle changes;
- repeated lease loss;
- scanner unavailable/quarantine spikes;
- upload/request rate-limit saturation;
- repeated endpoint validation failures;
- stream reconnect exhaustion;
- authentication/session-scope failures;
- webhook signature/replay failures;
- moderation-volume or moderator-scope anomalies;
- Registry/runtime identity drift;
- Search projection visibility leakage;
- Pay/Compute/Storage canonical disagreement.

Do not log raw media, stream secrets, authorization tokens or private-key material.

## Recovery

Derived application data is rebuildable.

After failure:

- recover from canonical Media/Storage/Identity/Rights/Pay/Compute state;
- replay Indexer projections from a trusted finalized point;
- restore session/moderation stores from bounded backups where required;
- do not infer canonical state from the web UI;
- rerun exact release smoke/security checks before resuming writes.

## Qualification boundary

MEDIA-AUDIT-11 proves repository security and Level-3 merge-candidate qualification.

MEDIA-AUDIT-12 owns production-equivalent public-testnet deployment, live scanner/secret/egress/rate-limit/monitoring/recovery evidence.
