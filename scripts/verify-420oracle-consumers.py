#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
errors = []

def read(path):
    p = root / path
    if not p.exists():
        errors.append(f"missing {path}")
        return ""
    return p.read_text()

runtime = read("contracts/src/interfaces/IOracle420.sol")
legacy = read("contracts/src/interfaces/genesis/IOracle420.sol")
automation = read("420-automation/src/oracle.ts")
automation_test = read("420-automation/test/oracle.test.ts")
swap_adapter = read("contracts/src/oracle/TWAPOracleSourceAdapter420.sol")
swap_test = read("contracts/test/SwapTWAPOracle420.t.sol")
exchange = read("contracts/src/exchange/ExchangeOracleGuard420.sol")

# Canonical runtime ABI must remain the consumer authority.
for token in [
    "function readNumeric(bytes32 feedId)",
    "function readResult(bytes32 feedId)",
    "int256 value",
    "uint64 updatedAt",
    "uint8 decimals",
    "uint16 confidenceBps",
    "uint16 spreadBps",
    "uint16 sourceCount",
    "bytes32 resultHash",
    "uint16 agreeingSources",
]:
    if token not in runtime:
        errors.append(f"runtime IOracle420 missing {token}")

# Frozen legacy ABI must not silently become the runtime consumer surface.
for token in ["function price(", "function isFresh(", "function isSafe("]:
    if token not in legacy:
        errors.append(f"frozen legacy IOracle420 missing {token}")

# Automation's canonical envelopes must faithfully carry every runtime read field
# plus explicit off-chain provenance metadata; provider-shaped payloads stay rejected.
for token in [
    "value: bigint",
    "updatedAtSec: bigint",
    "decimals: number",
    "confidenceBps: number",
    "spreadBps: number",
    "sourceCount: number",
    "resultHash: string",
    "agreeingSources: number",
    "source: '420OracleRouter'",
    "providerNeutral: true",
    "AUT8_READ_FIELD_UNKNOWN",
]:
    if token not in automation:
        errors.append(f"420Automation Oracle consumer missing {token}")

for token in [
    "AUT-8 consumes canonical provider-neutral numeric automation reads",
    "AUT-8 consumes exact-result quorum reads",
    "AUT8_CHAIN_ID_MISMATCH",
    "AUT8_ROUTER_MISMATCH",
    "AUT8_FEED_TYPE_INVALID",
    "AUT8_CONFIDENCE_INSUFFICIENT",
    "AUT8_QUORUM_INSUFFICIENT",
    "AUT8_SPREAD_EXCEEDED",
]:
    if token not in automation_test:
        errors.append(f"420Automation Oracle tests missing {token}")

# Swap is an upstream source adapter, not a direct IOracle420 consumer.
for token in [
    "IOracleSourceAdapter420",
    "readObservation",
    "Types420.Health.HEALTHY",
    "observationWindowSeconds",
    "sourceHash",
    "validUntil",
]:
    if token not in swap_adapter:
        errors.append(f"Swap Oracle adapter missing {token}")

for token in [
    "TWAPOracleSourceAdapter420",
    "testStaleObservationFailsClosedForDirectAndAdapterReads",
]:
    if token not in swap_test:
        errors.append(f"Swap/Oracle integration test missing {token}")

# Exchange currently consumes its own fail-closed referencePrice boundary, not IOracle420.
if "interface IExchangeReferenceOracle420" not in exchange or "function referencePrice(bytes32 marketId)" not in exchange:
    errors.append("420Exchange oracle guard reference boundary missing")
if "IOracle420" in exchange or "readNumeric(" in exchange or "readResult(" in exchange:
    errors.append("420Exchange unexpectedly presents as a direct IOracle420 consumer")

# No production contract may import the frozen legacy Genesis Oracle ABI as a consumer.
for p in (root / "contracts/src").rglob("*.sol"):
    text = p.read_text()
    rel = p.relative_to(root).as_posix()
    if rel == "contracts/src/interfaces/genesis/IOracle420.sol":
        continue
    if "interfaces/genesis/IOracle420.sol" in text:
        errors.append(f"production consumer imports frozen legacy Oracle ABI: {rel}")

# Repository search is deliberately represented structurally here: Pay has no canonical
# Oracle integration surface in contracts/src/pay and therefore is not invented as a consumer.
pay_dir = root / "contracts/src/pay"
if pay_dir.exists():
    for p in pay_dir.rglob("*.sol"):
        text = p.read_text()
        if "IOracle420" in text or "readNumeric(" in text or "readResult(" in text:
            errors.append(f"420Pay direct Oracle consumer requires explicit qualification: {p.relative_to(root)}")

if errors:
    print("420Oracle consumer verification FAILED")
    for e in errors:
        print(f"- {e}")
    sys.exit(1)

print("420Oracle consumer verification PASS")
print("- 420Automation runtime-read envelope compatibility: PASS")
print("- Swap TWAP source-adapter boundary: PASS")
print("- 420Exchange classified as separate referencePrice consumer: PASS")
print("- 420Pay direct IOracle420 consumer: NONE")
print("- frozen legacy IOracle420 production imports: NONE")
