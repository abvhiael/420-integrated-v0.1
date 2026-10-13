import unittest
from datetime import datetime,timedelta,timezone
import psycopg
from doobr.auth import Denied,Session,Grant,VerifiedPrincipal
from doobr.returns import transition_return
T="00000000-0000-4000-8000-000000005001"
C="00000000-0000-4000-8000-000000005002"
OP="00000000-0000-4000-8000-000000005003"
B="00000000-0000-4000-8000-000000005004"
S="00000000-0000-4000-8000-000000005005"
R="00000000-0000-4000-8000-000000005006"
O="00000000-0000-4000-8000-000000005007"
F="00000000-0000-4000-8000-000000005008"
DSN="host=localhost dbname=doobr_r02_10 user=postgres password=ci-only-password"
USER="host=localhost dbname=doobr_r02_10 user=doobr_r0210_user password=ci-only-password"
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("issuer","subject","doobr-api",token,now+timedelta(minutes=5))
 def is_revoked(self,*a):return False
class Store:
 def resolve(self,subject,token,tenant):
  return Session(T,OP if token=="operator" else C,subject,"issuer",token,datetime.now(timezone.utc)+timedelta(minutes=5),False,None)
 def grants(self,tenant,actor):
  return [Grant("OPERATOR" if actor==OP else "COURIER","order:"+O,datetime.now(timezone.utc)+timedelta(minutes=5),False)]
class Approved:
 def approve(self,**kw):return True
class Refuse:
 def approve(self,**kw):return False
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r0210_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r0210_user")
   c.execute("GRANT SELECT ON doobr_private.delivery_orders,doobr_private.dispatch_assignments,doobr_private.order_commands,doobr_private.return_cases TO doobr_r0210_user")
   c.execute("GRANT UPDATE(state,revision,updated_at) ON doobr_private.delivery_orders TO doobr_r0210_user")
   c.execute("GRANT INSERT ON doobr_private.return_events,doobr_private.order_commands,doobr_private.return_cases TO doobr_r0210_user")
   c.execute("GRANT UPDATE(state,closed_at) ON doobr_private.return_cases TO doobr_r0210_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES(%s,'tenant')",(T,))
   for id,kind in ((C,"COURIER"),(OP,"OPERATOR"),(B,"CONSUMER"),(S,"RETAILER")):
    c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,id,kind+id,kind))
   c.execute("""INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
    VALUES(%s,%s,'test','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,R))
   c.execute("INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state) VALUES(%s,%s,%s,%s,%s,'HANDOFF_PENDING')",(T,O,B,S,R))
   c.execute("""INSERT INTO doobr_private.dispatch_offers(tenant_id,offer_id,order_id,courier_id,region_id,requested_units,offered_at,expires_at,state)
   VALUES(%s,%s,%s,%s,%s,1,now(),now()+interval '1 hour','ACCEPTED')""",(T,F,O,C,R))
   c.execute("INSERT INTO doobr_private.dispatch_assignments(tenant_id,order_id,courier_id,offer_id,reserved_units,state) VALUES(%s,%s,%s,%s,1,'ACTIVE')",(T,O,C,F))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r0210_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r0210_user")
   c.execute("DROP ROLE doobr_r0210_user")
  cls.admin.close()
 def apply(self,action,n,revision,deadline,authority=None,**more):
  args=dict(connect=lambda:psycopg.connect(USER),issuer=Issuer(),store=Store(),
   token="operator" if action in ("REQUIRE_RETURN","RECONCILE") else "courier",
   tenant_id=T,order_id=O,command_id=f"00000000-0000-4000-8000-{n:012d}",
   event_id=f"00000000-0000-4000-8001-{n:012d}",
   action=action,expected_revision=revision,reason="NO_SHOW",policy_ref="carrier-policy",
   deadline_at=deadline,proof_ref="approved-proof",authority=authority or Approved(),
   encrypt=lambda **kw:(b'c'*48,'key-v1'))
  return transition_return(**(args|more))
 def test_no_show_return_reconcile_replay(self):
  deadline=datetime.now(timezone.utc)+timedelta(hours=3)
  with self.assertRaises(Denied):self.apply("FAIL_DELIVERY",5011,1,deadline,authority=Refuse())
  res=self.apply("FAIL_DELIVERY",5011,1,deadline)
  self.assertEqual((res["state"],res["revision"]),("DELIVERY_FAILED",2))
  self.assertTrue(self.apply("FAIL_DELIVERY",5011,1,deadline)["replay"])
  with self.assertRaises(Denied):self.apply("FAIL_DELIVERY",5011,1,deadline,proof_ref="changed")
  self.assertEqual(self.apply("REQUIRE_RETURN",5012,2,deadline)["state"],"RETURN_REQUIRED")
  with self.assertRaises(Denied):self.apply("RETURN",5013,3,deadline,authority=Refuse())
  self.assertEqual(self.apply("RETURN",5013,3,deadline)["state"],"RETURNED")
  self.assertEqual(self.apply("RECONCILE",5014,4,deadline)["state"],"RECONCILED")
  with self.admin.cursor() as c:
   c.execute("SELECT state FROM doobr_private.return_cases WHERE tenant_id=%s AND order_id=%s",(T,O))
   self.assertEqual(c.fetchone()[0],"RECONCILED")
   c.execute("SELECT count(*) FROM doobr_private.return_events WHERE tenant_id=%s AND order_id=%s",(T,O))
   self.assertEqual(c.fetchone()[0],4)
if __name__=="__main__":unittest.main()
