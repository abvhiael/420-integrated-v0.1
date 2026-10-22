# Sativa Steve — Phase E animation production preparation

Status: **PROPOSED FOR OWNER APPROVAL — NOT PHASE E QUALIFIED**
Scope: artwork-to-animation planning only; no animation frames or gameplay runtime.
Baseline: Phase D artwork reconciled into main at merge `a8d40eff26f464d4f32251a852edbffcf41a6d5d`.
Source: `abvhiael/420-integrated/mad-buds/Docs/CHARACTER_BIBLE.md`, section 9, and approved Phase A–D artwork.

## 1. Locked visual inputs

- `sativa_steve_ss_d01_full_body_hero.png` — hero expression/proportions.
- `sativa_steve_ss_d02_neutral_front.png` — front neutral root.
- `sativa_steve_ss_d03_neutral_side.png` — side silhouette.
- `sativa_steve_ss_d04_neutral_back.png` — rear silhouette.
- `sativa_steve_ss_d05_character_portrait.png` and `sativa_steve_ss_d06_character_icon.png` — facial close-ups.
- `sativa_steve_ss_d07_overdrive_hero.png` — airborne velocity/elongation reference.
- `sativa_steve_ss_d08_victory_hero.png` — victory body language.
- `sativa_steve_ss_d09_bong_cannon_companion.png` — prop relationship only, **not** a completed cannon loading animation.
- Source art hashes, dimensions, owner approval and evidence: `sativa_steve_phase_d_manifest.json` and `PHASE-D-RECONCILIATION.md`.
- Approved 24-expression board, gameplay-action poses and Phase C sheet are also owner-locked design references. Do not imply their standalone files are present in this folder without verifying.

## 2. Core identity constraints

Compact narrow spiky green cannabis-bud form, orange pistils, black sunglasses, toothy grin, exactly two arms and two legs, red/white high-tops. Speed / traversal / precision chaos, not Kush Krusher's mass-and-squash identity. Sunglasses remain properly attached; absent eye visibility requires deliberate expression-specific owner-approved treatment. No third feet, extra limbs, replacement clothing or props.

## 3. Rigging and compositing hierarchy (proposal)

```text
root_motion (world-independent, local normalized anchor)
  body_core (botanical torso plus spike groups)
    crown_leaf_clusters (controlled deformation; front/back depth)
    face
      sunglasses_frame + left_lens + right_lens + highlights
      mouth + teeth + tongue (expression swaps)
    left_shoulder -> left_arm -> left_hand
    right_shoulder -> right_arm -> right_hand
    left_hip -> left_leg -> left_sneaker
    right_hip -> right_leg -> right_sneaker
  vfx (separate transparent layers: speed streaks, lime trail, flash)
```

Source Phase D files are flattened RGBA illustrations, **not existing separable PSD rig layers**. Reconstruct layers only with approved source isolation/redraw and owner review, preserving original appearance; do not claim lossless auto-separation. Maintain back/front occlusion and sleeve-less botanical transitions. Pivots must be measured on final extracted layers: shoulder, elbow/hand, hip, knee/ankle, body center. Never assign fabricated exact pixel pivot values before layer geometry is verified.

## 4. Export and manifest standard (provisional)

- Dedicated `1024 x 1024` RGBA canvases per frame, all frames of one animation identical dimensions; preserve pose bounds with adequate padding.
- Nominal `10 fps` and `10 frames` / 100ms each for baseline sets, inherited from Kush's qualified packaging **as a proposed technical default**, not automatically mandated for each of Steve's 11 actions.
- Variable frame count / FPS requires explicit documented approval for that animation and is verified against its manifest.
- `schema=mad-buds-animation-manifest-v1`, `schemaVersion=1.0`, `characterId=sativa_steve`, `animationId`, `animationName`, `frameCount`, `frameWidth`, `frameHeight`, `fps`, `durationMs`, `loop`, `direction`, `pivotNormalized`, `sourceArt`, `sourceSHA256`, `frames[]` entries with ordered filenames, duration and real SHA-256.
- Proposed identifiers: `ss_anim_01_jittery_idle` etc., folders `animations/ss_anim_XX_name/`, filenames `sativa_steve_anim_XX_name_frame_YY.png`, manifest `sativa_steve_anim_XX_name.json`, preview GIF, ZIP archive. **Not locked until Phase F matrix approval.**
- Preserve source checksum provenance; original Phase D dimensions vary and must not be mistaken for finalized animation canvas sizes.
- Each ZIP contains exactly intended PNGs, manifest and preview; check archive integrity, paths and manifest/checksum correspondence.

## 5. Movement limits (creative proposal, requires owner approval)

- Jitter idle: small alternating squash/tilt, **foot-ground anchoring preserved**.
- Sunglasses adjustment: one arm reaches frame while lenses and head stay anatomically connected.
- Foot shuffle: fast alternating shoes with leg count exactly two; silhouette never teleports.
- Cannon loading: approved glass Bong Cannon geometry, no artillery substitution; pose and depth order deferred to Phase F.
- Airborne: directional lean, compact limbs; no false floor shadow in a transparent flight frame.
- Overdrive: flash -> extreme forward acceleration -> temporarily elongated silhouette -> return to stable shape; preserve face, glasses, shoes and both arm/leg pairs. Actual physics effects occur only in runtime and are NOT implemented here.
- Wall splat: temporary impact compression then recognizable recovery, no lost facial identity.
- Spinning recovery: ordered angular progression and leg orientation with readable frame sequence.
- Victory pacing: rhythmic fast steps and expressive hand gestures.
- Dizzy failure: rotational imbalance and controlled stagger, not permanently distorted anatomy.
- All squash/stretch magnitudes and angles remain **TBD via animated pose tests**, not falsely presented as measured constants.

## 6. Character Bible mandatory animation concepts (not yet numbered/locked matrix)

1. jittery idle
2. sunglasses adjustment
3. rapid foot shuffle
4. cannon loading
5. flight
6. Overdrive activation
7. extreme-speed stretch
8. wall splat
9. spinning recovery
10. victory pacing
11. dizzy failure

Do not inherit Kush's 15-name matrix or count without separate decision. Decide whether supplemental emotes and loading/launch sub-states merit distinct sets at the Phase F matrix gate.

## 7. Qualification gates

**Phase E closeout (Level 1):** verify referenced source files and hashes, specification completeness, naming consistency and owner approval of parameters; evidence records must identify tested commit and scope. No global Foundry, Integrated, Genesis or unrelated CI.

**Phase F individual animation Level 1:** real chronological poses, correct per-frame names/order/count/dimensions/RGBA, genuine transparency, no identity/anatomy drift, loop/hold continuity, exact per-frame SHA-256, manifest valid and coherent, preview playback, complete ZIP and ZIP CRC, path verification. Structural PASS cannot stand in for owner visual-motion approval.

**Level 2:** milestone collection checks after grouped sets.
**Level 3:** one end-of-phase closeout, not repeated every set.

## 8. Explicit exclusions

No game scenes, actual launcher/physics/collision transitions, wallet/gameplay integrations, protocol workflows, sound files or produced animation frames. No mass frame generation from unrelated drawings. No rewriting qualified Kush Krusher artwork. Phase E remains pending owner approval until technical standards and layer-prep approach are accepted.
