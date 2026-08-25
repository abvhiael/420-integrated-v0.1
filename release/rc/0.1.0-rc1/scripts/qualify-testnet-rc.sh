#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

# 1. Production crypto + transport
./scripts/install-production-deps.sh
python3 scripts/write-evidence.py \
  --gate production_blst --status PASS \
  --command "./scripts/install-production-deps.sh" \
  --summary "blst production-tag tests passed"
python3 scripts/write-evidence.py \
  --gate production_libp2p --status PASS \
  --command "./scripts/install-production-deps.sh" \
  --summary "libp2p production-tag tests passed"

# 2. Exact pinned execution client + live Engine payload
./scripts/build-node420-upstream.sh
make build
./scripts/live-engine-smoke.sh
python3 scripts/write-evidence.py \
  --gate live_engine_payload --status PASS \
  --command "./scripts/live-engine-smoke.sh" \
  --summary "Engine V3 capability/build/get/newPayload/forkchoice smoke passed"

# 3. Real execution datadirs and 15-pair network
./scripts/prepare-real-devnet15.sh
python3 scripts/run-real-devnet15.py --seconds 90 --consensus-transport devnet-tcp
python3 scripts/write-evidence.py \
  --gate real_devnet15 --status PASS \
  --command "python3 scripts/run-real-devnet15.py --seconds 90 --consensus-transport devnet-tcp" \
  --summary "15 node420 + 15 fourtwentyd processes remained healthy" \
  --artifact qualification/real-devnet15.json

# 4. Logic/process fault matrix + restart.
python3 scripts/run-fault-matrix.py
python3 scripts/write-evidence.py \
  --gate production_fault_matrix --status PASS \
  --command "python3 scripts/run-fault-matrix.py" \
  --summary "quorum/fallback/partition matrix passed" \
  --artifact qualification/fault-matrix.json
python3 scripts/write-evidence.py \
  --gate production_restart_recovery --status PASS \
  --command "python3 scripts/run-fault-matrix.py" \
  --summary "restart recovery case passed" \
  --artifact qualification/fault-matrix.json

# 5. Extended qualification soak.
python3 scripts/run-soak.py --slots 420 --slot-ms 35
python3 scripts/write-evidence.py \
  --gate production_soak --status PASS \
  --command "python3 scripts/run-soak.py --slots 420 --slot-ms 35" \
  --summary "accelerated 420-slot soak passed" \
  --artifact qualification/soak.json

# 6. Build RC and verify checksum.
python3 scripts/build-testnet-rc.py
RC="release/rc/420-integrated-0.1.0-rc1.zip"
EXPECTED="$(cut -d' ' -f1 "$RC.sha256")"
ACTUAL="$(sha256sum "$RC" | cut -d' ' -f1)"
[ "$EXPECTED" = "$ACTUAL" ]
python3 scripts/write-evidence.py \
  --gate release_checksum_verification --status PASS \
  --command "sha256sum verification" \
  --summary "RC archive checksum matches recorded digest" \
  --artifact "$RC"

python3 scripts/check-release-evidence.py
python3 scripts/readiness.py

echo "TESTNET_RC_QUALIFICATION=PASS"
