# COM-1.7 — Security model and threat assessment

**Canonical roadmap:** COM-1.7 — financial, inventory, upload, access-control, fraud and privacy threat model. **Phase:** COM-1, **PR:** #588. **Deliverable:** explicit security architecture and implementation acceptance requirements, not a claim that unbuilt services have been penetration tested. **Reconciliation base at inspection:** main `ffc6a4028676907c266714b5c1ae8ba3af9a7137`, ahead 17, behind 0.

## Assets, actors and trust boundaries

**Protected assets:** customer funds and refund entitlement; merchant payout controller and withdrawal address; buyer/seller signatures and delegated capabilities; Market listing revision, finite inventory and order lifecycle; Pay payment finality; uploaded media and private customer delivery details; canonical Registry identities; audit/evidence history.

**Untrusted actors:** unauthenticated web visitors; spoofed sellers and phishing domains; buyers attempting duplicate payments/refunds; compromised merchant browser/operator account; malicious uploader/content editor; forged RPC/Indexer/search responses; compromised provider/quote source; cross-tenant API client; Cloudflare/third-party script compromise; erroneous service configuration. A Commerce staff/operator role is *not* canonical financial authority.

**Boundary 1:** browser/client -> Commerce API (all inputs adversarial; independent authentication, signed nonce, CSRF/session safeguards, per-tenant ACL, output encoding).
**Boundary 2:** Commerce service -> Wallet user signatures (no private keys/server custody; chain/contract/action/amount/expiry presented before explicit approval).
**Boundary 3:** Commerce -> Registry/Market/Pay/Swap canonical protocols (only code- and version-verified service endpoints; fail closed on mismatch).
**Boundary 4:** Indexer/Search/Analytics/Notifications -> UI (projections never become payment/stock/identity truth).
**Boundary 5:** Commerce media/private PII -> object storage and merchants (strict isolation, malware/content-type validation, encryption, retention and audited access).

## Threat register (severity based on impact, not unproven exploitability)

| ID / severity | Threat and failure mode | Required defense and test owner |
| --- | --- | --- |
| COM-T01 CRITICAL | Forged Pay receipt, included-but-not-finalized payment or untrusted service marks Market order PAID | Only governed Market settlement reporter; verify canonical Pay finalized settlement and order/buyer/merchant/amount/asset/invoice ID, chain, idempotency. Owning protocol COM-2; negative Foundry tests and COM-8 live proof |
| COM-T02 CRITICAL | Reporter authorized by address alone submits unrelated nonzero paymentRef | Implement verified Pay-to-Market bridge; replay/uniqueness and domain binding; no Commerce server reporter privilege. COM-2 + COM-7 |
| COM-T03 CRITICAL | Merchant takeover, spoofed controller or payout substitution | Fresh Pay MerchantRegistry controller/currentPayout verification, least-privilege scopes, signer confirmation, delayed payout policy, tamper-proof audit. COM-3/4 |
| COM-T04 HIGH | Revision race, exhausted inventory, cart SQL total misused as authoritative | Market createOrder with pinned revision/quote/quantity, canonical reservation; avoid charge before reservation, handle cancellation/recovery and stuck reservations. COM-2/5 |
| COM-T05 HIGH | Double-click, replayed quote, payment nonce collision, duplicate refund or repeated events | Cryptographically scoped idempotency, Pay/Swap replay checks, immutable event identities and transactional inbox/outbox. COM-2/3/5 |
| COM-T06 HIGH | Malicious swap quote, stale quote, under-delivered output or malicious split recipient | Canonical quote engine, 42-second adapter lifetime, healthy market, exact settlement and allowed recipients; no implicit recipient changes. COM-2/5 |
| COM-T07 HIGH | Partial Pay refund presented as terminal Market refund, double-release of stock | Separate Pay partial refund ledger/state from terminal Market REFUNDED; reporter only after full verified authorization. COM-2/6 |
| COM-T08 HIGH | Chain reorg or stale Indexer signals finality, phantom stock or irrevocable fulfillment | Track chainId/blockHash/provenance/finality, rollback/rebuild nonfinal derived state, halt payment/fulfillment on unknown ancestry. COM-3/7 |
| COM-T09 HIGH | Tenant IDOR, merchant editor changes another merchant data or admin bypasses wallet signing | Per-request server-side tenant authorization from canonical controller/delegate; deny direct object reference; adversarial cross-tenant tests. COM-3/4 |
| COM-T10 HIGH | Media upload SSRF, SVG script, HTML injection, decompression bombs, malicious metadata or active content | Allowlist safe media formats, magic-byte checks, size/dimension limits, strip metadata, isolate processing, randomized object IDs, CSP and output encoding; never server-fetch arbitrary URLs. COM-3/7 |
| COM-T11 HIGH | Private shipping address, location, phone or customer data leaked through URLs, logs, events, public buckets or search | Encrypt at rest/in transit, data minimization, audited scoped reads, retention/erasure, private signed object access, no PII on chain. COM-3/6/7 |
| COM-T12 HIGH | Bad manifest, wrong chain, fake verified badge, dependency spoof or unverified Cloudflare URL | Registry-approved chain/interface binding, Wallet verified manifest validation, provenance class-specific labels, fail closed on mismatch. COM-3/4/7 |
| COM-T13 MEDIUM | Session theft, CSRF, account replay, phishing approval or XSS | Anti-CSRF, secure HttpOnly same-site sessions, per-chain signed nonce, TTL, CSP, trusted rendering and explicit wallet confirmation. COM-3/4 |
| COM-T14 MEDIUM | Denial of service, rate abuse, giant search queries, spam listings or resource exhaustion | Per-tenant quotas, bounded pagination, input limits, read cache isolation, timeouts/circuit breakers and abuse audit. COM-3/7 |
| COM-T15 MEDIUM | Dispute/support role becomes unauthorized payment decision-maker | Only Market/Pay/Arbitration bounded authorities; no arbitrary refund/custody or contract state override. COM-6/7 |
| COM-T16 HIGH | Secret leakage, insecure build provenance or production/testnet configuration crossover | No browser-shipped secrets, separated networks, pinned build/config verification, Cloudflare environment review, DNS/TLS/CORS checks, audit and rollback. COM-7/8 |

## Security invariants and acceptance gates

1. **AUTH:** Wallet connection does not authorize merchant mutations. All security-critical writes check signer, chain, canonical owner and narrow capability; app admin cannot become wallet signer.
2. **FIN:** Pay owns invoice/payment/settlement/refund state; Market owns marketplace state. A Market PAID state requires an approved **proof-validating** reporter; a mere nonzero paymentRef or frontend receipt is insufficient.
3. **INV:** Market reservation/consume/release only; carts and Commerce SQL must not oversell or independently guarantee inventory.
4. **REPLAY:** Quote, order, payment and refund IDs are domain-separated and idempotent; duplicate UI sends and indexer replays cannot double-charge/credit/release.
5. **LIFECYCLE:** Market frozen V1 states and valid caller transitions are preserved; Pay partial refund cannot be promoted to terminal Market REFUNDED.
6. **REORG:** Full chain provenance accompanies projections; unfinalized forks may rollback, finalized mismatch halts sensitive operations.
7. **PII:** No plaintext delivery info in public/on-chain/indexed logs, events, URLs or telemetry; merchant access requires purpose and tenant scope.
8. **MEDIA:** Untrusted uploads cannot execute active content, SSRF internal endpoints, cause excessive parsing cost or expose private object paths.
9. **DISCOVERY:** Unknown service ID, unverified manifest, wrong code/version/chain or unhealthy Swap route refuses sensitive writes.
10. **OBSERVABILITY:** Security alerts, immutable audit trails, incident rollback and reconciliation; avoid logging signing secrets or sensitive PII.

## Adversarial test plan and release thresholds

**COM-2 contracts:** forged reporter and proof; duplicate order/payment/refund; state-transition matrix; buyer/seller impersonation; stale listing/revision; insufficient stock; partial refund; caller authorization; exact settlement amount/asset; replay/quote expiry; pause. Use owning protocol targeted Foundry and fuzz/invariants. No new duplicate Commerce order/payment contract.

**COM-3 services:** authentication bypass, tenant isolation/IDOR, CSRF, SSRF, MIME confusion, malicious uploads, XSS, SQL injection, PII log exposure, event fork/replay, restart recovery, stale/unknown canonical source, rate limits and data retention.

**COM-4/5 web:** keyboard/accessible security status, wrong network, phishing manifest, expiry, double click, cancel/retry, included-but-not-finalized warning, settlement reporter outage, idempotent reload/resume, no forced signatures, payment recipient correctness, no false verified badge.

**COM-6/7 integration/ops:** split payout redirection, refunds/cancellations across race/reorg, role revocation, monitoring, incident runbooks, Cloudflare security headers, secrets/config checks, static dependency scanning, manual independent review, recovery drills.

**COM-8 live testnet:** real tx hashes and chain IDs; merchant registration, listing, reservation, Pay finality, Market reporter linkage, refund/replay and actual API outages. No mock can count as live evidence. **COM-9 mainnet:** external security signoff and explicit deployment authorization required.

**Blocking release decision:** Real money checkout remains disabled until COM-T01/T02 verified bridge, COM-T03 funds/controller bindings, COM-T04 stock safety, COM-T05/T06 replay and swap safety, COM-T07 refund semantics, COM-T08 finality/reorg and COM-T09/T11 tenant privacy tests all pass. If these fail, public browse/read-only may be released with truthful degraded presentation but funds-mutating actions must remain unavailable.

## COM-1.7 exit criteria

- [x] Define assets, actors, trust boundaries and explicit protocol ownership.
- [x] Risk-ranked financial, inventory, fraud, authorization, uploader, privacy, deployment and failure threats.
- [x] Invariants and named implementation/test owners across COM-2–8.
- [x] Release-blocking critical checks and threat-to-test traceability.
- [ ] Exact-SHA CI qualification conclusion must be verified separately; architecture review does not prove executable security.

**Level 2** deferred to meaningful working cross-protocol milestone. **Level 3** one COM-1.8 exact-SHA closeout. **Next canonical step: COM-1.8 — Level 3 architecture closeout.**
