---
title: 420Storage security and abuse-resistance qualification
audience:
  - developer
  - operator
  - security
category: developer-guide
status: development
version: current
---

# 420Storage security and abuse-resistance qualification

SR-10.7 qualifies the production storage surfaces against malformed input, request smuggling-adjacent authority confusion, upload replay/exhaustion, private-read bypass attempts, and untrusted endpoint behavior while preserving the Resource Network authority boundary.

The review treats Store, Repair, Cache, Gateway, Relay, developer HTTP and S3-compatible surfaces as operational services. None of those surfaces may manufacture canonical agreement, placement, proof, authorization or settlement state.

## Threat model

The production boundary assumes hostile or malformed callers, compromised client credentials, stale or adversarial discovery entries, spoofed forwarding headers, repeated/replayed upload requests, oversized headers and idempotency keys, payload substitution, and partial provider compromise.

The following are explicitly not trusted as canonical authority:

- HTTP Host forwarding headers supplied by callers;
- discovery endpoint strings without runtime qualification;
- upload receipts or local temporary files;
- cache payloads before commitment verification;
- local service health or filesystem presence;
- backup artifacts from SR-10.6;
- operator-provided remote endpoints unless they are part of trusted deployment configuration.

## Host and forwarded-identity boundary

Gateway and developer HTTP public binds require TLS and an explicit allowed-host policy. The host guard validates the actual request authority (`Host`) and does not promote `X-Forwarded-Host` or similar caller-controlled forwarding headers into trust.

Wildcard, URL-form, path-bearing and whitespace-bearing allowed-host entries are rejected. Reverse proxies must normalize and terminate forwarding policy outside the storage process; forwarded headers are not authorization credentials.

## Private reads

Private retrieval remains default-deny. A private request requires a subject, session identifier, the read capability and an installed authorizer. Missing authorizer state, malformed access mode, missing identity fields or failed authorization returns `ErrGatewayUnauthorized` before routing to Cache or Store.

## Upload exhaustion and replay resistance

Uploads remain bounded by `DefaultDeveloperUploadMaxBytes` or an explicitly lower deployment limit. The body is staged through a bounded reader and must match both declared size and shard root before it reaches a storage sink.

SR-10.7 adds a 256-byte maximum idempotency-key size and an in-flight reservation per idempotency key. A second concurrent request using the same deterministic upload identity is rejected while the first write is in progress, preventing duplicate backend writes. A completed identical replay returns the recorded receipt without another write. A conflicting upload identity using the same key fails closed.

Failed uploads release their in-flight reservation so an intentional retry can proceed.

## Header and request bounds

The developer HTTP surface rejects oversized request URIs, headers and unexpected request bodies before invoking the developer API. Gateway HTTP applies configured concurrency and per-client rate limits. These controls are defense-in-depth and do not replace upstream connection, bandwidth or volumetric DDoS protection.

## SSRF boundary

Resource discovery metadata alone is not executable network authority. Production topology binds `GatewaySource` implementations to qualified services; the gateway does not take an arbitrary caller URL and fetch it. Operator-configured HTTP source base URLs are therefore part of trusted deployment configuration, not request data.

Residual risk remains if deployment automation accepts untrusted configuration and instantiates an HTTP source from it. SR-10.10 launch evidence must show that source configuration is generated from controlled deployment inputs and reviewed separately from user request fields.

## Integrity and malformed inputs

Cache and Store payloads are verified against the canonical shard identity before success is returned. Unsupported capabilities, stale/stopped discovery entries, missing provider/node/service identity, invalid host policy entries and malformed developer object references are rejected or excluded from routing.

Fuzz and malformed-input coverage from the existing SR-9/SR-10 suites remains part of the final exact-head qualification gate. Any new parser or compatibility surface added after this review must inherit equivalent bounds and fail-closed behavior.

## Secrets and logging

SR-10.5 rules remain binding: raw service credentials, bearer tokens, private session material and replay-sensitive idempotency values must not be emitted in telemetry, qualification manifests or launch evidence. Security failures should log bounded classifications and service identity, not secrets or payload bytes.

## Residual risks

The remaining production risks are primarily deployment-level rather than protocol-level:

- upstream volumetric DDoS can exhaust network resources before application guards run;
- compromised deployment configuration can point trusted HTTP sources at unintended destinations;
- reverse-proxy misconfiguration can weaken TLS or host guarantees before traffic reaches the process;
- provider compromise can destroy local payload availability even though it cannot rewrite canonical storage history;
- dependency vulnerabilities require continuous review after the SR-10.7 point-in-time qualification.

These risks must be represented in SR-10.8 alerts/runbooks and SR-10.9 testnet evidence rather than hidden by a passing unit-test suite.

## SR-10.7 exit evidence

The exact-head qualification should demonstrate at minimum:

1. concurrent upload replay causes at most one backend write;
2. completed identical replay is idempotent and conflicting replay fails closed;
3. oversized idempotency keys and headers are rejected;
4. forwarded-host spoofing cannot bypass the allowed-host guard;
5. private reads without a valid authorizer fail before routing;
6. malformed allowed-host forms are rejected;
7. existing integrity, fault-injection, load, credential and DR suites remain green;
8. 420Docs, node420 Release Gate and 420 Integrated Qualification all pass on the same exact commit.

## Related architecture

- [Storage and Resource integration](storage-and-resource-integration.md)
- [420Storage adversarial and fault-injection qualification](420storage-fault-injection.md)
- [420Storage credential rotation and recovery qualification](420storage-credential-rotation.md)
- [420Storage backup, restore and disaster recovery qualification](420storage-disaster-recovery.md)
- [SR-9 privacy and logging review](420storage-sr9-privacy-review.md)
