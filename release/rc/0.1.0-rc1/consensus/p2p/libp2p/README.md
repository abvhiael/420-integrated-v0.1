
# Production libp2p transport

Pinned production networking baseline for Step 4.5:

- `github.com/libp2p/go-libp2p` v0.49.0
- `github.com/libp2p/go-libp2p-pubsub` v0.17.0

The adapter is behind the `libp2p` build tag because the current build runtime cannot download
external Go modules.

On a networked development host:

```sh
go get github.com/libp2p/go-libp2p@v0.49.0
go get github.com/libp2p/go-libp2p-pubsub@v0.17.0
go mod tidy
go test -tags libp2p ./...
```

Production uses GossipSub and libp2p host identity/discovery. The TCP broker transport elsewhere in
the repo is strictly a deterministic local-devnet test harness.
