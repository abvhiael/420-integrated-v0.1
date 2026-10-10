"""R02.3 transactional admission negative-path tests (fake DB locks/constraints)."""
import unittest
from datetime import datetime,timedelta,timezone
from uuid import UUID
from doobr.admission import admit_prepaid_order
from doobr.auth import Session,Denied
from doobr.retailer import RetailerClaim,PrepaidProof

N=datetime.now(timezone.utc)
T="00000000-0000-4000-8000-000000000301"
R="00000000-0000-4000-8000-000000000311"
O="00000000-0000-4000-8000-000000000341"
G="00000000-0000-4000-8000-000000000351"
A="00000000-0000-4000-8000-000000000321"
class Licensing:
    def verify_current(self,claim,at):return True
class Orders:
    def verify_prepaid(self,*,seller_ref,order_ref,at):
        return PrepaidProof(seller_ref,order_ref,"pay-1",100,"CAD",True,False,at)
class Cursor:
    def __init__(self):self.calls=[];self.pending=None;self.inserted=False;self.state="DRAFT"
    def __enter__(self):return self
    def __exit__(self,*x):return False
    def execute(self,sql,params):
        self.calls.append(sql)
        if "FROM doobr_private.delivery_orders" in sql:
            self.pending=(UUID(R),UUID(G),self.state,1,None)
        elif "FROM doobr_private.service_regions" in sql:self.pending=("Vancouver",)
        elif "FROM doobr_private.retailer_authorizations" in sql:
            self.pending=(UUID(A),"seller","licence","shop","regulator",bytes.fromhex("aa"*32),N-timedelta(days=1),N+timedelta(days=1),None)
        elif "INSERT INTO doobr_private.retailer_prepaid_evidence" in sql:
            if self.inserted:raise RuntimeError("unique violation")
            self.inserted=True
        elif "UPDATE doobr_private.delivery_orders" in sql:
            if self.state!="DRAFT":self.pending=None
            else:self.pending=(2,);self.state="ELIGIBILITY_PENDING"
        else:self.pending=None
    def fetchone(self):return self.pending
class Tx:
    def __init__(self,cur):self.cur=cur
    def __enter__(self):return self
    def __exit__(self,*x):return False
class Connection:
    def __init__(self,c):self.c=c
    def __enter__(self):return self
    def __exit__(self,*x):return False
    def transaction(self):return Tx(self.c)
    def cursor(self):return self.c
class Test(unittest.TestCase):
    def setUp(self):
        self.c=Cursor()
        self.claim=RetailerClaim(T,R,"seller","licence","Vancouver","shop",
            "sha256:proof","regulator",N-timedelta(days=1),N+timedelta(days=1),False)
        self.session=Session(T,R,"user","issuer","jti",N+timedelta(hours=1),False,None)
    def execute(self,**overrides):
        args=dict(connect=lambda:Connection(self.c),session=self.session,tenant_id=T,
                  order_id=O,retailer_id=R,region_id=G,municipality_ref="Vancouver",
                  claim=self.claim,retailer_order_ref="retailer-order-1",
                  amount_minor=100,currency="CAD",proof_digest=b"p"*32,
                  licence_digest=bytes.fromhex("aa"*32),
                  licensing=Licensing(),order_authority=Orders(),now=N)
        args.update(overrides)
        return admit_prepaid_order(**args)
    def test_complete_and_replay_denied(self):
        self.assertEqual(self.execute().revision,2)
        self.assertTrue(any("FOR UPDATE" in q for q in self.c.calls))
        with self.assertRaises(Denied):self.execute()
    def test_cross_tenant_session_or_id_invalid(self):
        for x in [dict(tenant_id="invalid"),dict(session=Session("foreign",R,"u","i","j",N+timedelta(hours=1),False,None)),
                  dict(retailer_id="00000000-0000-4000-8000-000000000399"),
                  dict(licence_digest=b"bad")]:
            with self.subTest(x=x),self.assertRaises(Denied):self.execute(**x)
    def test_unavailable_authority_rollback_boundary(self):
        class Offline:
            def verify_current(self,*x):raise ConnectionError("regulator outage")
        with self.assertRaises(Denied):self.execute(licensing=Offline())
        self.assertFalse(self.c.inserted)
        self.assertEqual(self.c.state,"DRAFT")
if __name__=="__main__":unittest.main()
