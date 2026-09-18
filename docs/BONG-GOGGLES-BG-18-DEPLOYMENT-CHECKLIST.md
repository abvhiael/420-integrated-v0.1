# Bong Goggles BG-18 Deployment Checklist

## Testnet

- [ ] dependency addresses validated
- [ ] reward config parses successfully
- [ ] campaign plans preflight successfully
- [ ] scorer/policy profiles verified
- [ ] sponsor creates campaigns via Wallet
- [ ] RewardPool funded and balances reconciled
- [ ] campaigns activated only after funding readiness
- [ ] post → contribution → accrue → reserve → claim → release drill passes
- [ ] discovery and review reward drills pass
- [ ] replay / duplicate-source protections pass
- [ ] cap and budget exhaustion drills pass
- [ ] pause/deactivation preserves earned claims
- [ ] notifications distinguish submitted / earned / paid
- [ ] operator surface and Explorer links resolve
- [ ] accounting reconciliation passes
- [ ] game rewards remain deferred

## Staging

- [ ] repeat all testnet checks with staging addresses and campaign values
- [ ] verify no testnet address or campaign ID is reused
- [ ] verify Wallet-bound sponsor actions only
- [ ] verify no private keys, secrets, or Wallet session material are stored by Bong Goggles
- [ ] replay/restart reconstruction returns identical accounting
- [ ] run underfunded, expired, disabled, and misconfigured readiness-warning drills
- [ ] verify actual RewardReleased → RewardClaimed event order preserves PAID
- [ ] export sanitized accounting report and reconcile independently

## Production

- [ ] production dependency inventory reviewed by two operators
- [ ] production app/contribution IDs match frozen BG-18 values
- [ ] final campaign economics reviewed before creation
- [ ] production scorer/policy addresses verified
- [ ] pool funding amount and campaign budget agree
- [ ] campaign start/end window confirmed
- [ ] campaigns created, funded, reread, and only then activated
- [ ] operator surface shows zero readiness warnings
- [ ] canonical accounting baseline captured
- [ ] notification and Explorer deep links verified
- [ ] game rewards remain disabled
- [ ] exact-head Solidity, Bong Goggles, Docs, and Integrated CI all green
- [ ] branch reconciled with current `main`
- [ ] PR mergeable at exact qualified head

## Rollback rule

If any check fails, do not activate affected campaigns. If already active, deactivate them and preserve existing accrued/paid reward history. Do not rewrite or locally repair canonical reward state.
