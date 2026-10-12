"""The BnB authority gate never treats missing or invented files as approval."""
import importlib.util
from pathlib import Path

spec=importlib.util.spec_from_file_location("bnb_live_readiness",Path(__file__).resolve().parents[1]/"live_readiness.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def test_missing_authority_is_blocked(tmp_path):
    result=mod.readiness(tmp_path)
    assert result["status"]=="BLOCKED_EXTERNAL_AUTHORITY"
    assert result["liveAccepted"] is False
    assert len(result["missing"])==3

def test_unreviewed_evidence_files_never_self_approve(tmp_path):
    for name in mod.REQUIRED:
        path=tmp_path/name
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text('{"accepted":true}')
    result=mod.readiness(tmp_path)
    assert result["status"]=="REVIEW_REQUIRED"
    assert result["liveAccepted"] is False
