# ARC-1.11 — Durable exact-SHA Level 1 qualification certificate

**Canonical step:** ARC-1.11 — Implement asset loading, caching, error boundaries and recovery  
**Disposition:** PASS for shared asset loader, bounded in-memory cache and recoverable React game-subtree error boundary. This is not certification of playable game assets, offline service-worker deployment, or real device acceptance.  
**Qualification:** Level 1

- **Qualified implementation SHA:** `8e35dc997bb884f9f7c59ee62ab8311e28c1eb77`
- **Reconciliation base SHA:** `9939324c5bedfb8438d71667b3062e2eac635358`
- **PR:** [#761](https://github.com/abvhiael/420-integrated-v0.1/pull/761)
- **Branch:** `audit/arcade-1-11-assets-recovery`
- **Owning workflow:** `.github/workflows/arcade-1-11-level1.yml`
- **Successful run:** [39276992378](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39276992378)
- **Successful job:** `118143831196`; completed/success on the first formal Level 1 attempt.

## Qualified requirements and evidence

- Per-game versioned static asset manifest with strict canonical game scope, asset IDs, SHA-256 integrity, MIME, byte lengths, approval/license metadata and accessible labels.
- Same-origin static requests only, credentials omitted, redirect and opaque-response rejection; no executable MIME, path traversal, unauthorized/cross-game asset namespace or third-party code cache.
- Assets are integrity-verified before caching or consumption; malformed/corrupted/incorrect-sized responses fail closed.
- Isolated in-memory LRU cache with hard 100 MiB upper budget, defensive copies, explicit clear and terminal disposal; never caches raw player saves, drawings or other private data.
- Pending fetch cancellation, stale async response rejection and scoped errors.
- Accessible reusable React subtree error boundary with retry and return-to-catalog navigation. No unimplemented game launcher enabled.
- CI: asset syntax/security/adversarial tests, all retained Arcade controls, Phaser, React, input, audio, saves and score regressions, launcher lint/check/typecheck/tests and Vite production build PASS.

## Scope boundaries and reconciliation

The frozen platform requirements require secure opt-in service-worker installation, offline policies and per-game cache eviction when full games and approved assets are available. ARC-1.11 delivers the shared verified loading and volatile per-game LRU mechanism but **does not install a service worker, claim durable offline availability, or ship game content**. Those remaining game/deployment acceptance requirements must not be represented as verified.

At evidence preparation, `main` equaled the reconciliation base, the PR was zero commits behind and GitHub reported mergeable. Recheck eligibility at merge time.

**Evidence SHA:** Separate documentation-only certificate commit. It does not alter the already tested implementation.  
**Level 2:** Not triggered for this ordinary step.  
**Level 3:** Not triggered; no global qualification manually dispatched.  
**External/testnet:** Live Gaming Protocol authorization, network deployment and production/browser-device acceptance remain separate gates; ARC-1.11 does not require live testnet.  
**Next:** Follow actual authorized Arcade roadmap rather than assuming an unverified next number.
