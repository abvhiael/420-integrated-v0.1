"""Focused R02.3 independent licensing and prepaid-proof adversarial tests."""
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from doobr.retailer import RetailerClaim, PrepaidProof, authorize_retail_order
from doobr.auth import Denied

NOW=datetime(2026,10,10,tzinfo=timezone.utc)
class Licensing:
    def __init__(self): self.ok=True; self.offline=False
    def verify_current(self,claim,at):
        if self.offline: raise ConnectionError()
        return self.ok
class Orders:
    def __init__(self): self.offline=False
    def verify_prepaid(self,*,seller_ref,order_ref,at):
        if self.offline: raise ConnectionError()
        return PrepaidProof(seller_ref,order_ref,"retailer-confirmed-payment",4200,"CAD",True,False,at)
class Cases(unittest.TestCase):
    def setUp(self):
        self.claim=RetailerClaim("tenant","retailer","seller-legal","bc-licence",
                                 "vancouver","retail-location","sha256:evidence",
                                 "approved-independent-regulator",NOW-timedelta(days=2),
                                 NOW+timedelta(days=2),False)
        self.licensing=Licensing();self.orders=Orders()
    def check(self,**changes):
        return authorize_retail_order(claim=changes.get("claim",self.claim),
            expected_tenant=changes.get("tenant","tenant"),
            expected_retailer=changes.get("retailer","retailer"),
            expected_municipality=changes.get("municipality","vancouver"),
            order_ref=changes.get("order_ref","order-123"),
            claimed_amount_minor=changes.get("amount",4200),
            claimed_currency=changes.get("currency","CAD"),
            licensing=self.licensing,order_authority=self.orders,now=NOW)
    def test_authorized_simulation(self):
        r=self.check()
        self.assertEqual((r.seller_ref,r.payment_ref),("seller-legal","retailer-confirmed-payment"))
    def test_independent_licence_fail_closed(self):
        for field,value in [("revoked",True),("valid_until",NOW),("valid_from",NOW+timedelta(seconds=1)),
                            ("tenant_id","foreign"),("retailer_id","other"),
                            ("municipality_ref","other"),("legal_entity_ref",""),
                            ("licence_id",""),("issued_by",""),("evidence_digest","")]:
            with self.subTest(field=field),self.assertRaises(Denied):
                self.check(claim=replace(self.claim,**{field:value}))
        self.licensing.ok=False
        with self.assertRaises(Denied):self.check()
        self.licensing.offline=True
        with self.assertRaises(Denied):self.check()
    def test_unavailable_prepaid_authority(self):
        self.orders.offline=True
        with self.assertRaises(Denied):self.check()
    def test_prepaid_mismatch_reversal_and_replay_context(self):
        base=self.orders.verify_prepaid(seller_ref="seller-legal",order_ref="order-123",at=NOW)
        for field,value in [("seller_ref","wrong"),("retailer_order_ref","other"),
                            ("payment_ref",""),("settled",False),("reversed",True),
                            ("amount_minor",1),("currency","USD"),("verified_at",NOW+timedelta(seconds=1))]:
            with self.subTest(field=field):
                self.orders.verify_prepaid=lambda **kwargs:replace(base,**{field:value})
                with self.assertRaises(Denied):self.check()
        with self.assertRaises(Denied):self.check(amount=-1)
    def test_issuer_errors_not_authority(self):
        self.orders.verify_prepaid=lambda **kwargs:None
        with self.assertRaises(Denied):self.check()
if __name__=="__main__":unittest.main()
