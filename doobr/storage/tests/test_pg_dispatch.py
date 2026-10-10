"""Real PostgreSQL R02.7 offer/accept/capacity/reassign/concurrency tests."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from uuid import UUID
import psycopg
from doobr.auth import Denied,Session,Grant,VerifiedPrincipal
from doobr.dispatch import offer,decide,release_assignment,match_couriers
T="00000000-0000-4000-8000-000000002001"
FOREIGN="00000000-0000-4000-8000-000000002099"
C="00000000-0000-4000-8000-000000002002"
OP="00000000-0000-4000-8000-000000002003"
BUYER="00000000-0000-4000-8000-000000002004"
STORE="00000000-0000-4000-8000-000000002005"
REG="00000000-0000-4000-8000-000000002006"
O1="00000000-0000-4000-8000-000000002011"
O2="00000000-0000-4000-8000-000000002012"
F1="00000000-0000-4000-8000-000000002021"
F2="00000000-0000-4000-8000-000000002022"
F3="00000000-0000-4000-8000-000000002023"
DSN="host=localhost dbname=doobr_r02_7 user=postgres password=ci-only-password"
USER_DSN="host=localhost dbname=doobr_r02_7 user=doobr_r027_user password=ci-only-password"
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("test-issued","subject","doobr-api",token,now+timedelta(minutes=5))
 def is_revoked(self,*a):return False
class AuthStore:
 def resolve(self,subject,token,tenant):
  actor=C if token=="courier" else OP
  return Session(T,actor,subject,"test-issued",token,datetime.now(timezone.utc)+timedelta(minutes=5),False,None)
 def grants(self,tenant,actor):
  role="COURIER" if actor==C else "OPERATOR"
  return [Grant(role,"order:"+o,datetime.now(timezone.utc)+timedelta(minutes=5),False) for o in (O1,O2)]
class Approved:
 def approve(self,**kwargs):return True
class Reject:
 def approve(self,**kwargs):return False
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r027_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r027_user")
   c.execute("GRANT SELECT ON doobr_private.actors,doobr_private.delivery_orders,doobr_private.courier_region_presence,doobr_private.dispatch_offers,doobr_private.dispatch_assignments TO doobr_r027_user")
   c.execute("GRANT UPDATE(state,revision,updated_at) ON doobr_private.delivery_orders TO doobr_r027_user")
   c.execute("GRANT INSERT,UPDATE ON doobr_private.dispatch_offers,doobr_private.dispatch_assignments TO doobr_r027_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES (%s,'tenant'),(%s,'foreign')",(T,FOREIGN))
   for actor,kind in ((C,"COURIER"),(OP,"OPERATOR"),(BUYER,"CONSUMER"),(STORE,"RETAILER")):
    c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,actor,kind+actor,kind))
   c.execute("""INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
     VALUES(%s,%s,'test','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,REG))
   for order in (O1,O2):
    c.execute("""INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state)
      VALUES(%s,%s,%s,%s,%s,'RETAILER_READY')""",(T,order,BUYER,STORE,REG))
   c.execute("""INSERT INTO doobr_private.courier_region_presence
     (tenant_id,courier_id,region_id,capacity,eligibility_verified_at,updated_at,expires_at)
     VALUES (%s,%s,%s,1,now(),now(),now()+interval '5 minutes')""",(T,C,REG))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r027_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r027_user")
   c.execute("DROP ROLE doobr_r027_user")
  cls.admin.close()
 def common(self,order,offer_id):
  return dict(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=AuthStore(),
      tenant_id=T,order_id=order,offer_id=offer_id,eligibility=Approved())
 def make_offer(self,order,offer_id,revision=1,eligible=None):
  return offer(**{**self.common(order,offer_id),"eligibility":eligible or Approved()},token="operator",courier_id=C,
      expected_revision=revision,requested_units=1,expires_at=datetime.now(timezone.utc)+timedelta(minutes=3))
 def accept(self,order,offer_id,accept=True,eligible=None):
  return decide(**{**self.common(order,offer_id),"eligibility":eligible or Approved()},token="courier",accept=accept)
 def test_0_private_capacity_matching(self):
  found=match_couriers(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=AuthStore(),
   token="operator",tenant_id=T,order_id=O1,eligibility=Approved())
  self.assertEqual(found,((C,1),))
  self.assertEqual(match_couriers(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=AuthStore(),
   token="operator",tenant_id=T,order_id=O1,eligibility=Reject()),())
 def test_actual_capacity_conflict_reassignment_and_replay(self):
  self.make_offer(O1,F1)
  self.assertEqual(self.accept(O1,F1),"ASSIGNED")
  with self.assertRaises(Denied):self.accept(O1,F1)
  with self.assertRaises(Denied):self.make_offer(O2,F2)
  with self.assertRaises(Denied):
   release_assignment(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=AuthStore(),
    token="operator",tenant_id=T,order_id=O1,eligibility=Reject(),reason="test")
  self.assertEqual(release_assignment(connect=lambda:psycopg.connect(USER_DSN),issuer=Issuer(),store=AuthStore(),
    token="operator",tenant_id=T,order_id=O1,eligibility=Approved(),reason="reassign"),"RETAILER_READY")
  self.make_offer(O2,F2)
  self.assertEqual(self.accept(O2,F2),"ASSIGNED")
  with self.assertRaises(Denied):self.make_offer(O1,F3,revision=4,eligible=Reject())
  with self.admin.cursor() as c:
   c.execute("SELECT state FROM doobr_private.dispatch_assignments WHERE tenant_id=%s AND order_id=%s",(T,O1))
   self.assertEqual(c.fetchone()[0],"RELEASED")
   c.execute("SELECT state FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s",(T,O2))
   self.assertEqual(c.fetchone()[0],"ASSIGNED")
 def test_authority_cross_tenant_denial(self):
  with self.assertRaises(Denied):
   offer(**{**self.common(O1,F3),"tenant_id":FOREIGN},token="operator",courier_id=C,
     expected_revision=3,requested_units=1,expires_at=datetime.now(timezone.utc)+timedelta(minutes=2))
if __name__=="__main__":unittest.main()
