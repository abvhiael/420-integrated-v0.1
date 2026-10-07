---
title: 420Media Known Limitations
audience:
  - user
  - developer
  - operator
category: reference
status: current
version: current
---

# 420Media known limitations

MEDIA-AUDIT-11 closes the repository audit phase. It does not make undeployed infrastructure real.

Remaining live/testnet limitations include:

- no production-equivalent public-testnet Media release lineage yet;
- no production Media domain/API origin claimed;
- no materialized production Registry publication;
- no live scanner/quarantine provider evidence;
- no live session issuer/revocation integration evidence;
- no live secret-manager/egress/firewall qualification;
- no live rate-limit/abuse/load/soak evidence;
- no live upload and playback provider evidence;
- no live stream credential rotation/recovery evidence;
- no live multi-RPC/reorg/restart/operator-compromise exercise;
- no live Notifications delivery proof;
- no production monitoring/backup/rollback evidence;
- no explicit frozen Genesis application-catalog promotion decision.

Repository moderation changes application visibility only.

The in-memory API idempotency/replay implementations establish contract semantics; horizontally scaled production requires durable shared stores preserving the same behavior.

The Media API package defines server/backend composition but a live executable/origin remains deployment work.

These items are not hidden blockers for MEDIA-AUDIT-11 repository completion; they are explicit MEDIA-AUDIT-12/13 gates.
