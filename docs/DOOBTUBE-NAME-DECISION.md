# DoobTube — application naming decision

Status: **ADOPTED — DOOBTUBE-0**
Date: 2026-10-06
Repository: `abvhiael/420-integrated-v0.1`

## Decision

The application referred to in the current audit request as **420Video** is named **DoobTube**.

This naming decision does **not** by itself:

- rename or replace `420Media`;
- change the canonical Genesis consumer-service record `420/service/media/v1`;
- create a Genesis application-catalog entry;
- allocate a frozen/reserved address;
- define DoobTube contracts, APIs, services, permissions, deployment topology, or release scope;
- claim that DoobTube is implemented, testable, deployed, testnet-ready, Genesis-ready, or production-ready.

## Repository-grounded boundary

At the branch base (`main` @ `43a3690422e934dcd1fe9da595df4a9dfed37a75`), no repository identifier, directory, contract namespace, service record, roadmap, PR, qualification record, or deployment record for `420Video` or `DoobTube` exists.

The repository does contain the separate, already-canonical **420Media** service and application implementation. DoobTube must not silently appropriate, rename, or redefine that architecture. That architecture decision is now adopted in `docs/DOOBTUBE-ARCHITECTURE.md`: DoobTube is a replaceable user-facing application/client that consumes canonical 420Media rather than replacing or duplicating it.

## Next gate

DOOBTUBE-0 is complete. The next canonical roadmap step is **DOOBTUBE-1 — Product scope and canonical user workflows**.
