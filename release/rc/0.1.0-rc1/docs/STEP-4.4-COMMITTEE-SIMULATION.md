
# Step 4.4 — Validator Committee, Scheduling, Attestations, and Simulation

Status: **IMPLEMENTED CORE**

## Validator/seat state

Step 4.4 adds:
- validator lifecycle status types;
- seat/occupant records;
- committee snapshots;
- the frozen seat-term invariant:
  `scheduledExitRotation = seatActivationRotation + 3`.

Committee construction rejects duplicate seats, duplicate occupants, and invalid seat terms.

## Deterministic proposer scheduling

Primary, fallback-1, and fallback-2 schedules are generated from:
- rotation seed;
- domain;
- rotation number;
- canonical seat list.

Implementation:
- Fisher-Yates;
- SHA-256 counter-mode stream;
- rejection sampling.

Per-slot collision resolution guarantees three distinct proposer seats when the committee contains at
least three seats.

## Attestation collection and QC assembly

A collector accepts one attestation per seat for one target block, rejects duplicates/wrong targets,
and exposes the protocol quorum threshold.

At N=15:
- 10 attestations -> no QC;
- 11 attestations -> QC eligible.

QC assembly produces:
- signer bitmap;
- aggregate signature through an injected signature aggregator;
- frozen QC metadata.

The production BLS backend remains the Step 4.3 `blst` adapter when built in a networked environment.

## Local slashing protection

The local protection DB refuses conflicting:
- block proposals for one slot;
- attestations for one slot;
- RecoveryCertificates for one incident.

Repeated requests for the exact same root are idempotent.

## 15-validator simulation

The in-process simulation builds:
- 15 seats;
- deterministic proposer schedule;
- primary/FB1/FB2 selection;
- 11 attestations;
- QC assembly and verification;
- chained finality.

Test cases cover:
- normal primary proposer;
- primary missing -> fallback 1;
- primary + fallback 1 missing -> fallback 2.

The simulation uses deterministic test cryptography through the production QC interfaces. It does not
pretend to be the production BLS backend.

## Next

Step 4.5 should move from in-process committee simulation to an actual multi-process local devnet:
- libp2p consensus transport;
- fourtwentyd validator duties;
- per-node state;
- real Engine API connection to node420;
- proposal/attestation gossip;
- QC gossip;
- 15 local validator processes;
- fault injection by stopping proposers/validators.
