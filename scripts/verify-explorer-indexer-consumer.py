import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []

explorer = json.loads((root / "contracts/config/420explorer-genesis.json").read_text())
explorer_ready = json.loads((root / "testnet/public-services/explorer/readiness.json").read_text())
indexer_ready = json.loads((root / "testnet/public-services/indexer/readiness.json").read_text())

consumer = explorer.get("indexerConsumer", {})
if explorer.get("name") != "420Explorer": errors.append("explorer name")
if explorer.get("canonicalStateAuthority") is not False: errors.append("explorer authority")
if explorer.get("sources", {}).get("chainIndex") != "420Indexer /v1 read API": errors.append("chain source")
if explorer.get("sources", {}).get("directExecutionRpcIngestion") is not False: errors.append("direct rpc ingestion")
if consumer.get("service") != "420Indexer": errors.append("consumer service")
if consumer.get("apiVersion") != "v1": errors.append("api version")
if consumer.get("requiredChainId") != 420: errors.append("chain id")
for key in (
    "independentChainIngestion",
    "independentCheckpointStore",
    "independentReorgEngine",
    "independentProtocolDecoderRegistry",
):
    if consumer.get(key) is not False:
        errors.append(key)
if consumer.get("failClosedOnCanonicalAuthorityClaim") is not True:
    errors.append("authority claim fail closed")

required_endpoints = {
    "/v1/health",
    "/v1/blocks",
    "/v1/blocks/{number}",
    "/v1/transactions/{hash}",
    "/v1/receipts/{hash}",
    "/v1/blocks/{number}/logs",
    "/v1/services/{service}/versions/{version}",
}
if not required_endpoints.issubset(set(consumer.get("requiredEndpoints", []))):
    errors.append("required endpoints")

backend = explorer_ready.get("backend", {})
if backend.get("data_source") != "420Indexer /v1": errors.append("readiness data source")
if backend.get("independent_chain_ingestion") is not False: errors.append("readiness independent ingestion")
if indexer_ready.get("consumer_gates", {}).get("420Explorer") not in {
    "IMPLEMENTED_PENDING_CI",
    "QUALIFIED_INDEXER_API_CONSUMER",
}:
    errors.append("indexer consumer gate")

client = root / "explorer/indexerclient/client.go"
tests = root / "explorer/indexerclient/client_test.go"
if not client.exists(): errors.append("explorer indexer client")
if not tests.exists(): errors.append("explorer indexer tests")

print(json.dumps({"pass": not errors, "errors": errors}, indent=2))
sys.exit(1 if errors else 0)
