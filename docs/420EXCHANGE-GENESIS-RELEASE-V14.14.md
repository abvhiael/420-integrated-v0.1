# 420Exchange V14.14 Genesis Release Qualification

V14.14 closes the repository implementation of the first Genesis-ready 420Exchange web client. Repository qualification and production-live qualification are deliberately separated.

## Repository qualification

The exact feature head must pass:

- 420Exchange Web Verification
- 420 Integrated Qualification
- 420Docs Qualification
- V14.14 release qualification tests
- V14.13 production artifact construction
- security/secret checks
- performance budget checks
- latest-main reconciliation followed by another exact-head qualification pass

The release model composes the real V14 market, swap, limit-order, bridge, wallet/session, reliability, security and deployment primitives. It does not replace live testnet drills with mocked chain success.

## End-to-end drills represented in repository tests

- market browse and canonical market normalization
- swap intent review and wallet signing gate
- limit-order review integrity
- bridge route qualification and intent review
- wallet account/network generation invalidation
- degraded/API-version failure handling
- reorg/replacement semantics inherited from V13 store/history qualification
- production artifact construction
- mobile/browser support matrix
- static asset performance budgets

## Performance budgets

- HTML: <= 100 KB
- JavaScript: <= 300 KB
- CSS: <= 200 KB
- total static application payload: <= 1 MB

If the production artifact exceeds a budget, V14.14 does not qualify until the budget is deliberately revised or the artifact is reduced.

## Supported browser qualification matrix

- Chrome current and previous two major versions
- Edge current and previous two major versions
- Firefox current and previous two major versions
- Safari current and previous two major versions
- iOS Safari current and previous two major versions
- Android Chrome current and previous two major versions

Repository tests validate browser-neutral application contracts. Real-device/browser smoke testing remains part of the production operational gate.

## Operational gates before production-live

Repository green does **not** claim that the public Exchange is live. Production-live status additionally requires:

1. production chain ID, RPC and Explorer configuration
2. V13 production API and stream configuration
3. DNS/TLS/hosting cutover for `exchange.420integrated.org`
4. live/testnet swap execution drill
5. live/testnet limit-order create/fill/cancel drill
6. live/testnet bridge lifecycle drill
7. public-domain CSP/security-header verification
8. wallet reconnect/account/network-change smoke drill
9. stale API/reconnect/reorg replacement smoke drill
10. desktop/mobile browser matrix smoke test

## Merge sequence

1. Qualify the active V14.14 exact head.
2. Fetch latest `main`.
3. Reconcile the V14 branch with latest `main`.
4. Run exact-head Exchange Web, Integrated and Docs qualification again.
5. Merge PR #345 only when all required checks are green.
6. Build the production artifact from the merged exact source SHA.
7. Perform operational gates before labeling `exchange.420integrated.org` production-live.

This keeps the repository release deterministic while refusing to claim real network/DNS deployment that has not happened.
