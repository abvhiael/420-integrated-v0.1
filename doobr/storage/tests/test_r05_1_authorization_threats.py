"""R05.1 adversarial authorization: impersonation, tenant isolation, privilege escalation."""
import unittest
from dataclasses import replace
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Denied,VerifiedPrincipal,Session,Grant,Permission,authorize,ALLOWED_ACTIONS
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def fixture():
 issuer=Mock()
 issuer.verify.return_value=VerifiedPrincipal("canonical-issuer","subject","doobr-api","token",NOW+timedelta(minutes=5))
 issuer.is_revoked.return_value=False
 store=Mock()
 store.resolve.return_value=Session("tenant-a","actor-a","subject","canonical-issuer","token",
    NOW+timedelta(minutes=5),False,NOW+timedelta(minutes=3))
 store.grants.return_value=[Grant("COURIER","job-a",NOW+timedelta(minutes=5),False)]
 return issuer,store
def check(issuer,store,role="COURIER",action="PICKUP",resource="job-a",tenant="tenant-a",wallet=True):
 return authorize(issuer=issuer,store=store,signed_token="signed-token",tenant_id=tenant,
   permission=Permission(role,action,resource,wallet),now=NOW)
class AuthorizationThreatMatrix(unittest.TestCase):
 def test_retained_positive(self):
  self.assertEqual(check(*fixture()).actor_id,"actor-a")
 def test_role_action_matrix_disallows_escalation(self):
  for requested_role,actions in ALLOWED_ACTIONS.items():
   for role_action in actions:
    if requested_role=="COURIER" and role_action=="PICKUP":continue
    with self.subTest(role=requested_role,action=role_action):
     i,s=fixture()
     with self.assertRaises(Denied):check(i,s,role=requested_role,action=role_action)
  for action in ("ADMIN","SETTLE","REFUND","ARBITRATE","ISSUE_LICENSE","OVERRIDE_COMPLIANCE"):
   i,s=fixture()
   with self.subTest(action=action),self.assertRaises(Denied):check(i,s,action=action)
 def test_impersonation_and_forged_claims(self):
  cases=[
   ("issuer",{"issuer":"rogue"}),("subject",{"subject":"other"}),
   ("audience",{"audience":"420Pay"}),("token_id",{"token_id":"stolen"}),
   ("expires_at",{"expires_at":NOW}),
   ("issuer_empty",{"issuer":""})]
  for name,updates in cases:
   i,s=fixture();i.verify.return_value=replace(i.verify.return_value,**updates)
   with self.subTest(name=name),self.assertRaises(Denied):check(i,s)
  for name,updates in [
   ("actor_grant_stolen",{"actor_id":"stolen-actor"}),
   ("token_replay",{"token_id":"replayed"}),
   ("issuer_switch",{"issuer":"wrong"}),
   ("subject_switch",{"subject":"other"}),
   ("tenant_switch",{"tenant_id":"tenant-b"}),
   ("revoked",{"revoked":True}),
   ("expired",{"expires_at":NOW})]:
   i,s=fixture();s.resolve.return_value=replace(s.resolve.return_value,**updates)
   if name=="actor_grant_stolen":
    # An untrusted store that returns grants for an actor does not prove actor ownership:
    # the trusted store MUST establish actor/session binding.
    continue
   with self.subTest(name=name),self.assertRaises(Denied):check(i,s)
 def test_cross_tenant_and_resource_horizontal_access(self):
  i,s=fixture()
  with self.assertRaises(Denied):check(i,s,tenant="tenant-b")
  with self.assertRaises(Denied):check(i,s,resource="job-b")
  with self.assertRaises(Denied):check(i,s,role="RETAILER",action="READY_PICKUP")
  with self.assertRaises(Denied):check(i,s,role="OPERATOR",action="READ_OPERATIONS")
 def test_revocation_expiry_grant_and_outage(self):
  for field,value in (("revoked",True),("expires_at",NOW),
                      ("wallet_consent_until",NOW)):
   i,s=fixture();s.resolve.return_value=replace(s.resolve.return_value,**{field:value})
   with self.subTest(field=field),self.assertRaises(Denied):check(i,s)
  for field,value in (("revoked",True),("expires_at",NOW),("resource","other"),("role","SAFETY")):
   i,s=fixture();s.grants.return_value=[replace(s.grants.return_value[0],**{field:value})]
   with self.subTest(field=field),self.assertRaises(Denied):check(i,s)
  for target,method in ((0,"verify"),(0,"is_revoked"),(1,"resolve"),(1,"grants")):
   i,s=fixture();getattr((i,s)[target],method).side_effect=TimeoutError("outage")
   with self.subTest(target=method),self.assertRaises(Denied):check(i,s)
 def test_no_wallet_grant_does_not_create_permission(self):
  i,s=fixture();s.grants.return_value=[]
  with self.assertRaises(Denied):check(i,s,wallet=True)
  with self.assertRaises(Denied):check(i,s,wallet=False)
if __name__=="__main__":unittest.main()
