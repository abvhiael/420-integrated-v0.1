# 420Mail MAIL-2.15 Qualification

## Step
**MAIL-2.15 — Discord Account Linking**

## Completion
- Status: **COMPLETE**
- Qualification: **Level 1 — app-scoped**
- Qualified implementation SHA: `fb742b4172a01f514bba2eb9f3f2d2c605ca696a`
- Exact qualified merge candidate: `a7eb04d60d6c6b4baefd333fa82d229634980c53`
- Base/current `main`: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Implementation
MAIL-2.15 adds a concrete Discord **LINK-only** adapter on top of the provider-neutral MAIL-2.14 connector framework.

Repository surfaces:
- `mail/discord_link.go`
- `mail/discord_link_test.go`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`

The adapter:
- registers provider `discord`;
- declares only `LINK`;
- delegates Discord OAuth/broker exchange and unlinking to an injected `DiscordLinkAuthority`;
- accepts only the generic opaque secure-broker authorization reference;
- requires a verified numeric Discord snowflake identity;
- requires the `identify` scope;
- binds the resulting connection to the authenticated 420Mail identity;
- uses `discord:{snowflake}` as connection ID;
- stores no Discord access token, refresh token, client secret, provider password, or signing secret in Mail metadata;
- supports unlinking through the same authority;
- explicitly leaves pull/sync, push/delivery, webhook ingestion, and wallet verification unsupported for later roadmap steps.

## Security / boundary qualification
Tests cover:
- provider descriptor and link-only capability;
- connector-service registration;
- verified account linking;
- display-name fallback;
- invalid/malformed snowflake rejection;
- missing/duplicate/wrong scopes;
- unverified/custodial/untimestamped authority results;
- wrong provider and missing authenticated actor;
- unlink connection-ID validation;
- explicit rejection of pull/push/webhook capabilities;
- dependency failure with no fallback.

## Qualification evidence
Workflow: **420Mail Audit Qualification**
- Run: **37499331421** (#232)
- Job: **112391977006**

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- Verifier output: `MAIL-2.15 Discord account linking: qualified by app-scoped checks`

Exact tested merge candidate:
`a7eb04d60d6c6b4baefd333fa82d229634980c53 = fb742b4172a01f514bba2eb9f3f2d2c605ca696a + d86a3810d2901dc1082b65dc9061896c46e1911d`

## Superseded attempt
Run **37499225021** / job **112391610019** passed exact head and formatting but failed Go compilation because `mail/discord_link.go` introduced a package-level `containsString` helper already defined in `mail/organization.go`. The Discord helper was renamed to `discordHasScope`. That run is superseded and is not completion evidence.

## Milestone status
MAIL-2.15 is the first step of the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

Level 2 is **not due** at this ordinary step. The prior Wallet-native identity milestone remains complete and valid.

Level 3 is intentionally deferred to app-phase closeout.

## Deferred live/provider evidence
Repository completion does not claim:
- live Discord OAuth client credentials;
- redirect URI/provider console configuration;
- production authorization-code exchange;
- token refresh/revocation behavior;
- live Discord availability/rate limits;
- public-testnet account linking;
- Discord sync, delivery, webhook, or wallet-verification behavior.

Those belong to later roadmap/live qualification.

## Evidence inheritance
This evidence file and the roadmap bookkeeping change are documentation/evidence-only and inherit the qualified implementation SHA without recursive requalification.

## Next canonical step
**MAIL-2.16 — Discord → 420Mail Sync**
