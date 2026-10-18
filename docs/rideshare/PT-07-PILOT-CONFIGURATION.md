# LIFTd PT-07 — Disabled-by-default pilot configuration

**Supplemental repository readiness only.** Canonical L03.11 controlled pilot remains PLANNED and independent L03.8/L03.9/L03.10 and M-L03-B external acceptance remains **NOT ACCEPTED**. Vancouver city only, Canada/BC, liftd-passenger service; excludes airports and cross-boundary routes. No production or passenger authority is created by configuration.

## Controls and integration boundary
- The default configuration requires `enabled:false`, `productionAuthorized:false`, and `passengerTrafficEnabled:false` even if a caller supplies apparently valid issuer evidence. No code path in this pilot module returns an admitted ride or enabled traffic.
- Exact locality matches the existing signed `VANCOUVER_SCOPE`, with explicit airports/cross-boundary denials.
- Pilot driver/vehicle active, suspension, driver–vehicle binding, passenger capacity and eligibility expiration are evaluated for **readiness only**, not substituted for fresh signed Registry/transport proof. Actual dispatch continues to rely on `eligibility.mjs` and `dispatch.mjs`.
- Configure bounded ceilings for active trips, online drivers and offers/minute, plus dispatch-latency, provider-failure and unacknowledged-incident thresholds. Malformed/missing monitoring is denied.
- Requires staffed independent duty primary/backup/supervisor using `operational-safety.mjs`; an emergency stop must already be active. `evaluatePilotEmergencyStop` supports authorized revocable stop commands, optimistic revision binding, and loss-of-monitoring/provider fail-closed conditions. Actual multi-instance stop-store and independent emergency authorization still require deployment verification.
- All new tests are local; no testnet/pilot admissions or licensed Vancouver passenger operations have been demonstrated.

## Acceptance dependency
TN-0–TN-6 must document immutable operator/driver/vehicle acceptance, signed safety, jurisdiction and insurance approvals, real control-plane stop propagation, nonpublic route geometry compliance and capacity/monitoring telemetry on production-equivalent infrastructure before pilot activation. L03.11 is not accepted merely because PT-07 Level 1 passes.

**Qualification:** scoped LIFTd PT-07 Level 1 only; do not rerun global Foundry/Genesis/Integrated/Geth/Docs.
