import unittest
from dataclasses import replace
from datetime import datetime,timedelta,timezone
from doobr.region_presence import Presence,RegionPolicy,project_region
from doobr.auth import Denied
NOW=datetime(2026,10,10,tzinfo=timezone.utc)
class Policy:
    outage=False
    approved=True
    def verify(self,*,tenant_id,region_id,at):
        if self.outage:raise ConnectionError("unavailable")
        return RegionPolicy(region_id,self.approved,"policy-v1",at+timedelta(minutes=1),3,5)
class Cases(unittest.TestCase):
    def setUp(self):
        self.authority=Policy()
        self.presence=[Presence("tenant",f"courier-{i}","region",2,NOW,True) for i in range(3)]
    def project(self,**kwargs):
        arguments=dict(tenant_id="tenant",region_id="region",region_code="coarse-vancouver",
                       presence=self.presence,policy_authority=self.authority,at=NOW)
        arguments.update(kwargs)
        return project_region(**arguments)
    def test_safe_public_projection(self):
        result=self.project()
        self.assertEqual(result.availability,"AVAILABLE")
        self.assertEqual(set(result.__dict__),{"region_code","availability","expires_at","policy_version"})
        self.assertNotIn("courier",str(result))
    def test_anonymity_floor_never_discloses_low_occupancy(self):
        for n in range(3):
            self.assertEqual(self.project(presence=self.presence[:n]).availability,"UNKNOWN")
    def test_stale_replayed_future_and_duplicates(self):
        stale=[replace(x,updated_at=NOW-timedelta(seconds=91)) for x in self.presence]
        self.assertEqual(self.project(presence=stale).availability,"UNKNOWN")
        for items in [[*self.presence,self.presence[0]],
                      [replace(x,tenant_id="foreign") for x in self.presence],
                      [replace(x,updated_at=NOW+timedelta(seconds=1)) for x in self.presence]]:
            with self.assertRaises(Denied):self.project(presence=items)
    def test_capacity_and_policy_denial(self):
        self.assertEqual(self.project(presence=[replace(x,capacity=0) for x in self.presence]).availability,"UNAVAILABLE")
        self.assertEqual(self.project(presence=[replace(x,capacity=1) for x in self.presence]).availability,"LIMITED")
        self.authority.outage=True
        with self.assertRaises(Denied):self.project()
        self.authority.outage=False;self.authority.approved=False
        with self.assertRaises(Denied):self.project()
    def test_invalid_ttl(self):
        with self.assertRaises(Denied):self.project(ttl_seconds=3600)
if __name__=="__main__":unittest.main()
