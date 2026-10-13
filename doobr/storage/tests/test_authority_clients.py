"""Authenticated service transport contract tests; fake transport is NOT provider acceptance."""
import io,json,unittest
from datetime import datetime,timezone,timedelta
from doobr.authority_clients import PinnedAuthorityTransport,RetailerLicenceService,CanonicalPrepaidService
from doobr.retailer import RetailerClaim
from doobr.auth import Denied
N=datetime(2026,10,10,tzinfo=timezone.utc)
class Response:
    status=200
    def __init__(self,payload):self.payload=json.dumps(payload).encode()
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,n):return self.payload[:n]
class Tests(unittest.TestCase):
    def transport(self,operation):
        def opener(req,timeout):
            body=json.loads(req.data)
            self.assertEqual(body["operation"],operation)
            self.assertEqual(req.get_header("Authorization"),"Bearer controlled-test-only")
            base={"issuer":"issuer-approved-by-operator","operation":operation,
                  "verified_at":N.isoformat()}
            if operation=="verify-retailer-licence-v1":
                base.update(approved=True,licence_id="L",legal_entity_ref="S",
                    municipality_ref="V",retail_site_ref="SHOP",
                    evidence_digest="digest",revoked=False,
                    expires_at=(N+timedelta(hours=1)).isoformat())
            else:
                base.update(seller_ref="S",retailer_order_ref="ORDER",canonical_payment_ref="PAY",
                    amount_minor=100,currency="CAD",settled=True,reversed=False)
            return Response(base)
        return PinnedAuthorityTransport(endpoint="https://approved.example/verify",
            credential="controlled-test-only",issuer="issuer-approved-by-operator",opener=opener)
    def test_endpoint_validation(self):
        for endpoint in ["http://approved.example/verify","https://user:password@approved.example/verify",
                         "https://approved.example/verify?redirect=true","https://approved.example/other"]:
            with self.assertRaises(ValueError):PinnedAuthorityTransport(endpoint=endpoint,credential="k",issuer="i")
    def test_retailer_scope(self):
        claim=RetailerClaim("tenant","retailer","S","L","V","SHOP","digest","issuer",
            N-timedelta(hours=1),N+timedelta(hours=1),False)
        self.assertTrue(RetailerLicenceService(self.transport("verify-retailer-licence-v1")).verify_current(claim,N))
        self.assertFalse(RetailerLicenceService(self.transport("verify-retailer-licence-v1")).verify_current(
            claim.__class__(**{**claim.__dict__,"licence_id":"wrong"}),N))
    def test_prepaid(self):
        p=CanonicalPrepaidService(self.transport("verify-prepaid-v1")).verify_prepaid(
            seller_ref="S",order_ref="ORDER",at=N)
        self.assertEqual((p.payment_ref,p.amount_minor,p.settled),("PAY",100,True))
    def test_offline_denies(self):
        def offline(req,timeout):raise ConnectionError("offline")
        transport=PinnedAuthorityTransport(endpoint="https://approved.example/verify",
            credential="k",issuer="issuer-approved-by-operator",opener=offline)
        with self.assertRaises(Denied):CanonicalPrepaidService(transport).verify_prepaid(
            seller_ref="S",order_ref="ORDER",at=N)
if __name__=="__main__":unittest.main()
