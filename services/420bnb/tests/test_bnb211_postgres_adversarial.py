"""BNB-2.11 real PostgreSQL adversarial authorization and concurrency acceptance."""
import importlib.util
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

spec=importlib.util.spec_from_file_location("bnb211_race_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.fixture
def records(monkeypatch):
    if not os.environ.get("BNB_DATABASE_URL"):pytest.skip("requires PostgreSQL")
    first,second=uuid4(),uuid4()
    hold,reservation,review,response,abuse=uuid4(),uuid4(),uuid4(),uuid4(),uuid4()
    subject="bnb211-"+uuid4().hex
    host_a="host-a-"+uuid4().hex
    host_b="host-b-"+uuid4().hex
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES (%s)",(subject,))
        for pid,host in ((first,host_a),(second,host_b)):
            c.execute("""INSERT INTO bnb_property
                (id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
                VALUES (%s,%s,'Adversarial fixture','Public area','published',1,100,'CAD')""",(pid,host))
        end=datetime.now(timezone.utc)-timedelta(days=1)
        start=end-timedelta(days=2)
        c.execute("""INSERT INTO bnb_hold(id,property_id,guest_subject,period,status,
            expires_at,quote_total_minor,policy_snapshot)
            VALUES (%s,%s,%s,tstzrange(%s,%s,'[)'),'confirmed',now(),100,'fixture')""",
            (hold,first,subject,start,end))
        c.execute("""INSERT INTO bnb_reservation
            (id,hold_id,property_id,guest_subject,status)
            VALUES (%s,%s,%s,%s,'confirmed')""",(reservation,hold,first,subject))
        c.execute("""INSERT INTO bnb_guest_review
            (id,reservation_id,property_id,guest_subject,rating,body,status)
            VALUES (%s,%s,%s,%s,5,'Verified completed stay','approved')""",
            (review,reservation,first,subject))
        c.execute("""INSERT INTO bnb_review_host_response
            (review_id,property_id,host_subject,body)
            VALUES (%s,%s,%s,'Host response awaiting moderation')""",
            (review,first,host_a))
        c.execute("""INSERT INTO bnb_abuse_report
            (id,reporter_subject,property_id,target_type,target_id,reason,detail)
            VALUES (%s,%s,%s,'host_response',%s,'harassment','fixture')""",
            (abuse,subject,first,review))
    monkeypatch.setattr(api,"verify_authority",lambda token,prefix,purpose:{
        "iss":"https://independent-reviewer.example","sub":"reviewer",
        "jti":token,"purpose":purpose,
        "review_id":str(review),"report_id":str(abuse),
        "property_id":str(first),"decision":"approved" if purpose=="host-review-response" else "accepted",
        "revision":int(token.split("-")[-1]) if token.startswith("rev-") else 1,
        "external_reference":"external-reference-1",
        })
    yield {"first":first,"second":second,"hold":hold,"reservation":reservation,
           "review":review,"abuse":abuse,"guest":subject,"host_a":host_a,"host_b":host_b}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("DELETE FROM bnb_review_moderation_nonce WHERE target_id IN (%s,%s)",(review,abuse))
        c.execute("DELETE FROM bnb_reputation_export WHERE review_id=%s",(review,))
        c.execute("DELETE FROM bnb_moderation_appeal_decision_nonce WHERE appeal_id IN (SELECT id FROM bnb_moderation_appeal WHERE report_id=%s)",(abuse,))
        c.execute("DELETE FROM bnb_moderation_appeal WHERE report_id=%s",(abuse,))
        c.execute("DELETE FROM bnb_privacy_retention_hold WHERE report_id=%s",(abuse,))
        c.execute("DELETE FROM bnb_abuse_report WHERE id=%s",(abuse,))
        c.execute("DELETE FROM bnb_review_host_response WHERE review_id=%s",(review,))
        c.execute("DELETE FROM bnb_guest_review WHERE id=%s",(review,))
        c.execute("DELETE FROM bnb_reservation WHERE id=%s",(reservation,))
        c.execute("DELETE FROM bnb_hold WHERE id=%s",(hold,))
        c.execute("DELETE FROM bnb_property WHERE id IN (%s,%s)",(first,second))
        c.execute("DELETE FROM bnb_account WHERE subject=%s",(subject,))

def test_simultaneous_host_response_moderation_one_wins(records):
    path=f"/v1/bnb/internal/host-responses/{records['review']}/decision"
    def submit(i):
        return client.post(path,headers={"x-guest-review-proof":f"moderation-{i}"},json={"decision":"approved"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(submit,range(2)))
    assert sorted(r.status_code for r in outcomes)==[200,409],[(r.status_code,r.text) for r in outcomes]
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT status FROM bnb_review_host_response WHERE review_id=%s",(records["review"],)).fetchone()[0]=="approved"
        assert c.execute("SELECT count(*) FROM bnb_review_moderation_nonce WHERE target_id=%s",(records["review"],)).fetchone()[0]==1

def test_simultaneous_abuse_decisions_one_wins(records):
    # Abuse withdrawal applies to content already approved for publication.
    # A pending response must never be falsely represented as published.
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_review_host_response SET status='approved' WHERE review_id=%s",
                  (records["review"],))
    path=f"/v1/bnb/internal/abuse-reports/{records['abuse']}/decision"
    def submit(i):
        return client.post(path,headers={"x-guest-review-proof":f"abuse-{i}"},json={"decision":"accepted"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(submit,range(2)))
    assert sorted(r.status_code for r in outcomes)==[200,409],[(r.status_code,r.text) for r in outcomes]
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT status FROM bnb_review_host_response WHERE review_id=%s",(records["review"],)).fetchone()[0]=="withdrawn"
        assert c.execute("SELECT count(*) FROM bnb_review_moderation_nonce WHERE target_id=%s",(records["abuse"],)).fetchone()[0]==1

def test_cross_property_host_cannot_reply(records,monkeypatch):
    monkeypatch.setattr(api,"active_subject",lambda _:records["host_b"])
    result=client.post(f"/v1/bnb/reviews/{records['review']}/host-response",
       json={"body":"Wrong property host"},headers={"authorization":"Bearer verified"})
    assert result.status_code==404,result.text
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT count(*) FROM bnb_review_host_response WHERE review_id=%s",(records["review"],)).fetchone()[0]==1

def test_reputation_withdrawn_state_and_receipt_replay(records):
    url=f"/v1/bnb/internal/reputation/verified-reviews/{records['first']}"
    result=client.get(url,headers={"x-reputation-proof":"read-1"})
    assert result.status_code==200,result.text
    assert any(r["id"]==str(records["review"]) and r["rating"]==5 for r in result.json()["reviews"])
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_guest_review SET status='withdrawn' WHERE id=%s",(records["review"],))
    result=client.get(url,headers={"x-reputation-proof":"read-2"})
    assert result.status_code==200,result.text
    assert any(r["id"]==str(records["review"]) and r["state"]=="withdrawn" and r["rating"] is None for r in result.json()["reviews"])
    receipt="/v1/bnb/internal/reputation/export-receipt"
    def send(revision,token):
        return client.post(receipt,headers={"x-reputation-proof":token},
            json={"review_id":str(records["review"]),"revision":revision,
                  "external_reference":"external-reference-1"})
    assert send(1,"rev-1").status_code==200
    assert send(1,"rev-1").status_code==409
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(lambda i:send(2,f"rev-{2}"),range(2)))
    assert sorted(r.status_code for r in outcomes)==[200,409],[(r.status_code,r.text) for r in outcomes]
    assert send(1,"rev-1").status_code==409
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT last_revision FROM bnb_reputation_export WHERE review_id=%s",(records["review"],)).fetchone()[0]==2


def test_bnb39_appeal_replay_independent_decision_and_retention_hold(records,monkeypatch):
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_abuse_report SET status='accepted',decided_by='original-moderator' WHERE id=%s",
                  (records["abuse"],))
    monkeypatch.setattr(api,"active_subject",lambda token:records["guest"])
    route=f"/v1/bnb/abuse-reports/{records['abuse']}/appeals"
    initial=client.post(route,headers={"authorization":"Bearer test-fixture"},
                        json={"grounds":"I request independent review of this decision."})
    assert initial.status_code==201,initial.text
    appeal_id=initial.json()["id"]
    repeat=client.post(route,headers={"authorization":"Bearer test-fixture"},
                        json={"grounds":"I request independent review of this decision."})
    assert repeat.status_code==201 and repeat.json()["replayed"] is True
    changed=client.post(route,headers={"authorization":"Bearer test-fixture"},
                        json={"grounds":"Different allegations, same appeal identifier."})
    assert changed.status_code==409
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        assert c.execute("SELECT reason_code FROM bnb_privacy_retention_hold WHERE report_id=%s",
                         (records["abuse"],)).fetchone()[0]=="appeal"
    decision=f"/v1/bnb/internal/appeals/{appeal_id}/decision"
    monkeypatch.setattr(api,"verify_authority",lambda token,prefix,purpose:{
        "iss":"https://reviewer.example","sub":records["guest"] if token=="self" else
        ("original-moderator" if token=="original" else "independent-reviewer"),
        "jti":token,"appeal_id":appeal_id,"decision":"upheld"})
    rejected=client.post(decision,json={"decision":"upheld"},
                         headers={"x-guest-review-proof":"self"})
    assert rejected.status_code==403
    original=client.post(decision,json={"decision":"upheld"},
                         headers={"x-guest-review-proof":"original"})
    assert original.status_code==403
    resolved=client.post(decision,json={"decision":"upheld"},
                         headers={"x-guest-review-proof":"independent"})
    assert resolved.status_code==200,resolved.text
    assert resolved.json()["content_republished"] is False
    replay=client.post(decision,json={"decision":"upheld"},
                       headers={"x-guest-review-proof":"independent"})
    assert replay.status_code==409
    monkeypatch.setattr(api,"verify_authority",lambda token,prefix,purpose:{
        "iss":"https://reviewer.example","sub":"independent-reviewer",
        "jti":"retention-fixture","report_id":str(records["abuse"]),"operation":"redact"})
    redact=client.post(f"/v1/bnb/internal/abuse-reports/{records['abuse']}/redact",
                       headers={"x-guest-review-proof":"retention"})
    assert redact.status_code==409
    assert redact.json()["detail"]=="RETENTION_NOT_EXPIRED"
