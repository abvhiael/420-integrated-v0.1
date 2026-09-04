#!/usr/bin/env sh
set -eu

BLST_VERSION="v0.3.16"
LIBP2P_VERSION="v0.49.0"
PUBSUB_VERSION="v0.17.0"

retry() {
  attempt=1
  max_attempts=3
  delay=2

  while :; do
    if "$@"; then
      return 0
    fi

    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "ERROR: command failed after ${attempt} attempts: $*" >&2
      return 1
    fi

    echo "WARN: transient dependency command failure (attempt ${attempt}/${max_attempts}); retrying in ${delay}s: $*" >&2
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

echo "Installing production consensus dependencies..."
# Keep the pinned module versions and normal Go checksum verification intact.
# Retry only transient proxy/checksum-network failures; final failure remains fail-closed.
retry go get "github.com/supranational/blst@${BLST_VERSION}"
retry go get "github.com/libp2p/go-libp2p@${LIBP2P_VERSION}"
retry go get "github.com/libp2p/go-libp2p-pubsub@${PUBSUB_VERSION}"
retry go mod tidy

echo "Compiling production BLS adapter..."
go test -tags blst ./consensus/crypto/bls/... ./consensus/finality/...

echo "Compiling production libp2p adapter..."
go test -tags libp2p ./consensus/p2p/...

echo "Compiling both production tags together..."
go test -tags "blst libp2p" ./...

echo "PRODUCTION_DEPS=PASS"
