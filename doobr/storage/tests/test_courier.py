import unittest
from dataclasses import replace
from datetime import datetime,timedelta,timezone
from doobr.courier import CourierCredential,verify_courier
from doobr.auth import Denied
NOW=datetime(2026,10,10,tzinfo=timezone.utc)
class Issuer:
    fail=False
    def verify_current(self,c,at):
        if self.fail: raise ConnectionError("issuer unavailable")
        return True
class Policy:
    fail=False
    def required_credentials(self,carrier_class,jurisdiction,at):
        if self.fail:raise ConnectionError("policy unavailable")
        return frozenset({"IDENTITY","COURIER_AUTHORITY","TRAINING","VEHICLE"})
class Tests(unittest.TestCase):
    def setUp(self):
        self.issuer=Issuer();self.policy=Policy()
        self.items=[CourierCredential("tenant","courier",kind.lower(),kind,"DELIVERY_PERSON",
                     "independent-issuer","digest",NOW-timedelta(days=1),NOW+timedelta(days=1),
                     False,"vehicle" if kind=="VEHICLE" else None)
                    for kind in ("IDENTITY","COURIER_AUTHORITY","TRAINING","VEHICLE")]
    def check(self,**overrides):
        args=dict(tenant_id="tenant",courier_id="courier",carrier_class="DELIVERY_PERSON",
                  jurisdiction="CA-BC-VANCOUVER",vehicle_ref="vehicle",
                  credentials=self.items,authority=self.issuer,policy=self.policy,at=NOW)
        args.update(overrides);return verify_courier(**args)
    def test_authoritative_allow(self):
        self.assertEqual(len(self.check().credential_ids),4)
    def test_missing_and_invalid_evidence(self):
        with self.assertRaises(Denied):self.check(credentials=self.items[:-1])
        for field,value in [("revoked",True),("valid_until",NOW),("valid_from",NOW+timedelta(seconds=1)),
                            ("tenant_id","other"),("courier_id","other"),("carrier_class","COMMON_CARRIER"),
                            ("issuer",""),("evidence_ref",""),("vehicle_ref","wrong")]:
            with self.subTest(field=field),self.assertRaises(Denied):
                self.check(credentials=[*self.items[:-1],replace(self.items[-1],**{field:value})])
        with self.assertRaises(Denied):self.check(credentials=[*self.items,self.items[0]])
        with self.assertRaises(Denied):self.check(carrier_class="NOT_APPROVED")
    def test_issuer_and_policy_outage_fail_closed(self):
        self.issuer.fail=True
        with self.assertRaises(Denied):self.check()
        self.issuer.fail=False;self.policy.fail=True
        with self.assertRaises(Denied):self.check()
    def test_vehicle_binding_and_absent_vehicle(self):
        with self.assertRaises(Denied):self.check(vehicle_ref=None)
        with self.assertRaises(Denied):self.check(vehicle_ref="other")
if __name__=="__main__":unittest.main()
