# ARC-0.4 — Level 1 exact-SHA qualification certificate

**Disposition: PASS — scoped Arcade identities, namespace inventory and adversarial checks.**

- **Qualified implementation SHA:** `518669199bbe8c75faf10f110f143438430617d9`
- **Owner workflow:** `.github/workflows/arcade-0-4-level1.yml`
- **GitHub run:** https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39190409255
- **Job ID:** `117861743196`
- **Job conclusion:** `completed / success`
- **Earlier exact-SHA PASS retained:** `e4e5b96cec8a43ea66519d5c35116d4ea904aa85`, run `39186325829`, job `117849418924`; superseded only for subsequently strengthened verifier scope.
- **Failed intermediate correction retained honestly:** SHA `0959a38592520f773b6bbebb51c9edd66e4adf57`, run `39190319832`, failed due to frozen-slug fixture variable shadowing, corrected in the final implementation SHA above.
- **Checks verified:** eleven immutable frozen ID/name/slug/runtime mappings, GP-17 namespace convention, protocol runtime reference namespaces (High Country, The Green Road, Budtender, Smoke & Chrome), uniqueness, version/schema, optional-wallet and non-registration status; reject duplicate/forged game IDs, substituted valid slug/runtime, claims of authority, forced wallet, illegal state/version.
- **Protocol ownership:** existing canonical GameRegistry420 authorization is unchanged; no new registration, contract, operator, signing authority, entitlements, or reward claims.
- **Reconciliation:** prior ARC-0.1/0.2/0.3 certificates unchanged. The seven commits on main after original ARC-0.4 base `d141f012332302bc469d81cb8cd456d95d064733` touch only BET-AUDIT-5A.2 poker workflow, contract, test and certificate, not qualified Arcade or protocol identity inputs. GitHub conflict/merge eligibility must be rechecked before merging.
- **Level 2:** not triggered; **Level 3:** not triggered.
- **External dependency:** live network registration, real-time collision proof, deployed operator authorization/finality and GP-17.9 network acceptance remain ARC-TN work and are not represented as local failures or live PASS.
- **Evidence-only commit:** this document changes only the certificate; its commit SHA must never substitute for the qualified implementation SHA.

**ARC-0.4 local implementation exit:** qualified. **ARC-TN live acceptance:** pending. **Merge:** only if repository policy and GitHub eligibility are satisfied.
