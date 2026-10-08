#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def req(ok,msg):
    if not ok: errors.append(msg)
def read(rel):
    p=ROOT/rel
    req(p.exists(),f"missing {rel}")
    return p.read_text() if p.exists() else ""

store=read("reefer-review/durable_store.go")
storage=read("reefer-review/storage420.go")
rights=read("reefer-review/rights_provenance.go")
service=read("reefer-review/service.go")
model=read("reefer-review/model.go")
composition=read("reefer-review/rr5_service.go")
tests=read("reefer-review/rr5_test.go")
storetests=read("reefer-review/durable_store_test.go")
doc=read("docs/reefer-review/RR-5-DURABLE-STORAGE-RIGHTS.md")
roadmap=read("docs/reefer-review/RR-ROADMAP.md")

for marker in ["DurableStoreSchemaVersion","OpenDurableStore","syscall.Flock","os.CreateTemp","tmp.Sync()","os.Rename","os.Chmod(s.path, 0o600)","df.Sync()","BindIdempotency","AppendRevision","AppendModerationEvent"]:
    req(marker in store,f"durable store missing {marker}")
for marker in ["sdk/storage420","Storage420BlobAdapter","Qualified420Storage","EncryptedAtRest","ExternalKeyCustody","OwnerScopedAccess","SHA256Integrity","PutForOwner","GetForOwner","storage420:","validateStorageObject"]:
    req(marker in storage,f"Storage boundary missing {marker}")
for marker in ["420/service/rights/v1","RightsProvenanceProvider","SubjectID","RightID","ClaimID","HolderWallet","EvidenceHash","ProvenanceHash","BodyDigest","ChainID","Network","RegistryRef","RouterRef","BlockNumber","BlockHash","VerifiedAt"]:
    req(marker in rights,f"Rights provenance missing {marker}")
for marker in ["putBody(","getBody(","assertRights(","OwnerScopedBlobStore","RightsProvenanceProvider","ErrStorageIntegrity"]:
    req(marker in service,f"service RR-5 binding missing {marker}")
req("RightsProvenance *RightsProvenance" in model,"publication/revision Rights provenance not persisted")
for marker in ["validateBlobSecurity","RightsProvenanceProvider","OpenDurableStore"]:
    req(marker in composition,f"durable composition missing {marker}")

auth_pos=service.find("ok, err := s.Auth.CanRead")
blob_pos=service.find("body, err := s.getBody", auth_pos)
req(auth_pos >= 0 and blob_pos > auth_pos,"restricted read must authorize before blob fetch")

for marker in [
 "TestRR5DurablePublicationRestartAndIdempotency",
 "TestRR5PublicReadVerifiesStorageIntegrity",
 "TestRR5UnauthorizedReadDoesNotFetchPrivateBlob",
 "TestRR5RequiresQualifiedStorageSecurity",
 "TestRR5RequiresRightsProvenanceProvider",
 "TestRR5RightsProvenanceMismatchFailsClosed",
 "TestRR5StorageAdapterRejectsProviderRootSubstitution",
 "TestRR5RightsProvenanceBindsSessionWalletChainAndNetwork",
]:
    req(marker in tests,f"RR-5 adversarial test missing {marker}")
for marker in ["TestRR5DurableStoreFilePermissionsAndIdempotencyRestart","TestRR5DurableStoreRejectsCorruptionAndFutureSchema"]:
    req(marker in storetests,f"durable store test missing {marker}")
for suffix in "ABCDEFGH":
    req(f"RR-5.{suffix}" in doc,f"RR-5 requirement {suffix} missing")
req("RR-5 — Durable Storage & Rights" in roadmap,"canonical RR-5 roadmap entry missing")
req("RR-6 — Ecosystem Integrations" in roadmap,"next canonical step missing")

if errors:
    for e in errors: print("ERROR:",e)
    sys.exit(1)
print("Reefer Review RR-5 verifier: PASS")
