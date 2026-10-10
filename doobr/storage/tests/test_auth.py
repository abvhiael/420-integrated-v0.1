import importlib.util, unittest
from pathlib import Path
from dataclasses import replace
from datetime import datetime, timezone, timedelta
spec=importlib.util.spec_from_file_location("doobr_auth",Path(__file__).resolve().parents[2]/"auth.py")
a=importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name]=a
spec.loader.exec_module(a)
now=datetime(2026,10,10,tzinfo=timezone.utc)
class Issuer:
    def __init__(self): self.bad=False;self.revoked=False
    def verify(self, token, when):
        if self.bad: raise ConnectionError("identity unavailable")
        return a.VerifiedPrincipal("trusted","subject","doobr-api",token,now+timedelta(minutes=10))
    def is_revoked(self,issuer,jti): return self.revoked
class Store:
    def __init__(self):
        self.session=a.Session("tenant-a","actor-a","subject","trusted","jti",now+timedelta(minutes=10),False,now+timedelta(minutes=5))
        self.roles=[a.Grant("COURIER","job-a",now+timedelta(minutes=10),False)]
    def resolve(self, subject,token,tenant): return self.session
    def grants(self,tenant,actor): return self.roles
class Tests(unittest.TestCase):
    def setUp(self):
        self.i=Issuer();self.s=Store();self.p=a.Permission("COURIER","PICKUP","job-a",True)
    def call(self,**kw):
        return a.authorize(issuer=self.i,store=self.s,signed_token="jti",tenant_id=kw.get("tenant_id","tenant-a"),permission=kw.get("permission",self.p),now=now)
    def test_allow(self):self.assertEqual(self.call().actor_id,"actor-a")
    def test_fail_closed_variants(self):
        variants=[
         lambda:setattr(self.i,"bad",True),
         lambda:setattr(self.i,"revoked",True),
         lambda:setattr(self.s,"session",replace(self.s.session,revoked=True)),
         lambda:setattr(self.s,"session",replace(self.s.session,issuer="imposter")),
         lambda:setattr(self.s,"session",replace(self.s.session,expires_at=now)),
         lambda:setattr(self.s,"session",replace(self.s.session,wallet_consent_until=now)),
         lambda:setattr(self.s,"roles",[replace(self.s.roles[0],expires_at=now)]),
         lambda:setattr(self.s,"roles",[replace(self.s.roles[0],revoked=True)]),
         lambda:setattr(self.s,"roles",[replace(self.s.roles[0],resource="job-b")]),
         lambda:setattr(self.s,"roles",[replace(self.s.roles[0],role="OPERATOR")]),
        ]
        for mutate in variants:
            self.setUp();mutate()
            with self.assertRaises(a.Denied):self.call()
    def test_tenant_scope_and_action(self):
        with self.assertRaises(a.Denied):self.call(tenant_id="tenant-b")
        with self.assertRaises(a.Denied):self.call(permission=a.Permission("COURIER","","job-a"))
    def test_role_not_wallet_identity(self):
        self.s.roles=[]
        with self.assertRaises(a.Denied): self.call()
    def test_set_tenant_only_after_authorized_session(self):
        class Cursor:
            def execute(self,q,args):self.q=q;self.args=args
        c=Cursor(); a.set_tenant_context(c,session=self.call())
        self.assertEqual(c.args,("tenant-a",))
if __name__=="__main__":unittest.main()
