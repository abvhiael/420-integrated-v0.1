# MBL-6 — working requirements and qualification ledger

Status: IMPLEMENTATION IN PROGRESS. NOT QUALIFIED. No production, distribution or physical-device acceptance.

| Requirement | Current evidence | Required before completion |
| --- | --- | --- |
| Native permissions | Preview manifest requests no Android permissions; iOS ATS denies arbitrary transport | Generated Android manifest / Info.plist permission audit on exact SHA; explicit denial matrix |
| Encrypted credentials | Existing SecureStore with WHEN_UNLOCKED_THIS_DEVICE_ONLY | Corruption/key loss/reinstall/migration and durable erasure tests on both native targets |
| Logout and private erasure | Separate session and identity keys; new explicit two-key erasure function | Integrate erase into authorized logout and crash/recovery, verify failure semantics, backend retention remains independent |
| Background | App and driver preview suspend upon background | Simulator lifecycle/revocation/return-to-foreground tests |
| External links | Only preview OAuth scheme; strict callback parser added | Integrate with native auth callback and reject all unauthorized incoming links; associated-domain links require verified domain ownership |
| Accessibility | Basic labels, live regions and ≥48 dp controls | Actual TalkBack/VoiceOver, contrast, dynamic-type, reduced-motion and focus/error audits |
| Crash recovery | Fresh session authorization and server-owned transitions; pure recovery guard | Interrupted ride, offer, payment, quote and consent simulator integration; server receipt tied to exact command |
| Supply chain | Expo ~54 and unpinned resolution; no mobile lockfile | Generate and commit reviewed lockfile; npm ci, dependency audit and provenance checks |
| Android/iOS builds | Debug Android and no-signing iOS simulator build previously passed at MBL-5 | Exact-SHA artifacts, generated native config audit, reproducible dependency restore |
| M-MBL-A Level 2 | Not yet implemented | Real emulator AND simulator MBL-1..6 integration journeys at SAME exact SHA |

Prohibitions: no public rides, payment custody, live dispatch, production endpoints, fake acceptance, reuse of previous qualification as MBL-6 PASS, or global unrelated suites.

External gates remain TN-MBL-1 through TN-MBL-4 and LT-02/03/04/05/08. Level 3 only after implementation and Level 2 reconcile.
