# EXP-1.4 — deploy and qualify 420Indexer runtime

EXP-1.4 closes the repository/runtime deployment gap. The production command is now a persistent service: it validates and catches up before exposing HTTP, serves the existing /v1 API, periodically catches up canonical state, persists its rebuildable store, and shuts down gracefully on SIGTERM.

The deployment package consists of `docker/Dockerfile.420indexer`, `deployments/indexer/docker-compose.yml`, and an environment template. The container persists `/var/lib/420indexer`, exposes port 8420, restarts unless stopped, and probes `/v1/health`.

This milestone does **not** fabricate a live testnet deployment. The authoritative infrastructure inventory still marks the Indexer host and RPC nodes UNPROVISIONED, while public RPC URLs remain placeholders. Therefore the deployable runtime can be fully qualified in repository/CI scope, but live deployment remains false until those external prerequisites exist.

Completion requires the EXP-1.4 verifier plus retained Indexer, Docs, and Integrated qualification on one exact head.
