"""External real-world signoffs must never be fabricated by test fixtures."""
import importlib.util
from pathlib import Path

path=Path(__file__).resolve().parents[1]/"external_acceptance.py"
spec=importlib.util.spec_from_file_location("bnb_acceptance",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def test_missing_external_approvals_fail_closed():
    result=module.evaluate({})
    assert result["accepted"] is False
    assert result["status"]=="BLOCKED_EXTERNAL_AUTHORITY_AND_MANUAL_TESTING"

def test_metadata_cannot_self_certify_manual_testing():
    fake={"release_sha":"f"*40}
    for group,requirements in module.REQUIRED.items():
        fake[group]={field:"fixture-only" for field in requirements}
    result=module.evaluate(fake)
    assert result["accepted"] is False
    assert result["status"]=="EXTERNAL_VERIFICATION_REQUIRED"
    assert result["missing"]==[]

def test_partial_moderation_and_missing_human_screenreader_results():
    result=module.evaluate({"release_sha":"f"*40,"moderation":{"organization":"test-only"}})
    assert result["accepted"] is False
    assert "accessibility" in result["missing"]
    assert "moderation.signed_approval_reference" in result["missing"]
