import unittest
from unittest.mock import patch
from doobr.auth import Denied
from doobr.private_api import PrivateRequest,handle_private_request
from doobr.private_authority import UnconnectedCaseAuthority,VerifiedAuthorityAdapter
T="00000000-0000-4000-8000-000000000101"
C="00000000-0000-4000-8000-000000000102"
E="00000000-0000-4000-8000-000000000103"
def request(**extra):
 fields=dict(method="POST",path="/private/v1/cases/propose",bearer_token="signed",
             tenant_id=T,payload={"case_id":C,"event_id":E,"purpose":"SAFETY_HOLD",
                                  "proposal_ref":"ref","evidence_ref":"evidence"},
             origin_verified=True,csrf_verified=True,mfa_verified=True)
 fields.update(extra)
 return PrivateRequest(**fields)
def handle(r):
 return handle_private_request(request=r,connect=None,issuer=None,store=None,authority=UnconnectedCaseAuthority())
class Tests(unittest.TestCase):
 def test_authenticated_dispatch(self):
  with patch("doobr.private_api.propose_case",return_value="PENDING") as method:
   self.assertEqual(handle(request()),{"status":"PENDING"})
   self.assertEqual(method.call_args.kwargs["tenant_id"],T)
 def test_strict_private_ingress(self):
  for changes in ({"origin_verified":False},{"csrf_verified":False},{"mfa_verified":False},
                  {"method":"GET"},{"bearer_token":""},{"path":"/public"},
                  {"payload":{"case_id":C,"event_id":E,"payment_override":True}}):
   with self.assertRaises(Denied):handle(request(**changes))
 def test_default_authority_denial(self):
  with self.assertRaises(Denied):UnconnectedCaseAuthority().verify_review()
  with self.assertRaises(Denied):UnconnectedCaseAuthority().verify_executed()
 def test_verifier_requires_explicit_approval(self):
  adapter=VerifiedAuthorityAdapter(lambda **kwargs:False)
  with self.assertRaises(Denied):adapter.verify_executed(tenant_id=T,case_id=C,purpose="SAFETY_HOLD",evidence_ref="x",at=object())
  adapter=VerifiedAuthorityAdapter(lambda **kwargs:True)
  self.assertTrue(adapter.verify_review(tenant_id=T,case_id=C,purpose="SAFETY_HOLD",evidence_ref="x",at=object(),requester_id="a",approver_id="b"))
  with self.assertRaises(Denied):adapter.verify_review(tenant_id=T,case_id=C,purpose="SAFETY_HOLD",evidence_ref="x",at=object(),requester_id="a",approver_id="a")
if __name__=="__main__":unittest.main()
