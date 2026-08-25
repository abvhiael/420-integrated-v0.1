
# BLS backend

The production backend is Supranational `blst` in minimal-pubkey mode.

The repository's default/offline build does not silently replace BLS with another algorithm. The
`blst` implementation files are guarded by the `blst` build tag.

In a networked development/build environment:

```sh
go get github.com/supranational/blst@v0.3.16
go mod tidy
go test -tags blst ./...
go build -tags blst ./consensus/cmd/fourtwentyd
```

Before release, pin the resolved module checksum in `go.sum` and CI.

The deterministic verifier used by `consensus/finality` tests is a test double only. It is never a
production consensus signature implementation.
