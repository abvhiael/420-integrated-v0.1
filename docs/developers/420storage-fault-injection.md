---
title: 420Storage adversarial and fault-injection qualification
audience:
  - developer
  - operator
category: developer
status: development
version: current
---

# 420Storage adversarial and fault-injection qualification

SR-10.2 qualifies the production Resource Network against deterministic provider, discovery, integrity, authorization and timeout failures while preserving the SR-10 authority boundary: operational discovery and routing remain derived, while canonical object, manifest, placement, proof and settlement truth remains anchored by protocol state.

## Qualified fault classes

The production qualification harness covers:

- one provider discovery source disappearing while another provider remains healthy;
- all configured provider discovery sources failing, which fails the aggregate topology closed;
- malformed, unsupported or stale discovery endpoints being filtered before routing;
- provider service disappearance and deterministic rejoin through the runtime lifecycle;
- cache payload substitution/poisoning, with integrity rejection before verified Store fallback;
- cancellation during an upstream timeout storm, preventing unbounded fallback work after the request context expires;
- private-read spoof attempts, which remain default-deny when the authorizer rejects the supplied subject/session context.

## Discovery isolation semantics

`MultiProviderResourceDiscovery` treats provider discovery as an operational availability surface rather than canonical state. A single provider discovery failure no longer invalidates healthy peer providers. The aggregate fails only when no discovery source succeeds, the request is invalid, or the caller context is cancelled.

Endpoints returned by provider discovery are admitted only when they have non-empty provider/node/service identity, a requested valid capability, a routable running state (or explicitly requested degraded state), and either an endpoint or an in-process source binding. Invalid or stale entries are ignored and cannot become authoritative through aggregation.

## Integrity under adversarial routing

Gateway routing continues to verify the expected shard size and SHA-256 root before accepting cache or Store bytes. A corrupt cache entry therefore records a failed cache attempt and may fall through to a later verified Store candidate, but it can never satisfy retrieval merely because discovery ranked it first.

This qualification does not redefine object identity. Failover candidates must still satisfy the caller's existing object/manifest/shard/root/size/commitment request.

## Timeout and cancellation boundary

Fault injection includes an upstream source that blocks until the request context is cancelled. Once cancellation occurs, Gateway routing stops attempting later sources. Production retry behavior must remain bounded by the caller context and retry policy; availability recovery is not allowed to outlive request authority.

## Authorization boundary

Private Gateway reads remain default-deny. Forwarded or caller-supplied identity fields do not become trusted merely because they are syntactically present. The configured `GatewayAccessAuthorizer` remains the authority for private access, and an authorization rejection terminates routing before any payload source is consulted.

## Exit criteria

SR-10.2 is qualified when the exact branch head demonstrates all of the following in CI:

1. healthy providers remain discoverable when a peer discovery source fails;
2. all-provider discovery failure fails closed;
3. malformed/stale discovery entries cannot enter active routing;
4. provider disappearance removes the failed service from active discovery and deterministic rejoin restores it;
5. corrupt cache/store bytes cannot pass integrity verification;
6. cancellation bounds timeout/fallback behavior;
7. private authorization remains default-deny under spoof attempts;
8. node420, 420 Integrated and 420Docs qualification are green on the same exact head.

## Related documentation

- [Production topology and multi-provider qualification](420storage-production-topology.md)
- [Storage and Resource integration](storage-and-resource-integration.md)
- [420Storage Developer Hub](420storage-developer-hub.md)
