# DOOBR R02.2 — Identity, wallet consent and RBAC/ABAC

Status: IMPLEMENTED PENDING Level 1 checks. PR #601. Base main `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. Canonical definition: **R02.2 Identity/session/wallet consent and RBAC/ABAC, expired-role revocation.**

## Scope delivered
The database migration `doobr/storage/migrations/0002_identity.up.sql` defines tenant-scoped revocable sessions, audience-bound opaque token-jti hashes, consent expiry, role/resource grants and audit evidence. All three new tenant-bearing tables have FORCE RLS and no PUBLIC access. The authentication boundary `doobr/auth.py` validates identity through an injected independent `TrustedIdentity` protocol that must verify an issued signed token and current revocation; locally it checks audience `doobr-api`, subject/token consistency, expiry, actor/tenant binding, wallet-consent expiry where required, and bounded role/action/resource permission. Verified roles do **not** originate from Wallet presence or unverified user-declared scopes. Identity upstream outages, revocation lookup errors and store failures deny. `set_tenant_context` is server-only and must execute inside the DB transaction *after* authoritative authorization. These checks are not legal age verification.

Security invariants: no consumer/operator/courier escalation; no cross-tenant grant authorization; revoked role or session immediately denies on next authorization; expired consent denies wallet-gated operations; UNKNOWN signed token is not trusted; never accept unconstrained DB GUC from an untrusted caller, privileged DB account, table owner or BYPASSRLS principal as an API role.

## Tested Level 1 inventory
- `doobr/storage/tests/test_auth.py`: positive authorized assignment, role and resource confusion, missing or expired wallet consent, issuer outage, issuer revocation, local revocation and session expiry, expired role, cross-tenant attempted access, invalid action, DB transaction context parameterization.
- `doobr/storage/tests/r02_2_rls.sql`: actual Postgres/PostGIS migrations on isolated CI, missing-tenant deny, tenant-separated session and role visibility, cross-tenant grant insertion denial, FORCE RLS on all identity tables.
- `.github/workflows/doobr-r02-2-level1.yml`: exact SHA push/PR qualified CI; no unrelated repository Solidity, Genesis, Docs or Geth inventory.

## External integration limits
A genuine 420Identity trusted issuer format, signer rotation, token revocation API and 420Wallet cryptographic consent protocol **must be confirmed from their independently qualified contracts** before this adapter can be connected to a live user-facing API. The `TrustedIdentity` interface is a trust boundary rather than a fabricated issuer. A concrete HTTP service, persistent-session repository integration and end-to-end browser/mobile wallet flow are not yet wired; they require R02/R03/R04 integration acceptance and R06 release gates. The injected `AuthorizedSessionStore` contract likewise must be backed by a trusted server-owned transaction and externally validated tenant membership. The test doubles are not acceptance of production 420Identity.

R02.2 preserves previous qualified R02.1 encryption/PostGIS foundation and R01 authority lock. R02.13 Level 2 and R05.10 Level 3 are deferred. No live regulated operations permitted.

Next canonical step: **R02.3 Retailer licensing/municipal evidence; seller-of-record order adapter and prepaid proof.**
