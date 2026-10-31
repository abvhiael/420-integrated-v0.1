# HC-ECON-06 — fee quotes and settlement policy

Roadmap source: `docs/highcountry/HC-ECON-00-ARCHITECTURE-BASELINE.md`, E01/E02/E04/E05/E06, E28/E29. This implementation is ordinary-service accounting with independently verified settlement adapters; it is **not** evidence of actual deployed $420 transfer finality, live Oracle pricing or on-chain escrow. These are separately gated by HC-ECON-TN.

## Approved pricing and policy
- One asset: 42 USD cents. Bundle of 24 separately identified assets: 420 USD cents.
- USD cents are authenticated by the server, not browser parameters. An operator-provisioned price verifier binds quote ID, account, amount, observation time, expiry and source attestation ID; stale or altered evidence fails closed.
- Payment confirmation requires an independently verified finalized $420 transfer proving the exact quoted token amount and one-time receipt ID. No self-attested proof is sufficient.
- Settlement allocations use integer smallest units: floor(10%) development, floor(40%) community, residual reviewer share; no units are created, lost or silently rounded. Bundle attribution conserves the original sum.
- Each **paid submission**, not each revision, has one permitted free good-faith technical correction. Revision history is retained by HC-ECON-04.
- Assigned reviewer receives exactly 72 hours to decide; missing the deadline causes rejection and refund entitlement. Corrected work gets a new 72-hour reviewer deadline, but not a second correction.
- Second rejection enters a separately scoped developer review for 72 hours. If the developer upholds forfeiture in time, the fee is retained; if overturned or no timely decision, the fee is refundable.
- Forfeiture and refunds are distinct, auditable terminal decisions. Refund transfer needs independently verified finalized payment evidence and cannot repeat.
- Reviewer compensation is contingent on authorized QA and absence of unresolved disputes. No reviewer can authorize their own payout.
- All state survives restart through `PostgresBudsStore` serializable JSONB state. No browser-owned balance, untrusted conversion or BUDS substitution is permitted.

## Qualification
Run only `node --test services/highcountry-economy/test/fee-settlement.test.js` with the exact PR SHA. No global workflow or abandoned qualification policy guard is a prerequisite.

## Deployment boundary
The service consumes independently authenticated `pricing.verifyQuote`, `payments.verifyFinalized` and `payouts.verifyFinalized` adapters, which require deployment pinning, actual chain finality and protection against reorgs before live activation. No deployment secrets, live treasury addresses, settlement oracle or production entitlement are manufactured here.
