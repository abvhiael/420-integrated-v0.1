"""BNB-3.9: an abuse report with the same target cannot silently change allegations."""
import importlib.util
from pathlib import Path
from uuid import uuid4
import pytest
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb39_trust",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class Cursor:
    def __init__(self, value):self.value=value
    def fetchone(self):return self.value

class DB:
    def __init__(self, target, report_id):
        self.target=target
        self.report_id=report_id
        self.commands=[]
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def transaction(self):return self
    def execute(self,sql,params=None):
        self.commands.append(sql)
        if "FROM bnb_guest_review r JOIN bnb_property" in sql:
            return Cursor(self.target)
        if "SELECT id,reason,detail FROM bnb_abuse_report" in sql:
            return Cursor((self.report_id,"harassment","original complaint"))
        if "SELECT subject FROM bnb_account" in sql:
            return Cursor(("test-guest",))
        raise AssertionError("unexpected database call: "+sql)

def test_abuse_report_replay_requires_identical_allegations(monkeypatch):
    report_id=uuid4()
    db=DB((uuid4(),"test-guest","other-host"),report_id)
    monkeypatch.setattr(api,"active_subject",lambda _:"test-guest")
    monkeypatch.setattr(api,"db",lambda:db)
    item=uuid4()
    original=api.AbuseReportInput(target_type="review",target_id=item,
                                  reason="harassment",detail="original complaint")
    repeat=api.submit_abuse_report(original,"Bearer test")
    assert repeat["replayed"] is True
    assert repeat["id"]==str(report_id)
    altered=api.AbuseReportInput(target_type="review",target_id=item,
                                 reason="fraud",detail="changed")
    with pytest.raises(HTTPException) as exc:
        api.submit_abuse_report(altered,"Bearer test")
    assert exc.value.status_code==409
    assert exc.value.detail=="ABUSE_REPORT_REPLAY_CONFLICT"
    assert not any("INSERT INTO bnb_abuse_report" in statement for statement in db.commands)
