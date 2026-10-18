# LIFTd PT-07 — Exact-SHA Level 1 qualification

**Status:** Repository-side PT-07 preparatory pilot configuration **LEVEL 1 PASS**. Canonical L03.11 controlled pilot **NOT ACCEPTED** (real-world authorization and deployment are still required).

- **Step definition:** disabled-by-default pilot admission rules, exact geographic limits, driver/vehicle eligibility configuration, monitoring thresholds, pilot capacity ceilings and emergency-stop controls.
- **Qualified implementation SHA:** `21a5091872b6dc9c5b8bf7ab3655d91e46068142`.
- **Reconciliation base SHA:** `784f80791b2675d7e346dcfb331f916d80c9682d` (main at branch creation).
- **Branch:** `audit/liftd-pt07-pilot-configuration-20261018`; [PR #719](https://github.com/abvhiael/420-integrated-v0.1/pull/719).
- **Exact-SHA CI:** [PT-07 Level 1 run #39089821238](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39089821238), job `117563991531`, **SUCCESS**. GitHub log verifies checkout `21a5091872b6dc9c5b8bf7ab3655d91e46068142`.
- **Results:** retained LIFTd app + new PT-07 security and boundary tests **139 PASS / 0 FAIL**; source syntax checked; locked Node dependencies installed.
- **Files:** `rideshare/src/pilot-configuration.mjs` dry-run eligibility/limits, `rideshare/test/pilot-configuration.test.mjs` adversarial boundaries, `.github/workflows/liftd-pt07-level1.yml` scoped workflow, `docs/rideshare/PT-07-PILOT-CONFIGURATION.md` authority and deployment boundary.
- **Existing dependencies preserved:** `rideshare/src/eligibility.mjs` owns independent signed Registry and transport proofs; `rideshare/src/dispatch.mjs` owns live dispatch. This PT-07 preparatory module neither replaces those consumers nor activates pilot traffic.
- **Geography:** exact `VANCOUVER_SCOPE`, country CA, region BC, municipality Vancouver, service `liftd-passenger`; airports and cross-boundary routes denied. It is not a mapped polygon/geofence verification service; real geographic boundaries must be independently exercised in deployed TN.
- **Emergency controls:** default inactive traffic; requires emergency stop active. Local stop evaluation supports authorized stop command and fail-closed provider/monitoring signals. Persistent distributed stop propagation and independent authorization are not demonstrated by this module.
- **Monitoring and capacity:** bounded config for active trips, drivers, offer rate, latency, provider errors and incidents; tests deny exceeded limits. No production metrics collector or central coordination accepted.
- **Level 2:** not run. **Level 3:** not run. No global qualification inventories launched.
- **External acceptance:** L03.8–L03.11 safety, jurisdiction, Identity/Registry, insurance, qualified drivers/vehicles, deployed monitoring, distributed stop/recovery, operator staffing and official testnet remain **NOT ACCEPTED** under existing TN-0–TN-6 and L03.11 pilot work. No passenger operations authorized.
- **Merge disposition:** unmerged draft PR; re-evaluate current-main compatibility and branch protections before any authorized merge.
- **Next canonical step:** sequence remains unchanged; PT-07 is supplemental pilot configuration readiness, not a substitute for L03.11.
