# HC-SEP-A1 — byte-level verification (run against frozen refs)

The SHA-256 audit must hash actual object bytes and must not label Git blob SHA-1 or a previously recorded registry value as a recalculated checksum.

Run from a complete checkout of the integrated repository at the preservation branch:

```bash
git fetch origin '+refs/heads/hc-separation/archive/*:refs/heads/hc-separation/archive/*'
python3 scripts/highcountry/hc_sep_a1_verify.py \
  --frozen-main 78a4befa01bd08693aabfd576a6fe8fba2e2677b \
  --pr-heads docs/highcountry/separation/PHASE-A-OPEN-PR-HEADS.json \
  --output hc-sep-a1-asset-audit.json
```

The script enumerates media/map source under HighCountry-owned asset prefixes across frozen main and 63 exact archived heads, hashes raw Git object bytes, compares SHA-256 to frozen registry values, identifies asset versions and unique PR-only paths, duplicates, missing registry files and version conflicts. It fails on hash mismatches or registered missing paths. Unregistered source versions are reported separately rather than deemed invalid because a new PR may legitimately introduce them.

**Important acceptance limitation:** this script has been syntax-checked locally, but cannot be run against the GitHub repository within this container (GitHub DNS unavailable). The GitHub connector rejects binary blobs. No report is labeled successfully verified until a full byte-level checkout runs it and its output is inspected. No test suites need restarting for this standalone read-only audit.
