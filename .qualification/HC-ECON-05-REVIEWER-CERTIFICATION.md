# HC-ECON-05 — Reviewer certification and issuance gate

Scope: E06–E08 (T-REV-01..03) under `docs/highcountry/HC-ECON-00-ARCHITECTURE-BASELINE.md`. The project owner retains governance; reviewers do not mint items, release earnings or select modifier rolls. No live deployment or payment compensation is claimed.

## Implementation

`services/highcountry-economy/src/reviewer-certification.js` registers an operator-authorized Ed25519 reviewer public key and expiry, issues scoped, unique immutable artwork-revision assignments and verifies exact Ed25519 signatures over version, certificate ID, assignment, reviewer, asset ID, revision, image checksum, metadata checksum, natural-language description and issuance time. Automation evidence is independently verified before human certification; an assigned active reviewer must not be the creator. The same immutable HC-ECON-04 creator record is rechecked in the serializable transaction. Certificates begin pending QA and never authorize new publication until independent scoped QA approves.

The signed certificate, reviewer status, completed assignment, automated-check evidence ID, matching original image/metadata checksum, creator identity and independent QA are all rechecked **inside** the same serializable transaction that publishes a design, reserves an issuance slot or commits an item. Reviewer expiry, suspension, credential revocation, certificate revocation and open disputes fail closed for new issuance. Previously issued items retain their immutable issuance count and existing historical receipts; no refund or supply replenishment is created.

Warnings are cumulative and audited. Explicit scoped QA/operator decisions can suspend, reinstate, revoke, reject, adjudicate an appeal or restore a previously QA-approved certificate; no unapproved default numeric warning threshold or QA deadline is fabricated. Each event has append-only sequence/audit data in existing PostgreSQL ordinary-state serialization. The code exposes no public role-grant or live publication HTTP route.

T-REV-01 reviewer compensation is **not activated** here: the canonical dependency ordering explicitly places fee settlement and payout under HC-ECON-06. A QA-approved certificate is a prerequisite for eventual fee release, never a payment itself.

## Security and acceptance

`services/highcountry-economy/test/reviewer-certification.test.js` covers genuine Ed25519 proofs, signed payload tampering, automation failure, review role/assignment separation, exact immutable revision binding, QA denial and approval, assignment/certificate replay, concurrently contested certification, suspended/expired/revoked reviewer, multiple warnings, dispute and appellate resolution, historic evidence and session-scope revocation.

`services/highcountry-economy/test/item-issuance.test.js` retains issuance/edition regressions using genuine signed reviewer fixtures; includes explicit no unsigned/unapproved design publication, no reserve after reviewer suspension and no issuance after certificate revocation. `services/highcountry-economy/test/postgres-store.test.js` is part of the same focused qualification because serialization is changed.

Scoped workflow: `.github/workflows/highcountry-hc-econ-05-l1.yml`, exact checked-out PR SHA, Node 22, three targeted test files. Passing GitHub runs must be recorded separately; this document does not claim unexecuted tests passed.

## Deferred original dependencies

HC-ECON-06 owns signed $420 payment confirmation, 10/40/50 distribution, escrow release after QA and appeal window and fee restitution. HC-ECON-TN owns live independent reviewer signer synchronization, contract/issuer authorization and production deployment pins. Activation without this evidence remains denied by default.
