---
title: APPSTORE-5 Security and Provenance
audience: [developer, auditor, user]
category: application
status: development
version: current
---
# APPSTORE-5 — security, provenance and warning presentation

APPSTORE-5 adds a non-authoritative security evidence layer to 420AppStore. It presents evidence from canonical or externally attributable sources without converting that evidence into a catalogue-issued safety claim.

## Evidence model

Each evidence record preserves its source, reference, observed time, status and severity. Supported evidence classes include 420Verify results, published audits, public publisher identity records, Registry deprecation state, malicious-behavior warnings and public trust signals.

The AppStore may sort and present these records, but it does not own them and must not silently rewrite their meaning. Warnings remain traceable to the source that produced them.

## Verification boundary

A `FULL_MATCH` result from 420Verify means published source/build inputs reproduce the deployed code under the Verify protocol's rules. It does not mean that the code is safe, bug-free, audited, endorsed or appropriate for a user.

APPSTORE-5 therefore rejects security evidence text that attempts to turn verification or audit evidence into claims such as `safe`, `endorsed`, `approved investment` or `guaranteed secure`.

## Warning behavior

Deprecation and malicious-behavior evidence is surfaced as warning material. Critical warnings sort into the same presentation model while preserving their original provenance and reference.

The catalogue may decide how prominently to render a warning, but it cannot alter the underlying Registry registration, disable direct contract access, revoke wallet permissions, or claim canonical authority over the application.

## Qualification properties

APPSTORE-5 tests require:

- evidence source, reference, status and observation time;
- recognized evidence kinds and severity values;
- deterministic evidence ordering;
- preservation of deprecation and malicious-warning records;
- rejection of malformed evidence;
- rejection of safety or endorsement claims derived from verification/audit evidence;
- an explicit disclaimer that verification, audits, publisher records and trust signals are evidence rather than guarantees.
