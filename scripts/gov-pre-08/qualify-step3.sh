#!/usr/bin/env bash
# Source-bound V4 candidate materialization and strictly local two-node replay/restart.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
python3 -m py_compile scripts/gov-pre-08/*.py
python3 scripts/gov-pre-08/test_plan.py
python3 scripts/gov-pre-08/test_funding.py
python3 scripts/gov-pre-08/test_step3.py
python3 scripts/verify-genesis-supply-reconciliation.py

forge build --root contracts --extra-output storageLayout \
  src/governance/FoundingWalletClaims420.sol \
  src/governance/FoundingCommitteeMembership420.sol \
  src/governance/FoundingRetirementVerifier420.sol \
  src/treasury/FoundingTreasuryAuthority420.sol \
  src/treasury/FoundingValidatorSponsorship420.sol \
  src/treasury/FoundingCommunityRetirementSweep420.sol \
  src/revenue/FoundingDeveloperCompensationSplitter420.sol \
  src/revenue/DevelopmentCompensationVault420.sol \
  src/treasury/TreasuryAuthorization420.sol \
  src/treasury/TreasuryPolicyRegistry420.sol \
  src/treasury/TreasuryBudgetRegistry420.sol \
  src/treasury/TreasuryDisbursementRegistry420.sol \
  src/treasury/TreasuryRouter420.sol \
  src/treasury/TreasuryReleaseExecutor420.sol \
  src/system/ProtocolReserve.sol \
  src/system/CapabilityRegistry420.sol \
  src/vault/VaultAuthorization420.sol \
  src/vault/VaultPolicyRegistry420.sol \
  src/vault/VaultRegistry420.sol \
  src/vault/VaultAccounting420.sol \
  src/vault/AssetVault420.sol

for tag in a b; do
  python3 scripts/gov-pre-08/materialize-v4-source-and-audit-local.py \
    --build "$RUNNER_TEMP/govpre08-step3-v4-$tag"
done
diff -rq "$RUNNER_TEMP/govpre08-step3-v4-a" "$RUNNER_TEMP/govpre08-step3-v4-b"
python3 scripts/gov-pre-08/materialize-v4-source-and-audit-local.py \
  --verify-bundle "$RUNNER_TEMP/govpre08-step3-v4-a"
python3 scripts/gov-pre-08/materialize-local-funding.py \
  --output "$RUNNER_TEMP/govpre08-step3-genesis.json" \
  --provenance "$RUNNER_TEMP/govpre08-step3-genesis-source.json"

for tag in a b; do
  if [ "$tag" = a ]; then port=18761; else port=18762; fi
  export GOV_PRE_08_RPC="http://127.0.0.1:$port"
  export GOV_PRE_08_STEP2_EVIDENCE="$RUNNER_TEMP/govpre08-step3-funding-$tag.json"
  anvil --init "$RUNNER_TEMP/govpre08-step3-genesis.json" \
    --chain-id 31337 --accounts 1 --balance 0 --gas-price 0 --base-fee 0 \
    --host 127.0.0.1 --port "$port" --silent \
    --dump-state "$RUNNER_TEMP/govpre08-step3-state-$tag.json" \
    > "$RUNNER_TEMP/govpre08-step3-node-$tag.log" 2>&1 &
  pid=$!
  trap 'kill "$pid" 2>/dev/null || true' EXIT
  ready=false
  for attempt in $(seq 1 40); do
    if cast chain-id --rpc-url "$GOV_PRE_08_RPC" >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true || { cat "$RUNNER_TEMP/govpre08-step3-node-$tag.log"; exit 1; }
  python3 scripts/gov-pre-08/materialize-local-vault-funding.py \
    --rpc "$GOV_PRE_08_RPC" --output "$GOV_PRE_08_STEP2_EVIDENCE"
  python3 scripts/gov-pre-08/test_step3.py
  python3 scripts/gov-pre-08/materialize-v4-source-and-audit-local.py \
    --verify-bundle "$RUNNER_TEMP/govpre08-step3-v4-a" --rpc "$GOV_PRE_08_RPC" \
    --step2-evidence "$GOV_PRE_08_STEP2_EVIDENCE" \
    --local-output "$RUNNER_TEMP/govpre08-step3-local-$tag.json" --probe-reorg
  kill -INT "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  trap - EXIT
  test -s "$RUNNER_TEMP/govpre08-step3-state-$tag.json" || {
    echo "Anvil did not save funded state" >&2; exit 1;
  }
  anvil --load-state "$RUNNER_TEMP/govpre08-step3-state-$tag.json" \
    --chain-id 31337 --accounts 1 --balance 0 --gas-price 0 --base-fee 0 \
    --host 127.0.0.1 --port "$port" --silent \
    > "$RUNNER_TEMP/govpre08-step3-restarted-$tag.log" 2>&1 &
  pid=$!
  trap 'kill "$pid" 2>/dev/null || true' EXIT
  ready=false
  for attempt in $(seq 1 40); do
    if cast chain-id --rpc-url "$GOV_PRE_08_RPC" >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  test "$ready" = true || { cat "$RUNNER_TEMP/govpre08-step3-restarted-$tag.log"; exit 1; }
  python3 scripts/gov-pre-08/verify-local-v4-recovery.py \
    --rpc "$GOV_PRE_08_RPC" --bundle "$RUNNER_TEMP/govpre08-step3-v4-a" \
    --baseline "$RUNNER_TEMP/govpre08-step3-local-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-recovery-$tag.json"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  trap - EXIT
done

python3 - <<'PY'
import json, os
from pathlib import Path
p = Path(os.environ["RUNNER_TEMP"])
a, b = [json.loads((p / f"govpre08-step3-local-{tag}.json").read_text()) for tag in "ab"]
for key in ("stateDigestSha256", "sourceManifestSha256", "constructorCode",
            "vaultIds", "vaults", "vaultBalancesWei", "protocolReserveAfterWei"):
    assert a[key] == b[key], "independent V4-shaped runtime drift: " + key
assert a["reorgProbe"] == b["reorgProbe"]
for tag in "ab":
    x = json.loads((p / f"govpre08-step3-recovery-{tag}.json").read_text())
    assert x["processRestartStateRecovered"] and x["nativeGenesisSupplyWei"] == str(42_000_000*10**18)
    assert not x["authorizedV4"] and not x["testnetQualified"]
print("GOV_PRE_08_STEP3_UNSIGNED_V4_ARTIFACT_REPLAY_REORG_AND_RESTART=PASS LOCAL_ONLY")
PY
