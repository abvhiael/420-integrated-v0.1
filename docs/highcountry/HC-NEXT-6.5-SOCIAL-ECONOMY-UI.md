# HC-NEXT-6.5 — Social economy interfaces

## Ownership and authority
The browser modules `clients/highcountry-access-v1/src/social-economy-controller.js` and `social-economy-ui.js` provide account-connected organization, cooperative, delegated permissions, proposals, voting, leadership acceptance and historical activity views. The controller only accepts authenticated registered players and exposes an explicit operation catalogue. It requires a configured authoritative gateway implementing `authenticate, snapshot, authorize, submit, receipt, history` with a signer/session-bound principal, strict operation authorization and an independently finalized canonical operation receipt. An optimistic browser confirmation is not a transaction.

The UI renders dynamic text with `textContent` (not HTML injection). Errors are exposed to players, and mutating buttons stay disabled while each request runs. Permission and membership displays are projections, not delegated signers. On-chain organization, cooperative, leasing and Treasury modules remain the final authorities.

## Integration contract and fail-closed requirements
A production gateway MUST authenticate player sessions and signing wallets; validate contract IDs, membership and delegation rules on every operation; verify R04 EmergencyState; bind signatures, chain, expiry, nonce and exact proposal/asset scope; enforce database ownership/RLS and idempotency; validate finalized canonical receipts and reject stale/reorged events. Read endpoints must enforce member/private history visibility. A gateway submission cannot grant any rights from UI form fields. UI controller rejects absent gateways, unregistered sessions, forbidden operations, unverified action receipts and treasury action camouflage.

Do **not** enable organization funds or shared inventory transfers by this client. Treasury permissions, votes, policy records and approval events are authorization evidence only. A settled history item must have an independently verified canonical ledger receipt, and a permission-history row is never marked settled. The UI has no custody or direct financial-transfer controls.

## Deployment acceptance
Level 1: Node unit/adversarial suite and static checks for both modules. Level 2: integration test using a *real* server-side canonical gateway, independent signer and finalized RPC on a provisioned network, persistent member records, operations and event/indexer histories, with restart/reorg/finality and privilege isolation verification. The UI is not production-ready until that gateway is supplied and these integration gates pass. No simulation is accepted as evidence of on-chain transfer.
