import unittest
from datetime import datetime,timedelta,timezone
import psycopg
from doobr.auth import Denied,Session,Grant,VerifiedPrincipal
from doobr.tracking import permission_change,record_location
T="00000000-0000-4000-8000-000000003001"
C="00000000-0000-4000-8000-000000003002"
B="00000000-0000-4000-8000-000000003003"
RETAIL="00000000-0000-4000-8000-000000003004"
REG="00000000-0000-4000-8000-000000003005"
O="00000000-0000-4000-8000-000000003006"
F="00000000-0000-4000-8000-000000003007"
P="00000000-0000-4000-8000-000000003008"
DSN="host=localhost dbname=doobr_r02_8 user=postgres password=ci-only-password"
USER_DSN="host=localhost dbname=doobr_r02_8 user=doobr_r028_user password=ci-only-password"
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("issuer","subject","doobr-api","signed",now+timedelta(minutes=5))
 def is_revoked(self,*a):return False
class Store:
 def resolve(self,subject,token,tenant):return Session(T,C,subject,"issuer","signed",datetime.now(timezone.utc)+timedelta(minutes=5),False,None)
 def grants(self,tenant,actor):return [Grant("COURIER","order:"+O,datetime.now(timezone.utc)+timedelta(minutes=5),False)]
class Authority:
 def approve(self,**k):return True
class Reject:
 def approve(self,**k):return False
class TestTrackingPostgres(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r028_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r028_user")
   c.execute("GRANT SELECT ON doobr_private.delivery_orders,doobr_private.dispatch_assignments,doobr_private.location_permissions,doobr_private.location_samples TO doobr_r028_user")
   c.execute("GRANT INSERT, UPDATE ON doobr_private.location_permissions TO doobr_r028_user")
   c.execute("GRANT INSERT ON doobr_private.location_samples TO doobr_r028_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES(%s,'test')",(T,))
   for ident,kind in ((C,"COURIER"),(B,"CONSUMER"),(RETAIL,"RETAILER")):
    c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,ident,kind+ident,kind))
   c.execute("""INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
      VALUES(%s,%s,'test','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,REG))
   c.execute("INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state) VALUES(%s,%s,%s,%s,%s,'ASSIGNED')",(T,O,B,RETAIL,REG))
   c.execute("""INSERT INTO doobr_private.dispatch_offers
       (tenant_id,offer_id,order_id,courier_id,region_id,requested_units,offered_at,expires_at,state)
       VALUES(%s,%s,%s,%s,%s,1,now(),now()+interval '1 hour','ACCEPTED')""",(T,F,O,C,REG))
   c.execute("""INSERT INTO doobr_private.dispatch_assignments
       (tenant_id,order_id,courier_id,offer_id,reserved_units,state)
       VALUES(%s,%s,%s,%s,1,'ACTIVE')""",(T,O,C,F))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r028_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r028_user")
   c.execute("DROP ROLE doobr_r028_user")
  cls.admin.close()
 def shared(self):
  return dict(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=Store(),token="token",
   tenant_id=T,order_id=O,permission_id=P)
 def sample(self,seq,observed,**override):
  args=self.shared()|dict(sequence=seq,observed_at=observed,latitude=49.3,longitude=-122.7,
   encrypt=lambda **kw:(b'x'*48,'key-v1'),geofence=Authority(),at=datetime.now(timezone.utc))
  return record_location(**(args|override))
 def test_grant_sample_revoke_replay_and_no_resurrection(self):
  now=datetime.now(timezone.utc)
  self.assertEqual(permission_change(**self.shared(),grant=True,authority=Authority(),
      expires_at=now+timedelta(minutes=5),at=now),"GRANTED")
  with self.assertRaises(Denied):
   permission_change(**self.shared(),grant=True,authority=Authority(),
      expires_at=now+timedelta(minutes=5),at=now)
  self.assertEqual(self.sample(1,now)["sequence"],1)
  with self.assertRaises(Denied):self.sample(1,now)
  with self.assertRaises(Denied):self.sample(2,now,geofence=Reject())
  with self.assertRaises(Denied):self.sample(2,now,encrypt=lambda **k:(b'plaintext',''))
  self.assertEqual(self.sample(2,now+timedelta(microseconds=1),at=now+timedelta(seconds=1))["sequence"],2)
  self.assertEqual(permission_change(**self.shared(),grant=False,authority=Authority(),at=now+timedelta(seconds=1)),"REVOKED")
  with self.assertRaises(Denied):self.sample(3,now+timedelta(seconds=2),at=now+timedelta(seconds=2))
  with self.assertRaises(Denied):
   permission_change(**self.shared(),grant=True,authority=Authority(),expires_at=now+timedelta(minutes=5),at=now+timedelta(seconds=2))
  with self.admin.cursor() as c:
   c.execute("SELECT count(*) FROM doobr_private.location_samples WHERE tenant_id=%s AND order_id=%s",(T,O))
   self.assertEqual(c.fetchone()[0],2)
   c.execute("SELECT state,last_sequence FROM doobr_private.location_permissions WHERE tenant_id=%s AND order_id=%s",(T,O))
   self.assertEqual(c.fetchone(),("REVOKED",2))
if __name__=="__main__":unittest.main()
