# PB-1.4 — Repository Layer

PB-1.4 implements the repository boundary authorized by PB-0.17 and PB-0.19. Domain-owned interfaces define private canonical persistence operations; storage adapters implement those interfaces without acquiring lifecycle, relationship, consent, safety, visibility, or deletion-policy authority.

The initial adapter is intentionally in-memory and non-production. It proves the contract without choosing a database engine or claiming migration/deployment readiness.

Repository writes are restricted to PB-1.3 canonical tables and fields. Unknown/derived/shadow tables and forbidden fields fail closed. Optimistic version checks reject stale writes and deletes. The adapter provides no public membership enumeration or relationship-graph interface.

Migrations, retention/deletion orchestration, authorization primitives, API/worker surfaces, production storage, deployment, and live integrations remain outside PB-1.4.
