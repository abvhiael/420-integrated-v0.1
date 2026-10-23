# MB-3.1 — source/runtime boundary and qualification ledger

Canonical roadmap: `abvhiael/420-integrated/mad-buds/Docs/ROADMAP.md`, MB-3.1, **Kush Krusher runtime definition and character contract**.

Canonical source revision inspected: `11aad7b9be008c57d70f7f6b1fd1094c48fff03b`.
Target main reconciliation base: `6da29d73153e0771caeecc2b739f763ca414651d`.

## Work present in this PR
- Immutable, source-derived identity, demolition role, relative physics intent, Wrecking Ball activation contract, separate presentation profiles, material affinities and canonical lifecycle terms.
- Fail-closed contract validator and local single-use-per-launch runtime state.
- Focused positive, negative and lifecycle regression tests in the existing Kush Krusher Level 1 workflow.

## Hard acceptance boundary — NOT MB-3.1 complete
This repository contains the standalone 420Arcade adapter and uploaded art, **not** the canonical Unity 6 gameplay source `mad-buds/Game/Assets/MadBuds/`. The new module is a portable representation, not a substitute for the canonical Unity `IMadBud` and `MadBudController` runtime. It does not instantiate Unity Rigidbody2D, launch from GrowCannonRuntime, bind collision or ability components, or prove Unity EditMode/PlayMode tests.

Canonical MB-3.1 closure requires implementation and focused Unity tests in the original Mad Buds gameplay project, then deliberate synchronization/integration into this repository without falsely renaming the separate Phaser/Arcade animation adapter as a Unity runtime. Do not mark MB-3.1 PASS on the basis of these Node tests.

No changes to frozen Arcade Genesis catalog, blockchain, network, scoring, or physics. Level 2/3 not triggered. No global qualification.
