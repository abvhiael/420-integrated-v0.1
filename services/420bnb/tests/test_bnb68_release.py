"""BNB-6.8 release promotion/rollback fail-closed adversarial validation."""
import copy,importlib.util
from pathlib import Path
import pytest
sp=importlib.util.spec_from_file_location("bnb68",Path(__file__).resolve().parents[1]/"release_controls.py")
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
@pytest.fixture
def valid():
 return {"schema":"420.bnb.release.v1","release_sha":"a"*40,
  "images":{k:f"example/{k}@sha256:"+"b"*64 for k in ("api","web","ingress","worker")},
  "migration_version":30,"flags":{"booking_enabled":False,"financial_execution":False,"travel_bnb_booking":False},
  "rollback_policy":{"automatic_database_down_migration":False,"restore_requires_verified_backup":True,
  "previous_binary_requires_compatibility_proof":True},
  "approval":{"independent_operator_verified":False,"live_accepted":False}}
def test_valid_release_remains_blocked_even_if_caller_claims_all_proofs(valid):
 r=m.evaluate(valid,approved=True,ledger_verified=True,backup_restored=True,
 compatibility_verified=True,runtime_ready=True,independent_receipts=True)
 assert r["manifest_valid"] and not r["ready_to_promote"]
 assert "INDEPENDENT_DEPLOYMENT_ACCEPTANCE_REQUIRED" in r["blocked"]
@pytest.mark.parametrize("field,value,code",[
 ("release_sha","head","RELEASE_SHA_INVALID"),
 ("migration_version",29,"SCHEMA_VERSION_INVALID"),
 ("images",{"api":"latest"},"IMMUTABLE_IMAGES_REQUIRED")])
def test_mutations_rejected(valid,field,value,code):
 valid[field]=value
 with pytest.raises(m.ReleaseBlocked,match=code):m.evaluate(valid)
def test_no_synthetic_approvals_or_activation(valid):
 valid["approval"]["live_accepted"]=True
 with pytest.raises(m.ReleaseBlocked,match="SYNTHETIC_APPROVAL_FORBIDDEN"):m.evaluate(valid)
 valid["approval"]["live_accepted"]=False
 valid["flags"]["booking_enabled"]=True
 with pytest.raises(m.ReleaseBlocked,match="ACTIVATION_FORBIDDEN"):m.evaluate(valid)
def test_rollback_requires_immutable_image_and_never_runs_down_migration(valid):
 with pytest.raises(m.ReleaseBlocked,match="ROLLBACK_IMAGE_INVALID"):
  m.rollback(valid,previous_image="example/api:latest")
 r=m.rollback(valid,previous_image=valid["images"]["api"],backup_verified=True,
 schema_compatibility_verified=True,independent_approval=True)
 assert not r["executable"] and not r["database_down_migration"]
 assert r["blockers"]==["LIVE_ROLLBACK_REHEARSAL_REQUIRED"]
def test_missing_or_untrusted_proofs_block(valid):
 assert len(m.evaluate(valid)["blocked"])==7
 with pytest.raises(m.ReleaseBlocked,match="RELEASE_INPUT_INVALID"):
  m.evaluate(valid,approved=1)
