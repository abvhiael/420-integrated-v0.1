# S-03 — Source-of-truth and trusted evidence verification

**Status: PARTIAL — Level 1 offline evidence verification; live source trust not established.**

The dedicated verifier validates versioned Ed25519 signed work-unit records against separately approved public keys. Records bind exact source/project/contributor/assignment/work unit/result/acceptance evidence, credit units, time windows and monotonic correction/revocation revisions. Replayed and conflicting corrections fail closed. No source may self-approve by presenting a public statistics snapshot. Signed source evidence remains distinct from CMP-5.7 governed attestations and CMP-6 useful reward accounting. Output always declares canonicalAttestation:false, rewardEligible:false and authoritative:false.

**Still blocked:** neither BOINC nor Folding@home has provided/approved an actual work-unit source signing key or verified result/acceptance feed; S-02 real provider endpoint and DNS transport qualification remain open; an independently backed durable revocation/dispute log and live CMP-5.7 governance attester onboarding/revocation drills are absent. Deterministic test keys do not establish provider identity. Do not mark S-03 COMPLETE or enable rewards until these are proven.

Level 2 remains at S-06, Level 3 at accumulated phase closeout. No global inventory required for this ordinary app-scoped source-verification slice.
