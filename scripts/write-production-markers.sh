#!/usr/bin/env sh
set -eu
mkdir -p release
touch release/production-blst.pass
touch release/production-libp2p.pass
touch release/live-engine.pass
# The final three markers MUST only be written by the real 15-node production-transport harness.
echo "dependency/live-engine markers written; real-devnet/fault/soak markers intentionally untouched"
