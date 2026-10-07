# 420Mail Wallet-Native Identity Milestone Qualification

## Milestone

**MAIL-2.11 through MAIL-2.14 — Wallet-native identity milestone**

Included canonical steps:

- MAIL-2.11 — Email-as-a-Wallet Onboarding
- MAIL-2.12 — Passkey-First Security
- MAIL-2.13 — Wallet Functions Inside Mail
- MAIL-2.14 — External Integrations Framework

## Completion

- Milestone status: **COMPLETE**
- Qualification level: **Level 2 — retained 420Mail app integration**
- Qualified implementation SHA: `aa299b706ff2739e9e010f1140c435af3fdd0218`
- Exact qualified merge-candidate SHA: `36c768ce3f60bfdb79295eaf53a3f1bbb54a33b5`
- Reconciliation/base `main` SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Retained integration coverage

Repository evidence shows one canonical 420Mail qualification workflow:

`.github/workflows/420mail-audit.yml`

On the exact merge candidate above it executed:

- exact-head assertion;
- Go format across `mail`;
- `go test ./mail/...`;
- `go test -race ./mail/...`;
- `go vet ./mail/...`;
- cumulative `scripts/verify-420mail-audit.py`.

This is broader than an individual step-only test selection and is the retained app suite for accumulated Mail behavior.

The verifier output explicitly reconfirmed all accumulated roadmap steps MAIL-2.1 through MAIL-2.14, including:

- MAIL-2.11 onboarding;
- MAIL-2.12 passkey-first security;
- MAIL-2.13 wallet functions;
- MAIL-2.14 provider-neutral connector framework.

## Qualification evidence

Workflow: **420Mail Audit Qualification**

- Run: **37497394655** (#222)
- Job: **112385344705**
- Exact checkout:
  `36c768ce3f60bfdb79295eaf53a3f1bbb54a33b5 = aa299b706ff2739e9e010f1140c435af3fdd0218 + d86a3810d2901dc1082b65dc9061896c46e1911d`
- Result: **PASS**

Checks:

- Exact head — PASS
- Go format — PASS
- Full Mail Go test suite — PASS
- Full Mail race suite — PASS
- Mail vet — PASS
- Cumulative static audit verifier — PASS

## Cross-step integration conclusions

The retained suite verifies that the accumulated wallet-native identity work remains compatible with the pre-existing mailbox foundation and with each other:

1. onboarding still preserves Wallet/Identity authority;
2. passkey/device/recovery/session surfaces remain authenticated and fail closed;
3. wallet action preparation remains non-custodial and cannot bypass Wallet simulation/review/signing/submission;
4. verification handoffs require canonical evidence rather than transport acknowledgement;
5. connector architecture preserves owner/provider/capability isolation;
6. webhook transport remains separate from user-session authentication while still requiring adapter verification;
7. strict input decoding continues to reject unsupported secret-bearing fields;
8. existing mailbox, drafts, outbox, trust, spam and conversation behavior remains green under the accumulated code.

## No duplicate ceremonial run

No second identical 420Mail workflow execution was deliberately created solely to label the same coverage "Level 2".

The one exact-head run already executes the entire retained Mail package and cumulative verifier, so re-running the identical suite on the identical SHA would provide no distinct coverage and would violate the phase-based qualification goal of avoiding redundant work.

## Level 3

**NOT RUN / NOT DUE.**

Level 3 remains reserved for the complete app-phase closeout and must later reconcile the accumulated phase against then-current `main` before the expensive repository-wide qualification described by the audit policy.

## Live/testnet limitations

The milestone does not claim live production-equivalent:

- Google/Apple/passkey provider setup;
- hardware passkey/device security;
- SmartAccount recovery/session propagation;
- Wallet transaction/signature execution;
- RPC finality verification;
- external provider connector credentials/webhooks.

Those remain later live/testnet/security/operations gates.

## Evidence inheritance

This milestone file and the roadmap bookkeeping commit are evidence-only and inherit the exact qualified implementation SHA without recursive qualification.

## Next canonical step

**MAIL-2.15 — Discord Account Linking**
