#!/usr/bin/env python3
"""Mechanical REG-AUDIT-7 Registry/Indexer/resident integration qualification."""
from __future__ import annotations
import hashlib, json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]

def fail(msg): errors.append(msg)
def text(path): return (ROOT/path).read_text(encoding="utf-8")
def load(path): return json.loads(text(path))

road=text("docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md")
required_road=[
"Registry -> GenesisResidentAccess resolution;",
"Registry -> Indexer event ingestion and historical reconstruction;",
"bounded reorg/replay behavior;",
"Explorer/Search/AppStore/Verify projections remain non-canonical;",
"Developer Hub publication uses strict registered-service publication;",
"direct chain reads disagreeing with projections fail closed appropriately.",
"Exit: integration evidence tied to exact candidate SHA."
]
for token in required_road:
    if token not in road: fail("canonical REG-AUDIT-7 roadmap drift: "+token)

registry_path=ROOT/"contracts/src/apps/ProtocolRegistry.sol"
registry_blob=subprocess.check_output(["git","hash-object",str(registry_path)],cwd=ROOT,text=True).strip()
descriptor=load("420-indexer/descriptors/protocol-registry-v4.json")
if descriptor.get("canonicalAddress")!="0x0000000000000000000000000000000000000434":
    fail("Registry descriptor canonical address drift")
if descriptor.get("source",{}).get("gitBlobSha")!=registry_blob:
    fail("Registry descriptor is not tied to exact current ProtocolRegistry source blob")
payload={k:descriptor[k] for k in ("canonicalAddress","contractName","events","protocolVersion","source")}
digest=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":")).encode()).hexdigest()
if descriptor.get("descriptorSha256")!=digest:
    fail("Registry descriptor digest mismatch")

projection=text("indexer/decoder/projection.go")
runtime=text("indexer/cmd/indexer420/main.go")
backend=text("indexer/api/backend.go")
resident_test=text("contracts/test/RegistryApiReconciliation420.t.sol")
reorg_test=text("indexer/ingest/registry_reorg_integration_test.go")
canonical_test=text("indexer/api/registry_canonical_reconciliation_test.go")
for token in [
"ProtocolRegistryCanonicalAddress420",
"RebuildProtocolRegistryCatalog420",
"registry projection log provenance mismatch",
"DecodeAndApply",
]:
    if token not in projection: fail("Registry projection rebuild missing "+token)
if runtime.count("RebuildProtocolRegistryCatalog420")<2:
    fail("indexer420 runtime must rebuild Registry projection initially and after catch-up")
if "ReplaceRegistryCatalog" not in runtime:
    fail("indexer420 runtime does not atomically refresh Registry catalogue after catch-up")
for token in ["ErrRegistryProjectionMismatch","WithCanonicalRegistryReader","reflect.DeepEqual"]:
    if token not in backend: fail("canonical-vs-projection fail-closed seam missing "+token)
for token in [
"testRealGenesisResidentResolvesThroughProtocolRegistryAndFailsClosedWhenDeprecated",
"testRealGenesisResidentRejectsRuntimeCodeHashDrift",
]:
    if token not in resident_test: fail("resident integration coverage missing "+token)
for token in [
"TestRegistryProjectionRebuildTracksCanonicalReorgReplay",
"orphaned Registry history survived canonical replay",
]:
    if token not in reorg_test: fail("Registry reorg/replay qualification missing "+token)
for token in [
"TestCanonicalRegistryComparisonFailsClosedOnProjectionMismatch",
"TestCanonicalRegistryComparisonFailsClosedWhenDirectReadFails",
]:
    if token not in canonical_test: fail("canonical disagreement qualification missing "+token)

for path,name in [
("contracts/config/420explorer-genesis.json","Explorer"),
("contracts/config/420search-genesis.json","Search"),
("contracts/config/420appstore-genesis.json","AppStore"),
("contracts/config/420verify-genesis.json","Verify"),
]:
    cfg=load(path)
    if cfg.get("canonicalStateAuthority") is not False:
        fail(name+" projection improperly claims canonical authority")

publishing=text("developer-hub/src/app-publishing.mjs")
if "method: 'publishRegisteredService'" not in publishing:
    fail("Developer Hub is not pinned to publishRegisteredService")
if "canonicalRegistration: false" not in publishing or "appStoreListingCanonical: false" not in publishing:
    fail("Developer Hub/AppStore projection authority boundary drift")
for forbidden in ["method: 'publishService'","method: 'setService'"]:
    if forbidden in publishing: fail("Developer Hub exposes legacy Genesis publication path: "+forbidden)

idx=load("config/420indexer-v1.json")
if idx.get("canonicalStateAuthority") is not False:
    fail("420Indexer improperly claims canonical authority")
if idx.get("reorgPolicy",{}).get("rollbackNonFinalized") is not True or idx.get("reorgPolicy",{}).get("rewriteFinalized") is not False:
    fail("420Indexer bounded reorg policy drift")

if errors:
    print("REG-AUDIT-7 qualification FAILED",file=sys.stderr)
    for e in errors: print(" - "+e,file=sys.stderr)
    raise SystemExit(1)
print("REG-AUDIT-7 qualification PASS")
print("ProtocolRegistry source blob:",registry_blob)
print("Registry descriptor SHA-256:",digest)
