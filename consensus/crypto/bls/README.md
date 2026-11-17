
# BLS backend

The production backend is Supranational `blst` in minimal-pubkey mode.

The repository's default/offline build does not silently replace BLS with another algorithm. The
`blst` implementation files are guarded by the `blst` build tag.

In a networked development/build environment:

```sh
go mod download github.com/supranational/blst
go test -tags blst ./consensus/crypto/bls
go build -tags blst ./consensus/cmd/fourtwentyd
```

`go.mod` pins `github.com/supranational/blst v0.3.16` and `go.sum` retains its checksum. The production `fourtwentyd` and isolated `stake-signer` images build with `-tags blst`; the default build fails closed at the signing boundary. See `consensus/signing/README.md` for the authenticated signer and qualification.

The deterministic verifier used by `consensus/finality` tests is a test double only. It is never a
production consensus signature implementation.
