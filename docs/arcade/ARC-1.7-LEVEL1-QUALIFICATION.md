# ARC-1.7 — Exact-SHA Level 1 qualification certificate

**Step:** ARC-1.7 — Implement audio playback, volume, mute and accessibility controls  
**Disposition:** PASS — scoped audio and accessibility controls, not a live game runtime or complete physical-device WCAG certification.  
**Qualification level:** Level 1.

- **Qualified implementation SHA:** `8efadc3bf24fcc4857e3facc81b01e3342ad2220`
- **Reconciliation base SHA:** `98636d747965154c1670f9fd4d611747d009cac4`
- **Branch:** `audit/arcade-1-7-audio-accessibility`
- **PR:** [#753](https://github.com/abvhiael/420-integrated-v0.1/pull/753)
- **Workflow:** `.github/workflows/arcade-1-7-level1.yml`
- **Successful run:** [39206120050](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39206120050)
- **Successful job:** `117909222772`, completed/success on the first ARC-1.7 qualification attempt.

## Verified scope

1. Explicit gesture activation, initially muted player, validated bounded volume and mute/unmute.
2. Game-ID-scoped Web Audio cue allowlist, non-audio text alternatives even when silent, bounded simultaneous sound events.
3. Pause, resume, active-voice stopping on mute/zero volume, and idempotent disposal with audio context close.
4. Invalid game ID, unsupported audio context, resume failures, unauthorized cues and foreign scope rejected.
5. React Accessibility screen has labeled 0–100 slider, Enable sound, Mute/Unmute, Test cue, informative live status; synth audio without external media.
6. Audio unit tests and retained input, Phaser and React casual adapter tests completed successfully.
7. Browser launcher lint, TypeScript typecheck, all existing app tests and Vite production build completed successfully.
8. No new wallet, Registry, server-score, signing or network authority introduced.

## Reconciliation

During qualification, `main` advanced three commits, affecting only Budtender `idle_left` artwork/manifest assets. They do not change Arcade qualified inputs; no Arcade Level 1 rerun is warranted solely because of these independent assets.

The commit adding this certificate is evidence-only and **not** the tested implementation SHA. Verify actual GitHub eligibility before merge.

**Level 2:** not triggered. **Level 3:** not triggered. No unrelated expensive workflows were manually dispatched.  
**Later local work:** complete game scene/content audio integration and actual browser/device accessibility acceptance.  
**External/testnet:** live Gaming Protocol operator and Registry approvals remain distinct release gates.  
**Next milestone:** follow the verified canonical Arcade roadmap, without inventing an ARC number.
