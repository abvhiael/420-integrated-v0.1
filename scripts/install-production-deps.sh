#!/usr/bin/env sh
set -eu

BLST_VERSION="v0.3.16"
LIBP2P_VERSION="v0.49.0"
PUBSUB_VERSION="v0.17.0"

echo "Installing production consensus dependencies..."
go get "github.com/supranational/blst@${BLST_VERSION}"
go get "github.com/libp2p/go-libp2p@${LIBP2P_VERSION}"
go get "github.com/libp2p/go-libp2p-pubsub@${PUBSUB_VERSION}"
go mod tidy

echo "Compiling production BLS adapter..."
go test -tags blst ./consensus/crypto/bls/... ./consensus/finality/...

echo "Compiling production libp2p adapter..."
go test -tags libp2p ./consensus/p2p/...

echo "Compiling both production tags together..."
go test -tags "blst libp2p" ./...

echo "PRODUCTION_DEPS=PASS"
