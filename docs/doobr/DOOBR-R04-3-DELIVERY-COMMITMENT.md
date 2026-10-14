# DOOBr R04.3 — Minimal delivery attestation commitments without PII

Canonical roadmap R04.3; PR #601; branch `roadmap/doobr-bc-vancouver-infrastructure`. Main at inspection: `bc0faa5dafecda3de0620a9581f9953b89cd95fb` (341 ahead, 1110 behind). Classification: app-scoped Level 1, not R04.11 app Level 2 or R05.10 phase Level 3.

## Implementation and authority

`doobr/delivery_commitment.py` creates a stable versioned SHA-256 domain-separated commitment over a canonical JSON tuple: event kind (PICKUP/HANDOFF/RETURN), fixed-size opaque tenant/order/evidence references, already-established lowercase 32-byte source digest, caller-provided high-entropy nonce, UTC timestamp. No address, recipient name, signature, photo, GPS, contact or payload is accepted or included. Caller MUST generate independent cryptographically random nonces, MUST NOT use personal data as opaque references and MUST retain underlying regulated evidence privately under R02.9 custody controls. Even a hash can become linkable metadata if stable identifiers are disclosed. Accordingly do NOT publish raw commitment inputs on-chain or via 420Travel. Only the final commitment may be considered for a separately approved authority-bearing anchor at a later decision gate; this step creates **no on-chain contract, transaction, public storage, deployment or legal proof of delivery**.

The function is a commitment primitive; it is not attached to an automatic transaction, issuance, public endpoint or settlement path. R04.4 Pay, R04.5 Wallet, R04.6 canonical identity and R04.7 Compliance retain their own authority gates. Absence of a trustworthy upstream source digest or legal carrier approval must fail closed at the upstream service. Downstream consumers must not mistake a digest for signature verification or successful delivery.

## Tests and CI

`doobr/storage/tests/test_delivery_commitment.py`: determinism, single-field domain/binding mutation, invalid/PII-like input rejection, no personal fields in output. `.github/workflows/doobr-r04-3-level1.yml`: exact-SHA pre/post verification, compilation, R04.3 tests, retained R04.2 provider-reference adversarial tests and R04.1 frozen-authority guard.

Implementation SHA: `8aa7317377de03b20827614d799bbd77cd2de763`. Targeted run/job results **pending inspection**; not certified until passing. No full Foundry inventory, Genesis inventory, 420 Integrated or global Docs at this step. Private-record retention, live authority issuance, real regulatory authorization and any approved on-chain anchor remain deferred to their canonical acceptance gates.
Next canonical step: **R04.4 420Pay-bound settlement/receipt and retailer prepaid-order verification; no unauthorized crypto sale/custody.**
