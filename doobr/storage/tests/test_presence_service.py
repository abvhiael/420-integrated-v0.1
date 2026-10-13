"""R02.5 trusted presence ingress/Travel adapter contract tests."""
import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Session, Grant, VerifiedPrincipal, Denied
from doobr.courier import CourierCredential
from doobr.presence_service import ingest_presence,read_travel_maps_region
from doobr.region_presence import Presence,RegionPolicy
N=datetime.now(timezone.utc)
T="00000000-0000-4000-8000-000000000901"
C="00000000-0000-4000-8000-000000000902"
R="00000000-0000-4000-8000-000000000903"
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("issuer","subject","doobr-api","jti",now+timedelta(minutes=3))
 def is_revoked(self,issuer,token):return False
class Store:
 def resolve(self,subject,token,tenant):return Session(T,C,subject,"issuer",token,N+timedelta(hours=1),False,None)
 def grants(self,tenant,actor):return [Grant("COURIER","courier:"+C,N+timedelta(minutes=3),False)]
class Credentials:
 def verify_current(self,claim,at):return True
class CourierPolicy:
 def required_credentials(self,*x):return frozenset({"IDENTITY","COURIER_AUTHORITY","TRAINING","VEHICLE"})
class RegionPolicy:
 def verify(self,*,tenant_id,region_id,at):
  return __import__("doobr.region_presence",fromlist=["RegionPolicy"]).RegionPolicy(region_id,True,"approved-version",at+timedelta(minutes=1),3,1)
class Cursor:
 rowcount=1
 def __enter__(self):return self
 def __exit__(self,*args):return False
 def execute(self,sql,params):
  if "FROM doobr_private.actors" in sql:self.result=("ACTIVE",)
  elif "FROM doobr_private.service_regions" in sql:self.result=(True,"CA","BC","Vancouver")
  else:self.result=None
 def fetchone(self):return self.result
class DB:
 def __init__(self):self.c=Cursor()
 def __enter__(self):return self
 def __exit__(self,*args):return False
 def transaction(self):return self
 def cursor(self):return self.c
class Tests(unittest.TestCase):
 def test_authentic_ingestion(self):
  creds=[CourierCredential(T,C,k,k,"DELIVERY_PERSON","issuer","digest",N-timedelta(days=1),N+timedelta(days=1),False,"vehicle" if k=="VEHICLE" else None) for k in ("IDENTITY","COURIER_AUTHORITY","TRAINING","VEHICLE")]
  args=dict(connect=DB,identity_issuer=Issuer(),session_store=Store(),signed_token="signed",
            tenant_id=T,courier_id=C,region_id=R,jurisdiction="CA-BC-Vancouver",
            carrier_class="DELIVERY_PERSON",vehicle_ref="vehicle",credentials=creds,
            credential_authority=Credentials(),courier_policy=CourierPolicy(),
            region_policy_authority=RegionPolicy(),capacity=2,latitude=49.3,longitude=-123.1,at=N)
  self.assertEqual(ingest_presence(**args),N)
  with self.assertRaises(Denied):ingest_presence(**{**args,"latitude":95})
  with self.assertRaises(Denied):ingest_presence(**{**args,"tenant_id":"foreign"})
  with self.assertRaises(Denied):ingest_presence(**{**args,"jurisdiction":"wrong"})
  class Revoked(Issuer):
   def is_revoked(self,*x):return True
  with self.assertRaises(Denied):ingest_presence(**{**args,"identity_issuer":Revoked()})
 def test_travel_maps_strict_schema(self):
  p=[Presence(T,"courier-"+str(i),R,1,N,True) for i in range(3)]
  result=read_travel_maps_region(load_region=lambda **kw:("coarse-zone",p),
     tenant_id=T,region_id=R,policy_authority=RegionPolicy(),at=N)
  self.assertEqual(result["schema"],"doobr-region/v1")
  self.assertEqual(result["availability"],"AVAILABLE")
  self.assertFalse(any(x in result for x in ("couriers","latitude","longitude","coordinates","capacity")))
if __name__=="__main__":unittest.main()
