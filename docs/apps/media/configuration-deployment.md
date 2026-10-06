---
title: 420Media Configuration and Deployment
audience:
  - operator
  - developer
  - security
category: application
status: current
version: current
---

# 420Media configuration and deployment

## Repository profile

Canonical repository security profile:

`media/deploy/security-profile.json`

The profile is intentionally **not** a production deployment manifest.

It freezes the security properties a testnet/production deployment must materialize while leaving chain/network/origins/Registry record unresolved.

## Required runtime materialization

MEDIA-AUDIT-12 must supply and retain evidence for:

- chain ID and network;
- exact source/release SHA;
- deployed Media contract addresses where applicable;
- `420/service/media/v1` Registry publication;
- Media API origin;
- web origin;
- qualified RPC endpoints;
- Storage transport/service discovery;
- session-verifier/issuer configuration;
- content scanner;
- moderation store;
- durable distributed idempotency/replay storage;
- secret manager;
- egress policy;
- metrics/logging/alerts;
- backups and rollback.

Do not commit secrets into repository JSON.

## API deployment

A **secure Media API composition** is mandatory for any deployed authority-bearing ingress.

Deployed authority-bearing Media writes must use `api.NewSecureServer`.

The internal `api.NewServer` constructor is not approved as a production ingress because it does not require a session verifier.

Ingress must enforce reviewed TLS and bounded request/body/concurrency/rate policies.

## Session model

The secure server expects a SessionVerifier supplied by the deployment.

A verified session binds:

- stable session ID;
- actor;
- Wallet;
- chain;
- network;
- expiry;
- action capabilities.

The repository deliberately does not invent a production session issuer. Testnet must integrate the selected Wallet/authentication gateway and prove issue/expiry/revocation/replay behavior.

## Scanner and quarantine

The deployment must connect `QuarantineGate` to a scanner with a stable scanner identity.

No media promoted for public consumption should bypass the scanner/quarantine boundary.

The scanner must run outside the privileged API process and should treat media bytes as hostile.

## Egress policy

Application URL validation is necessary but not sufficient.

Infrastructure must block connections to private/control-plane/metadata networks except explicitly reviewed dependencies.

DNS-resolved addresses must be checked and network policy must remain authoritative against rebinding.

## Process sandbox

The deployment profile requires:

- no shell command construction;
- no-new-privileges;
- all Linux capabilities dropped;
- read-only root where practical;
- private temporary storage;
- seccomp/equivalent;
- PID/memory/CPU bounds;
- bounded worker parallelism.

Profile values are repository closeout defaults and may be tightened per environment. Relaxing them requires explicit security review.

## Observability

Required signals include:

- request/rate-limit counts;
- session/auth failures;
- scanner availability/quarantine/reject;
- upload prepare/transport/readiness latency;
- livestream lifecycle/reconnect exhaustion;
- worker lease loss;
- webhook signature/replay failure;
- moderation reports/decisions/appeals;
- Search projection reorg/rebuild;
- canonical dependency/runtime/Registry drift.

Logs must not include raw media, private media payloads, stream keys, signer tokens, Bearer sessions or private keys.

## Backups/recovery

Back up only data that is not reconstructable from canonical systems and that is required for application continuity, including moderation/audit and durable idempotency/replay state where deployed.

Indexer/Search projections are rebuildable.

Recovery must not restore stale application data over newer canonical chain/Storage/Rights/Pay/Compute state.

## No production claim

Repository closeout keeps production origins and network identity unresolved.

A domain becomes canonical only when deployment/Registry evidence in MEDIA-AUDIT-12/13 says it does.
