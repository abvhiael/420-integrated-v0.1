import unittest
from unittest.mock import patch
from datetime import datetime,timezone
from types import SimpleNamespace
from doobr.private_console import review_dual_control
from doobr.auth import Denied
T="00000000-0000-4000-8000-000000000101"
CASE="00000000-0000-4000-8000-000000000102"
A="00000000-0000-4000-8000-000000000103"
B="00000000-0000-4000-8000-000000000104"
NOW=datetime(2026,10,11,tzinfo=timezone.utc)
def principal(actor,subject,token):return SimpleNamespace(actor_id=actor,subject=subject,token_id=token)
class Authority:
 def __init__(self,allowed=True):self.allowed=allowed;self.calls=[]
 def verify_review(self,**kwargs):self.calls.append(kwargs);return self.allowed
def evaluate(first=None,second=None,authority=None,purpose="SAFETY_HOLD",req="token1",app="token2"):
 issuer=object();store=object();authority=authority or Authority()
 with patch("doobr.private_console.authorize",side_effect=[first or principal(A,"one","jti1"),second or principal(B,"two","jti2")]) as auth:
  result=review_dual_control(issuer=issuer,store=store,requester_token=req,approver_token=app,
   tenant_id=T,case_id=CASE,purpose=purpose,evidence_ref="signed-case",authority=authority,at=NOW)
  assert auth.call_count==2
  assert all(c.kwargs["permission"].resource=="incident:"+CASE for c in auth.call_args_list)
  return result,authority
class TestPrivateConsole(unittest.TestCase):
 def test_two_authorized_independent_people(self):
  result,authority=evaluate()
  self.assertEqual((result.requester_id,result.approver_id),(A,B))
  self.assertEqual(authority.calls[0]["purpose"],"SAFETY_HOLD")
 def test_same_actor_denied(self):
  for p in [principal(A,"two","jti2"),principal(B,"one","jti2"),principal(B,"two","jti1")]:
   with self.assertRaises(Denied):evaluate(second=p)
 def test_denied_external_authority(self):
  with self.assertRaises(Denied):evaluate(authority=Authority(False))
 def test_revocation_denied(self):
  with patch("doobr.private_console.authorize",side_effect=Denied("revoked")):
   with self.assertRaises(Denied):review_dual_control(issuer=None,store=None,requester_token="1",approver_token="2",tenant_id=T,case_id=CASE,purpose="SAFETY_HOLD",evidence_ref="signed",authority=Authority(),at=NOW)
 def test_bad_action_and_same_token_denied(self):
  for purpose,req,app in [("DISPATCH_OVERRIDE","a","b"),("SAFETY_HOLD","a","a")]:
   with self.assertRaises(Denied):evaluate(purpose=purpose,req=req,app=app)
 def test_unavailable_authority_denied(self):
  class Broken:
   def verify_review(self,**kwargs):raise RuntimeError("offline")
  with self.assertRaises(Denied):evaluate(authority=Broken())
if __name__=="__main__":unittest.main()
