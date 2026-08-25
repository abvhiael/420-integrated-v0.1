# Step 3 Decision 2 — Slot and Fallback Timing

Status: **FROZEN FOR TESTNET**

## Fixed slot duration

420 Integrated uses fixed **12-second consensus slots**.

A slot exists independently of whether an execution block is produced.

`slot != block`

If no authorized proposer produces an accepted block during a slot, the slot is missed and consensus advances to the next slot.

A missed slot:

- does not create an empty execution block;
- does not increment execution block height;
- remains observable through slot numbering and consensus telemetry.

## Authorized proposers

Each slot has exactly three ordered proposer opportunities:

1. primary proposer;
2. fallback proposer #1;
3. fallback proposer #2.

The proposer identities and fallback ordering are deterministic and derived from finalized consensus randomness.

There is no open proposer race.

## Twelve-second timing structure

| Slot time | Function |
|---|---|
| 0–3 seconds | Primary proposal window |
| 3–4 seconds | Propagation interval |
| 4–7 seconds | Fallback #1 proposal window |
| 7–8 seconds | Propagation interval |
| 8–11 seconds | Fallback #2 proposal window |
| 11–12 seconds | Final propagation interval |

The initial receive-clock tolerance is **±500 ms** for testnet networking behavior. This tolerance is a networking acceptance aid and does not grant a proposer authority outside its assigned proposer rank/window.

## Proposal authority

A proposer is valid only when:

- it is one of the three scheduled proposers for the slot;
- its proposer rank is authorized for the relevant proposal window;
- the block satisfies all other consensus and execution validity rules.

A late primary proposal does not retain priority after the primary window has expired.

Likewise, fallback #1 and fallback #2 may propose only after their respective authorization boundaries.

## Successful fallback reward

If the primary proposer fails and a fallback successfully proposes the accepted block:

- the failed primary receives no proposer reward;
- the successful fallback receives the **full proposer reward**;
- the successful fallback may still participate normally in validator accounting according to the final reward implementation rules.

The proposer reward follows actual successful proposal work, not the originally scheduled primary identity.

## Missed proposer behavior

An isolated missed proposal is treated initially as an availability failure, not a slashable consensus offense.

The missing proposer:

- receives no proposer reward;
- receives an availability/missed-duty record;
- may become subject to inactivity penalties under the later slashing/inactivity specification.

Provable equivocation or conflicting proposals is handled separately under the slashing rules.

## Block timestamps

Block timestamps are deterministic from slot position:

`timestamp = genesis_time + (slot_number × 12 seconds)`

The proposer does not freely choose the execution timestamp.

This prevents timestamp manipulation and keeps protocol time consistent even when a fallback proposer broadcasts late in the slot.

## Example

If:

- block 999 was produced in slot 1500;
- slot 1501 is missed;
- the next accepted block is produced in slot 1502;

then:

- the new execution block number is 1000;
- its slot number is 1502.

The missed slot is visible at the consensus layer but does not create a phantom execution block.

## Rationale

The chosen model provides:

- predictable 12-second consensus timing;
- two levels of proposer redundancy;
- deterministic proposer authority;
- no all-validator proposal race;
- clean handling of offline validators;
- explicit propagation time before fallback activation;
- deterministic block timestamps;
- no unnecessary empty blocks;
- compatibility with a later attestation/finality fork-choice system.

The 500 ms clock tolerance is specifically a **testnet parameter** and may be adjusted after wide-area latency testing without altering the fundamental 12-second slot structure.
