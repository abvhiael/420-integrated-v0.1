import unittest
from datetime import datetime,timezone
from unittest.mock import patch
from types import SimpleNamespace
from doobr.auth import Denied,ALLOWED_ACTIONS
from doobr.console_cases import propose_case,approve_case,execute_case,close_case
T="00000000-0000-4000-8000-000000000101"
C="00000000-0000-4000-8000-000000000102"
E="00000000-0000-4000-8000-000000000103"
A="00000000-0000-4000-8000-000000000104"
B="00000000-0000-4000-8000-000000000105"
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
class Cursor:
 def __init__(self,results=()):self.rows=list(results);self.sql=[]
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def execute(self,sql,params=None):self.sql.append((sql,params))
 def fetchone(self):return self.rows.pop(0)
class DB:
 def __init__(self,results):self.cur=Cursor(results)
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def transaction(self):return self
 def cursor(self):return self.cur
class Authority:
 def __init__(self,approve=True,execute=True):self.approve,self.execute=approve,execute
 def verify_review(self,**kwargs):return self.approve
 def verify_executed(self,**kwargs):return self.execute
def sess(actor,subject,token):
 return SimpleNamespace(actor_id=actor,subject=subject,token_id=token,issuer="trusted")
class TestCaseLedger(unittest.TestCase):
 def test_roles_separated(self):
  self.assertIn("REVIEW_SAFETY",ALLOWED_ACTIONS["SAFETY"])
  self.assertIn("REVIEW_COMPLIANCE",ALLOWED_ACTIONS["COMPLIANCE"])
  self.assertNotIn("APPROVE_CASE",ALLOWED_ACTIONS["OPERATOR"])
  self.assertNotIn("TRANSITION_ORDER",ALLOWED_ACTIONS["COMPLIANCE"])
 def test_propose_durable(self):
  db=DB([])
  with patch("doobr.console_cases.authorize",return_value=sess(A,"one","jti1")) as auth:
   self.assertEqual(propose_case(connect=lambda:db,issuer=None,store=None,token="request",
    tenant_id=T,case_id=C,event_id=E,purpose="SAFETY_HOLD",proposal_ref="p1",
    evidence_ref="signed",at=NOW),"PENDING")
   self.assertEqual(auth.call_args.kwargs["permission"].action,"PROPOSE_CASE")
   self.assertTrue(any("INSERT INTO doobr_private.console_cases" in sql for sql,_ in db.cur.sql))
   self.assertTrue(any("console_case_events" in sql for sql,_ in db.cur.sql))
 def test_approval_role_and_separation(self):
  row=("SAFETY_HOLD",A,"one",bytes([0])*32,"signed","PENDING",1,NOW.replace(year=2027))
  db=DB([row,(2,)])
  with patch("doobr.console_cases.authorize",return_value=sess(B,"two","jti2")) as auth:
   self.assertEqual(approve_case(connect=lambda:db,issuer=None,store=None,token="second",tenant_id=T,
    case_id=C,event_id=E,expected_revision=1,authority=Authority(),at=NOW),"APPROVED")
   self.assertEqual(auth.call_args.kwargs["permission"].role,"SAFETY")
   self.assertTrue(any("FOR UPDATE" in sql for sql,_ in db.cur.sql))
 def test_approval_rejects_same_person_and_stale(self):
  base=("SAFETY_HOLD",A,"one",bytes([0])*32,"signed","PENDING",1,NOW.replace(year=2027))
  for row,actor in [(base,sess(A,"two","x")),(base,sess(B,"one","x")),(base[:5]+("APPROVED",1,base[7]),sess(B,"two","x")),(base[:7]+(NOW,),sess(B,"two","x"))]:
   db=DB([row])
   with patch("doobr.console_cases.authorize",return_value=actor):
    with self.assertRaises(Denied):approve_case(connect=lambda:db,issuer=None,store=None,
     token="second",tenant_id=T,case_id=C,event_id=E,expected_revision=1,authority=Authority(),at=NOW)
 def test_independent_authority_denied(self):
  row=("COMPLIANCE_REVIEW",A,"one",bytes([0])*32,"signed","PENDING",1,NOW.replace(year=2027))
  db=DB([row])
  with patch("doobr.console_cases.authorize",return_value=sess(B,"two","jti2")) as auth:
   with self.assertRaises(Denied):approve_case(connect=lambda:db,issuer=None,store=None,token="second",tenant_id=T,
    case_id=C,event_id=E,expected_revision=1,authority=Authority(False),at=NOW)
   self.assertEqual(auth.call_args.kwargs["permission"].role,"COMPLIANCE")
 def test_execution_requires_external_attestation(self):
  row=("SAFETY_HOLD","signed","APPROVED",2,NOW.replace(year=2027))
  with patch("doobr.console_cases.authorize",return_value=sess(A,"one","jti1")):
   with self.assertRaises(Denied):execute_case(connect=lambda:DB([row]),issuer=None,store=None,
    token="token",tenant_id=T,case_id=C,event_id=E,authority=Authority(execute=False),at=NOW)
   db=DB([row,(3,)])
   self.assertEqual(execute_case(connect=lambda:db,issuer=None,store=None,token="token",
    tenant_id=T,case_id=C,event_id=E,authority=Authority(),at=NOW),"EXECUTED")
 def test_reject_or_expire_with_audit(self):
  with patch("doobr.console_cases.authorize",return_value=sess(A,"one","jti1")):
   db=DB([("PENDING",1,NOW.replace(year=2027),"signed"),(2,)])
   self.assertEqual(close_case(connect=lambda:db,issuer=None,store=None,token="t",tenant_id=T,case_id=C,
    event_id=E,operation="REJECT",expected_revision=1,at=NOW),"REJECTED")
   self.assertTrue(any("console_case_events" in sql for sql,_ in db.cur.sql))
   with self.assertRaises(Denied):close_case(connect=lambda:DB([("EXECUTED",3,NOW,"signed")]),
    issuer=None,store=None,token="t",tenant_id=T,case_id=C,event_id=E,operation="EXPIRE",expected_revision=3,at=NOW)
 def test_no_replayed_execution(self):
  with patch("doobr.console_cases.authorize",return_value=sess(A,"one","jti1")):
   with self.assertRaises(Denied):execute_case(connect=lambda:DB([("SAFETY_HOLD","signed","EXECUTED",3,NOW.replace(year=2027))]),
    issuer=None,store=None,token="token",tenant_id=T,case_id=C,event_id=E,authority=Authority(),at=NOW)
if __name__=="__main__":unittest.main()
