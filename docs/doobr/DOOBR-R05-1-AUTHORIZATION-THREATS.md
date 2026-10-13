# DOOBr R05.1 — Authorization, impersonation and privilege escalation

**Canonical repository roadmap:** R05.1 Authorization and cross-tenant security, in `docs/doobr/DOOBR-R01-R06-ROADMAP.md`. User audit scope expands explicit impersonation and privilege-escalation tests. PR #601, `roadmap/doobr-bc-vancouver-infrastructure` remains open and unmerged. Baseline `main` `bc0faa5dafecda3de0620a9581f9953b89cd95fb`, branch ahead 374 / behind 1110 at inspection; current branch requires Level 3 reconciliation at R05.10.

R02.2 `doobr/auth.py` retains independent canonical identity verification, session and role-grant revalidation and fail-closed outages. Existing `test_auth.py` covers revoked sessions/grants, wallet-consent expiry, tenant scope and issuer mismatch. R05.1 adds `doobr/storage/tests/test_r05_1_authorization_threats.py`, a matrix of every cross-role action of `ALLOWED_ACTIONS`, explicitly prohibited privilege actions, forged issuer/subject/audience/token, stolen or replayed token binding, cross-tenant/role/resource attempts, expiry, revocation, canonical authority outages and wallet-consent non-escalation. DOOBr must never infer operational, financial or regulatory roles merely from Wallet consent.

**Boundary limitation:** no app-side proof that an untrusted remote store correctly binds actors to principals; that contract must be enforced by authenticated canonical session-store service and tested in live integration. R05.1 repository-level tests use injected canonical authorities and preserve fail-closed behavior; they do not grant real-world regulated operation.

**Level 1:** `.github/workflows/doobr-r05-1-level1.yml` checks exact SHA before/after, compiles authorization and tests, runs new threat matrix plus retained Identity, Wallet, Registry/provider and mobile replay tests and the R04.1 frozen authority guard. No full Foundry, Genesis, Integrated or global Docs duplication.

**Implementation SHA:** `c261f525d4a7ebcbfda6fe755a5570281bb406cd`. **CI status:** requires exact-run verification before claiming Level 1 PASS. **Evidence HEAD:** this documentation commit only. R04.11 Level 2 already passed on its earlier SHA; R05 Level 2 should be run only at the next meaningful documented milestone; R05.10 Level 3 remains deferred until complete app-phase closeout. Testnet/external DOOBR-AUDIT-9/10 and operational releases remain blocked. DOOBr NON-OPERATIONAL.

**Next canonical step:** R05.2 Privacy, address/GPS exfiltration, retention and deletion conflict testing.
