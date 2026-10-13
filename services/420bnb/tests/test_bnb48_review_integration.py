"""BNB-4.8 real PostgreSQL reviewer separation, appeal races, proof and hold integration."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb48_review_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


@pytest.fixture
def report(monkeypatch):
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn: pytest.skip("PostgreSQL acceptance fixture required")
    pid,rid,aid=uuid4(),uuid4(),uuid4()
    with psycopg.connect(dsn) as c:
        for subject in ("m48-review-reporter","m48-review-host"):
            c.execute("INSERT INTO bnb_account(subject) VALUES(%s) ON CONFLICT DO NOTHING",(subject,))
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,
            status,capacity,nightly_minor,currency)
            VALUES(%s,'m48-review-host','Review case','BC','draft',1,1,'CAD')""",(pid,))
        c.execute("""INSERT INTO bnb_abuse_report(id,reporter_subject,property_id,
            target_type,target_id,reason,detail)
            VALUES(%s,'m48-review-reporter',%s,'review',%s,'fraud','private complaint')""",
            (rid,pid,uuid4()))
    monkeypatch.setattr(api,"DATABASE_URL",dsn)
    try:
        yield (dsn,pid,rid,aid)
    finally:
        with psycopg.connect(dsn) as c:
            c.execute("DELETE FROM bnb_review_moderation_nonce WHERE target_id=%s",(rid,))
            c.execute("DELETE FROM bnb_moderation_appeal_decision_nonce WHERE appeal_id=%s",(aid,))
            c.execute("DELETE FROM bnb_privacy_retention_hold WHERE report_id=%s",(rid,))
            c.execute("DELETE FROM bnb_moderation_appeal WHERE report_id=%s",(rid,))
            c.execute("DELETE FROM bnb_abuse_report WHERE id=%s",(rid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))
            for subject in ("m48-review-reporter","m48-review-host"):
                c.execute("DELETE FROM bnb_account WHERE subject=%s",(subject,))


def test_signed_moderation_appeal_and_read_exclude_all_conflicted_reviewers(report,monkeypatch):
    dsn,pid,rid,aid=report
    token_claims={}
    monkeypatch.setattr(api,"verify_authority",lambda token,*_:token_claims[token])
    choice=api.AbuseReportDecision(decision="dismissed")
    for actor in ("m48-review-reporter","m48-review-host"):
        token_claims[actor]={"iss":"independent-test","jti":str(uuid4()),
            "sub":actor,"report_id":str(rid),"decision":"dismissed"}
        with pytest.raises(HTTPException) as exc:
            api.moderate_abuse_report(rid,choice,actor)
        assert exc.value.status_code==403
    token_claims["reviewer-a"]={"iss":"independent-test","jti":str(uuid4()),
        "sub":"reviewer-a","report_id":str(rid),"decision":"dismissed"}
    accepted=api.moderate_abuse_report(rid,choice,"reviewer-a")
    assert accepted["state"]=="dismissed"
    with pytest.raises(HTTPException) as exc:
        api.moderate_abuse_report(rid,choice,"reviewer-a")
    assert exc.value.status_code==409
    with psycopg.connect(dsn) as c:
        c.execute("""INSERT INTO bnb_moderation_appeal
            (id,report_id,appellant_subject,grounds)
            VALUES(%s,%s,'m48-review-reporter','I request an independent review')""",(aid,rid))
    decision=api.ModerationAppealDecision(decision="upheld")
    for actor in ("reviewer-a","m48-review-reporter","m48-review-host"):
        token_claims[actor+"-appeal"]={"iss":"independent-test","jti":str(uuid4()),
            "sub":actor,"appeal_id":str(aid),"decision":"upheld"}
        with pytest.raises(HTTPException) as exc:
            api.decide_moderation_appeal(aid,decision,actor+"-appeal")
        assert exc.value.status_code==403
    token_claims["reviewer-b-appeal"]={"iss":"independent-test","jti":str(uuid4()),
        "sub":"reviewer-b","appeal_id":str(aid),"decision":"upheld"}
    completed=api.decide_moderation_appeal(aid,decision,"reviewer-b-appeal")
    assert completed["state"]=="upheld"
    for actor in ("reviewer-a","reviewer-b","m48-review-host"):
        token_claims[actor+"-read"]={"sub":actor,"report_id":str(rid),
                                   "casework_scope":"read",
                                   "current_reviewer_grant_verified":True,
                                   "reviewer_revoked":False}
        with pytest.raises(HTTPException) as exc:
            api.independent_abuse_case_view(rid,actor+"-read")
        assert exc.value.status_code==403
    token_claims["reviewer-c-read"]={"sub":"reviewer-c","report_id":str(rid),
                                    "casework_scope":"read",
                                    "current_reviewer_grant_verified":True,
                                    "reviewer_revoked":False}
    view=api.independent_abuse_case_view(rid,"reviewer-c-read")
    assert view["state"]=="dismissed"
    assert view["appeals"][0]["state"]=="upheld"
    assert "private complaint" not in str(view)
    assert view["financial_authority"] is False


def test_competing_appeal_dispositions_are_serialized_and_never_double_committed(report,monkeypatch):
    dsn,pid,rid,aid=report
    with psycopg.connect(dsn) as c:
        c.execute("UPDATE bnb_abuse_report SET status='dismissed',decided_by='reviewer-a' WHERE id=%s",(rid,))
        c.execute("""INSERT INTO bnb_moderation_appeal
            (id,report_id,appellant_subject,grounds)
            VALUES(%s,%s,'m48-review-reporter','The complaint requires a second look')""",(aid,rid))
    monkeypatch.setattr(api,"verify_authority",lambda token,*_:{
        "iss":"independent-test","jti":token,"sub":"reviewer-"+token,
        "appeal_id":str(aid),"decision":"upheld" if token=="worker-1" else "overturned"})
    def decide(token):
        try:
            api.decide_moderation_appeal(aid,api.ModerationAppealDecision(
                decision="upheld" if token=="worker-1" else "overturned"),token)
            return "success"
        except HTTPException as exc:
            return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(decide,("worker-1","worker-2")))
    assert sorted(map(str,results))==["409","success"]
    with psycopg.connect(dsn) as c:
        assert c.execute("""SELECT count(*) FROM bnb_moderation_appeal_decision_nonce
            WHERE appeal_id=%s""",(aid,)).fetchone()[0]==1
        assert c.execute("""SELECT state FROM bnb_moderation_appeal
            WHERE id=%s""",(aid,)).fetchone()[0] in ("upheld","overturned")
