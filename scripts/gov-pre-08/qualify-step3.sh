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

# Retain actual production Solidity constructor/authority/custody transactions
# from the locally qualified Step 2 base, not source-only ABI verification.
export GOV_PRE_08_STEP3_EVM_CLOSURE="$RUNNER_TEMP/govpre08-step3-foundry"
python3 - <<'PY'
import hashlib,json,os,re,shutil
from pathlib import Path
root=(Path.cwd()/"contracts").resolve()
dest=Path(os.environ["GOV_PRE_08_STEP3_EVM_CLOSURE"])
pending=[root/"test/GOVPRE08LocalFunding420.t.sol"]
seen=set()
pat=re.compile(r'\bimport\s+(?:[^;]*?\bfrom\s+)?["\x27]([^"\x27]+)["\x27]\s*;')
while pending:
    p=pending.pop().resolve()
    if p in seen: continue
    if not p.is_relative_to(root) or not p.is_file():
        raise RuntimeError("missing production Step 3 contract import: "+str(p))
    seen.add(p)
    for link in pat.findall(p.read_text()):
        pending.append(p.parent/link)
for p in sorted(seen):
    out=dest/p.relative_to(root)
    out.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(p,out)
    assert p.read_bytes()==out.read_bytes()
shutil.copyfile(root/"foundry.toml",dest/"foundry.toml")
(dest/"remappings.txt").write_text("forge-std/=forge-std/\n")
(Path(os.environ["RUNNER_TEMP"])/"govpre08-step3-imports.json").write_text(
    json.dumps({str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(seen)},sort_keys=True,indent=2)+"\n")
print("GOV_PRE_08_STEP3_PRODUCTION_CONTRACT_IMPORTS",len(seen))
PY
for tag in a b; do
  forge test --root "$GOV_PRE_08_STEP3_EVM_CLOSURE" \
    --match-contract GOVPRE08LocalFunding420Test -vv \
    | tee "$RUNNER_TEMP/govpre08-step3-foundry-$tag.log"
done
python3 - <<'PY'
import os,re
from pathlib import Path
p=Path(os.environ["RUNNER_TEMP"])
records=[]
for tag in "ab":
    txt=(p/f"govpre08-step3-foundry-{tag}.log").read_text()
    m=re.search(r"(?m)^Ran (\d+) tests for test/GOVPRE08LocalFunding420.t.sol",txt)
    assert m and int(m.group(1))>=10 and "0 failed" in txt and "0 skipped" in txt
    hashes=re.findall(r"(?m)^[ \t]*(0x[0-9a-fA-F]{64})[ \t]*$",txt)
    assert len(hashes)==2,"real deployment graph and funded custody digests absent"
    records.append((int(m.group(1)),hashes[0].lower(),hashes[1].lower()))
assert records[0]==records[1],"independent Foundry EVM graph/custody changed"
print("GOV_PRE_08_STEP3_REPEATED_ACTUAL_FOUNDER_TREASURY_VAULT_EVM=PASS",records[0])
PY

forge build --root contracts \
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
  src/vault/AssetVault420.sol \
  src/vault/VaultRouter420.sol \
  src/apps/ProtocolRegistry.sol \
  src/governance/GovernanceTimelock.sol \
  src/governance/CivicConstitution420.sol \
  src/governance/CivicProposalRegistry420.sol \
  src/governance/CivicElectorateRegistry420.sol \
  src/governance/CivicVoting420.sol \
  src/governance/CivicGovernor420.sol \
  src/system/CommunityValidatorReserve.sol \
  src/system/ValidatorRegistry.sol \
  --extra-output storageLayout

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

(
  cd 420-indexer
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
)
for tag in a b; do
  if [ "$tag" = a ]; then port=18761; else port=18762; fi
  export GOV_PRE_08_RPC="http://127.0.0.1:$port"
  export GOV_PRE_08_STEP2_EVIDENCE="$RUNNER_TEMP/govpre08-step3-funding-$tag.json"
  anvil --init "$RUNNER_TEMP/govpre08-step3-genesis.json" \
    --chain-id 31337 --accounts 1 --balance 0 --gas-price 0 --base-fee 0 \
    --host 127.0.0.1 --port "$port" --silent \
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
  python3 scripts/gov-pre-08/materialize-local-v4-contract-graph.py \
    --rpc "$GOV_PRE_08_RPC" --deploy-from-step2 "$GOV_PRE_08_STEP2_EVIDENCE" \
    --output "$RUNNER_TEMP/govpre08-step3-graph-$tag.json"
  python3 scripts/gov-pre-08/materialize-local-v4-contract-graph.py \
    --rpc "$GOV_PRE_08_RPC" --verify "$RUNNER_TEMP/govpre08-step3-graph-$tag.json"
  node scripts/gov-pre-08/qualify-step3-wallet.mjs \
    --rpc "$GOV_PRE_08_RPC" --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-wallet-$tag.json"
  node scripts/gov-pre-08/qualify-step3-indexer.mjs \
    --rpc "$GOV_PRE_08_RPC" --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-indexer-$tag.json" \
    --descriptors-output "$RUNNER_TEMP/govpre08-step3-descriptors-$tag.json"
  node scripts/gov-pre-08/qualify-step3-postgres.mjs \
    --mode initial --tag "$tag" --rpc "$GOV_PRE_08_RPC" \
    --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
    --descriptors "$RUNNER_TEMP/govpre08-step3-descriptors-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-postgres-initial-$tag.json"
  bash scripts/gov-pre-08/qualify-step3-explorer.sh "$tag" original
  python3 scripts/gov-pre-08/test_step3.py
  python3 scripts/gov-pre-08/materialize-v4-source-and-audit-local.py \
    --verify-bundle "$RUNNER_TEMP/govpre08-step3-v4-a" --rpc "$GOV_PRE_08_RPC" \
    --step2-evidence "$GOV_PRE_08_STEP2_EVIDENCE" \
    --local-output "$RUNNER_TEMP/govpre08-step3-local-$tag.json" --probe-reorg
  python3 scripts/gov-pre-08/restart-local-anvil.py \
    --rpc "$GOV_PRE_08_RPC" --dump "$RUNNER_TEMP/govpre08-step3-state-$tag.json"
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  trap - EXIT
  test -s "$RUNNER_TEMP/govpre08-step3-state-$tag.json" || {
    echo "Anvil did not save funded state" >&2; exit 1;
  }
  anvil --init "$RUNNER_TEMP/govpre08-step3-genesis.json" \
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
  python3 scripts/gov-pre-08/restart-local-anvil.py \
    --rpc "$GOV_PRE_08_RPC" --restore "$RUNNER_TEMP/govpre08-step3-state-$tag.json"
  python3 scripts/gov-pre-08/verify-local-v4-recovery.py \
    --rpc "$GOV_PRE_08_RPC" --bundle "$RUNNER_TEMP/govpre08-step3-v4-a" \
    --baseline "$RUNNER_TEMP/govpre08-step3-local-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-recovery-$tag.json"
  python3 scripts/gov-pre-08/materialize-local-v4-contract-graph.py \
    --rpc "$GOV_PRE_08_RPC" --verify "$RUNNER_TEMP/govpre08-step3-graph-$tag.json"
  node scripts/gov-pre-08/qualify-step3-wallet.mjs \
    --rpc "$GOV_PRE_08_RPC" --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-wallet-recovered-$tag.json"
  node scripts/gov-pre-08/qualify-step3-postgres.mjs \
    --mode recover --tag "$tag" --rpc "$GOV_PRE_08_RPC" \
    --graph "$RUNNER_TEMP/govpre08-step3-graph-$tag.json" \
    --descriptors "$RUNNER_TEMP/govpre08-step3-descriptors-$tag.json" \
    --output "$RUNNER_TEMP/govpre08-step3-postgres-recover-$tag.json"
  bash scripts/gov-pre-08/qualify-step3-explorer.sh "$tag" recovered
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
graphs=[json.loads((p/f"govpre08-step3-graph-{tag}.json").read_text()) for tag in "ab"]
assert graphs[0]["deterministicGraphDigestSha256"]==graphs[1]["deterministicGraphDigestSha256"], "actual 14-constructor graph differed across two independent chains"
assert len(graphs[0]["actualProductionConstructorAddresses"])==14
assert len(graphs[0]["localRegistryComponentIds"])==14
assert len(graphs[0]["serviceDiscoveries"])==4
assert len(graphs[0]["walletCanonicalComponentIds"])==6
wallet=[json.loads((p/f"govpre08-step3-wallet-{tag}.json").read_text()) for tag in "ab"]
recovered_wallet=[json.loads((p/f"govpre08-step3-wallet-recovered-{tag}.json").read_text()) for tag in "ab"]
assert all(x["treasuryCanonicalDiscovery"] and x["governanceFiveModulesVerified"] and
           x["wrongChainRejected"] and x["accountDisconnectedRejected"] and
           x["staleRegistryRejected"] and x["unapprovedProductionTransactionsSent"]==0
           for x in wallet+recovered_wallet)
indexed=[json.loads((p/f"govpre08-step3-indexer-{tag}.json").read_text()) for tag in "ab"]
assert all(r["indexedLogs"]>=20 and r["sourceEmittersBound"]>=10 and
           r["reorgRollbackAndRebuild"] and r["replayIdempotent"] and
           r["wrongEmitterRejected"] and not r["postgresQualified"] for r in indexed)
assert indexed[0]["normalizedReadModelDigest"]==indexed[1]["normalizedReadModelDigest"], "live Indexer RPC decoder/projection drift across independently funded chains"
pg0=[json.loads((p/f"govpre08-step3-postgres-initial-{tag}.json").read_text()) for tag in "ab"]
pg1=[json.loads((p/f"govpre08-step3-postgres-recover-{tag}.json").read_text()) for tag in "ab"]
for init,recovery in zip(pg0,pg1):
    assert init["phase"]=="INITIAL_COLD_START_REORG" and recovery["phase"]=="PROCESS_AND_ANVIL_STATE_RECOVERY"
    assert init["state"]["normalizedReadModelDigest"]==recovery["state"]["normalizedReadModelDigest"]
    assert init["state"]["checkpoint"]==recovery["state"]["checkpoint"], "PostgreSQL durable checkpoint drifted after Anvil restart"
    assert init["actualHttpIndexer"]["wrongChainReadyHTTP"]==503 and recovery["actualHttpIndexer"]["wrongChainReadyHTTP"]==503
    assert init["actualReorgDepthAtLeastOne"] and recovery["reopenedExistingCheckpoint"]
    assert not init["networkConsensusFinalityQualified"] and not recovery["productionMigrationAuthorized"]
assert pg0[0]["state"]["normalizedReadModelDigest"]==pg0[1]["state"]["normalizedReadModelDigest"], "independent real PostgreSQL protocol projections differ"
exp=[json.loads((p/f"govpre08-step3-explorer-report-{tag}-{phase}.json").read_text())
     for tag in "ab" for phase in ("original","recovered")]
assert all(e["realGoExplorerProcess"] and e["realPostgresIndexerSource"] and
           e["actualIndexedBlocksAndTransactionRead"] and
           e["actualRegistryServiceVersionRecovered"] and
           e["wrongChainBlocked"] and e["canonicalAuthority"]==False and
           e["syntheticBftFinality"]==False for e in exp)
assert exp[0]["explorerIndexedHead"]==exp[1]["explorerIndexedHead"]
assert exp[2]["explorerIndexedHead"]==exp[3]["explorerIndexedHead"]
assert all(not g["approvedV4"] and not g["authenticFounderOwnersVerified"] for g in graphs)
for tag in "ab":
    x = json.loads((p / f"govpre08-step3-recovery-{tag}.json").read_text())
    assert x["processRestartStateRecovered"] and x["nativeGenesisSupplyWei"] == str(42_000_000*10**18)
    assert not x["authorizedV4"] and not x["testnetQualified"]
print("GOV_PRE_08_STEP3_UNSIGNED_V4_ARTIFACT_REPLAY_REORG_AND_RESTART=PASS LOCAL_ONLY")
PY
