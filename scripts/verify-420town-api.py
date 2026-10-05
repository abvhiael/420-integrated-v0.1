#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def need(cond,msg):
    if not cond:
        errors.append(msg)

cfg=json.loads((ROOT/"config/420town-api-v1.json").read_text())
town=json.loads((ROOT/"config/420town-genesis.json").read_text())
api=(ROOT/"town/api/server.go").read_text()
api_test=(ROOT/"town/api/server_test.go").read_text()
projection=(ROOT/"town/projection/store.go").read_text()
projection_test=(ROOT/"town/projection/store_test.go").read_text()
recovery=(ROOT/"town/recovery/file.go").read_text()
recovery_test=(ROOT/"town/recovery/file_test.go").read_text()
sdk=(ROOT/"sdk/town420/client.go").read_text()
sdk_test=(ROOT/"sdk/town420/client_test.go").read_text()
workflow=(ROOT/".github/workflows/420town-audit.yml").read_text()
docs=(ROOT/"docs/apps/town/api.md").read_text()

need(cfg.get("schema")=="420-town-api-v1","Town API schema drift")
need(cfg.get("serviceId")=="420/service/town/v1","Town API service ID drift")
need(cfg.get("status")=="API_SDK_INDEXER_RECOVERY_BASELINE","Town API config status drift")
need(town.get("status")=="API_SDK_INDEXER_RECOVERY_BASELINE","Town canonical phase has not advanced to TOWN-AUDIT-7 baseline")
need("TOWN-AUDIT-7" in town.get("implementedThrough",[]),"Town canonical config missing TOWN-AUDIT-7")
need("TOWN-AUDIT-7" not in town.get("deferredRoadmap",[]),"Town canonical config still defers TOWN-AUDIT-7")
for key,value in {
    "apiConfig":"config/420town-api-v1.json",
    "apiPackage":"town/api",
    "projectionPackage":"town/projection",
    "recoveryPackage":"town/recovery",
    "sdkPackage":"sdk/town420",
}.items():
    need(town.get(key)==value,f"Town canonical {key} drift")

api_cfg=cfg.get("api",{})
need(api_cfg.get("basePath")=="/v1","API base path drift")
need(api_cfg.get("maxRequestBytes")==65536,"API request bound drift")
need(api_cfg.get("mutationAuthentication")=="REQUIRED","mutation authentication must remain required")
need(api_cfg.get("mutationIdempotency")=="REQUIRED","mutation idempotency must remain required")
need(api_cfg.get("publicProjectionReads")=="PUBLIC_ONLY","public projection visibility widened")
need(len(api_cfg.get("routes",[]))>=7,"Town /v1 route inventory incomplete")

sdk_cfg=cfg.get("sdk",{})
need(sdk_cfg.get("package")=="sdk/town420","SDK package drift")
need(sdk_cfg.get("remoteHttpsRequired") is True,"SDK HTTPS boundary disabled")
need(sdk_cfg.get("writeBearerTokenRequired") is True,"SDK mutation auth disabled")
need(sdk_cfg.get("writeIdempotencyRequired") is True,"SDK idempotency disabled")
need(1 <= sdk_cfg.get("maxRetryAttempts",0) <= 5,"SDK retry attempts unbounded")
need(sdk_cfg.get("maxRetryDelayMs",0) <= 2000,"SDK retry delay unbounded")
need(sdk_cfg.get("retryableStatusCodes")==[429,502,503,504],"SDK retryable status set drift")

proj=cfg.get("projection",{})
need(proj.get("authority")=="DERIVED_NON_CANONICAL","projection authority drift")
need(proj.get("rebuildable") is True and proj.get("reorgSafe") is True,"projection must remain rebuild/reorg safe")
need(proj.get("cursorModel")=="GENERATION_BOUND_OPAQUE","cursor model drift")
need(proj.get("publicListVisibility")=="PUBLIC_ONLY","projection public list visibility widened")
need(proj.get("chainGapPolicy")=="FAIL_CLOSED" and proj.get("parentMismatchPolicy")=="FAIL_CLOSED","projection chain validation weakened")

rec=cfg.get("recovery",{})
need(rec.get("schema")=="420-town-projection-recovery-v1","recovery schema drift")
need(rec.get("atomicFileReplace") is True,"recovery atomic replace disabled")
need(rec.get("fileMode")=="0600","recovery file mode drift")
need(rec.get("maxSnapshotBytes")==8388608,"recovery snapshot bound drift")
need(rec.get("interruptionRecovery")=="SNAPSHOT_AND_RESTORE","interruption recovery model drift")

webhooks=cfg.get("webhooks",{})
need(webhooks.get("enabled") is False,"webhooks cannot be enabled before signed replay protection is implemented")
need(len(cfg.get("invariants",[]))>=18,"Town API invariant inventory incomplete")

for token in [
    'mux.HandleFunc("GET /v1/health"',
    'mux.HandleFunc("GET /v1/communities/{community}/posts"',
    'mux.HandleFunc("POST /v1/communities/{community}/posts"',
    'Idempotency-Key',
    'DisallowUnknownFields',
    'http.MaxBytesReader',
    'StaticTokenAuthenticator',
    'ListPublicPosts',
    'MetricsSnapshot',
]:
    need(token in api,f"Town API missing {token}")

for token in [
    "ApplyBlock",
    "Rebuild",
    "ErrParentMismatch",
    "ErrChainGap",
    "ErrStaleCursor",
    "SnapshotRecovery",
    "RestoreRecovery",
    "generation",
]:
    need(token in projection,f"Town projection missing {token}")

for token in ["os.CreateTemp","tmp.Sync","os.Rename","0o600","maxRecoveryBytes","Restore("]:
    need(token in recovery,f"Town recovery missing {token}")

for token in [
    "RetryPolicy",
    "MaxAttempts",
    "MaxDelay",
    "non-loopback SDK endpoint requires HTTPS",
    "Idempotency-Key",
    "shouldRetry",
    "StatusTooManyRequests",
    "StatusBadGateway",
    "StatusServiceUnavailable",
    "StatusGatewayTimeout",
]:
    need(token in sdk,f"Town SDK missing {token}")

for token in [
    "TestMutationRequiresAuthenticationAndIdempotency",
    "TestAPIRejectsUnknownFieldsAndMapsBackendErrors",
    "TestReorgRebuildsDerivedStateAndInvalidatesCursor",
    "TestRecoveryRoundTripAndRejectsBrokenChain",
    "TestSaveLoadRestoreRoundTrip",
    "TestMutationCarriesBearerAndStableIdempotencyAcrossRetry",
    "TestClientDoesNotRetryNonRetryableConflict",
]:
    test_blob="\n".join([api_test,projection_test,recovery_test,sdk_test])
    need(token in test_blob,f"Town API/SDK/recovery test missing {token}")

for token in [
    "webhook",
    "signed",
    "replay",
    "generation-bound",
    "reorg",
    "recovery",
    "bounded retry",
]:
    need(token.lower() in docs.lower(),f"Town API documentation missing {token}")

for token in [
    "Verify Town API SDK projection and recovery",
    "scripts/verify-420town-api.py",
    "go test ./town/... ./sdk/town420",
    "gofmt -l",
    "go vet ./town/... ./sdk/town420",
]:
    need(token in workflow,f"Town workflow missing TOWN-AUDIT-7 gate: {token}")

if errors:
    print("420Town API/SDK/projection/recovery verifier FAILED")
    for e in errors:
        print("-",e)
    raise SystemExit(1)

print("420Town API/SDK/projection/recovery verifier PASS")
print("api=/v1")
print("sdk=sdk/town420")
print("projection=DERIVED_NON_CANONICAL_REORG_SAFE")
print("recovery=ATOMIC_SNAPSHOT_RESTORE")
print("webhooks=DISABLED")
print(f"invariants={len(cfg['invariants'])}")
