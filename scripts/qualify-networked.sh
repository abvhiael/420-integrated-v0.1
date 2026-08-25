#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

./scripts/install-production-deps.sh
./scripts/build-node420-upstream.sh
make build
./scripts/live-engine-smoke.sh

python3 scripts/run-fault-matrix.py
python3 scripts/run-soak.py --slots 120 --slot-ms 35

echo "NETWORKED_QUALIFICATION=PASS"
