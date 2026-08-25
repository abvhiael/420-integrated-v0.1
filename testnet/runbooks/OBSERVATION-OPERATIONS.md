
# S5.3 Observation Operations Runbook

## Entry

Observation may begin only after the canary state has promoted to `S5-OBSERVATION`.

Enable:
- three controlled public RPC endpoints;
- one WebSocket endpoint minimum;
- explorer frontend/backend;
- rate-limited faucet;
- invite-only external validator onboarding.

Keep:
- general public launch disabled;
- Engine API private;
- admin/debug/personal RPC disabled.

## 72-hour evidence window

Collect service and consensus snapshots continuously.

Required service objectives:
- >= 3 healthy RPC endpoints;
- RPC availability >= 99%;
- RPC p95 <= 1 second;
- RPC error rate <= 1%;
- explorer availability >= 99%;
- explorer indexing lag <= 3 blocks;
- faucet operational with no unresolved abuse incident;
- 15 active seats and >=60 eligible validators;
- zero conflicting QCs;
- zero unexplained SAFETY_HALT;
- no unexplained finality stall beyond 42 slots;
- onboard at least 5 external validators successfully.

## Promotion

After 72 hours:
1. run `evaluate-observation.py`;
2. resolve all MAJOR/CRITICAL incidents;
3. run `public-promotion-preflight.py`;
4. complete observation in the controller;
5. public promotion remains separately gated by the global Step 5 preflight.

No service may expose the Engine API or validator private material.
