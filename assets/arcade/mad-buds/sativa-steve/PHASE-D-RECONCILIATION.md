# Sativa Steve — Phase D scoped repository reconciliation

Status: OWNER APPROVED; LOCAL STRUCTURAL PASS (9/9); GITHUB BLOB MATCH (9/9); GitHub Actions CI NOT EXECUTED.

Source upload on `main`: `4f78272fe9d9cfbe1c199d5a81ad9b0b9f71c5ca`.
Canonical directory: `assets/arcade/mad-buds/sativa-steve/`.
No changes to approved PNG artwork in this reconciliation.

## Evidence and method

- Owner approved each SS-D01 through SS-D09 illustration in conversation.
- Recalculated SHA-256 from the nine approved original PNG bytes and compared with each manifest `sha256`: 9/9 PASS.
- Opened each original via Pillow, verified PNG format, RGBA mode, exact declared dimensions, and alpha extrema (0,255): 9/9 PASS.
- Calculated Git blob SHA-1 (`sha1('blob '+byte_length+'\0'+bytes)`) locally for each approved PNG and fetched repository blob IDs for the corresponding paths on `main`: 9/9 identical.
- JSON manifest had stale text describing directory as absent and upload as pending; these fields are corrected in the accompanying metadata-only reconciliation.
- GitHub Actions CI was not run; no claim of CI-qualified or animation-qualified assets.

## Exact matched Git blob SHAs

| Asset | Git blob SHA |
|---|---|
| SS-D01 | `5305551c2e2ac1b8be3e657d318027c3512be612` |
| SS-D02 | `e7f724d4b5cc4d751c6ea4b8d3b10d70b37cda33` |
| SS-D03 | `8bef91dda8c14c49cc9eb45fb3a9ecc64f724827` |
| SS-D04 | `cb53261b730ab550be9e2a001645862097bcce50` |
| SS-D05 | `eb35a7bdfb134a3792c594bf680c5a65bcfabab0` |
| SS-D06 | `ee37ec9e0290d448ee44800fdcc3d60eee964d8c` |
| SS-D07 | `55294143d9ceae2591a7627903c6134769b417a2` |
| SS-D08 | `437412d8148ea5e860ae1a5900f7e4ac4ee0f26d` |
| SS-D09 | `c9b2a5b002c8e35281a64e282f380b71cf3f48b2` |

## Level 1 classification

Focused structural asset evidence only. Not a substitute for runtime integration, motion review, CI qualification, or broader Phase E/F qualification.
