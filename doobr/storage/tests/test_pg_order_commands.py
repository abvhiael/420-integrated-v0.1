"""R02.6 actual PostgreSQL row-lock, rollback, idempotency and RLS tests."""
import os, unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from uuid import UUID
import psycopg
from doobr.auth import Denied,Grant,Session,VerifiedPrincipal
from doobr.order_commands import run_command

T="00000000-0000-4000-8000-000000001101"
FOREIGN="00000000-0000-4000-8000-000000001102"
CONSUMER="00000000-0000-4000-8000-000000001103"
RETAILER="00000000-0000-4000-8000-000000001104"
REGION="00000000-0000-4000-8000-000000001105"
ORDER="00000000-0000-4000-8000-000000001106"
OTHER_ORDER="00000000-0000-4000-8000-000000001107"
COMMAND="00000000-0000-4000-8000-000000001108"
OTHER_COMMAND="00000000-0000-4000-8000-000000001109"
DSN="host=localhost dbname=doobr_r02_6 user=postgres password=ci-only-password"
USER_DSN="host=localhost dbname=doobr_r02_6 user=doobr_r026_user password=ci-only-password"
class Issuer:
 def verify(self,signed_token,now):return VerifiedPrincipal("issuer","subject","doobr-api","token",now+timedelta(hours=1))
 def is_revoked(self,*args):return False
class Store:
 def resolve(self,subject,token,tenant_id):return Session(T,CONSUMER,subject,"issuer",token,datetime.now(timezone.utc)+timedelta(hours=1),False,None)
 def grants(self,tenant,actor):return [Grant("CONSUMER","order:"+ORDER,datetime.now(timezone.utc)+timedelta(hours=1),False)]
class Authority:
 enabled=True
 def approve(self,**kwargs):return self.enabled
class PG(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r026_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r026_user")
   c.execute("GRANT SELECT ON doobr_private.delivery_orders,doobr_private.order_commands TO doobr_r026_user")
   c.execute("GRANT UPDATE(state,revision,updated_at) ON doobr_private.delivery_orders TO doobr_r026_user")
   c.execute("GRANT INSERT ON doobr_private.order_commands TO doobr_r026_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES(%s,'tenant'),(%s,'foreign')",(T,FOREIGN))
   c.execute("""INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state)
       VALUES(%s,%s,'consumer:1','CONSUMER','ACTIVE'),(%s,%s,'retailer:1','RETAILER','ACTIVE')""",(T,CONSUMER,T,RETAILER))
   c.execute("""INSERT INTO doobr_private.service_regions
       (tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
       VALUES(%s,%s,'test-vancouver','CA','BC','Vancouver',
       ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'test-policy')""",(T,REGION))
   c.execute("""INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id)
       VALUES(%s,%s,%s,%s,%s),(%s,%s,%s,%s,%s)""",(T,ORDER,CONSUMER,RETAILER,REGION,T,OTHER_ORDER,CONSUMER,RETAILER,REGION))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r026_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r026_user")
   c.execute("DROP ROLE doobr_r026_user")
  cls.admin.close()
 def execute(self,command_id=COMMAND,expected_revision=1,action="CANCEL",order_id=ORDER,
             tenant_id=T,authority=None,store=None,evidence_ref="authorized-request"):
  return run_command(connect=lambda:psycopg.connect(USER_DSN),identity_issuer=Issuer(),
      session_store=store or Store(),signed_token="signed",tenant_id=tenant_id,
      order_id=order_id,command_id=command_id,action=action,
      expected_revision=expected_revision,evidence_ref=evidence_ref,
      evidence_authority=authority or Authority())
 def test_parallel_exactly_one_transition_and_replay(self):
  def attempt(_):
   try:return self.execute()
   except Denied:return "denied"
  with ThreadPoolExecutor(max_workers=6) as pool:
   results=list(pool.map(attempt,range(6)))
  successes=[r for r in results if r!="denied"]
  self.assertTrue(successes)
  self.assertEqual({(r.state,r.revision) for r in successes},{("CANCELLED",2)})
  self.assertEqual(sum(not r.replay for r in successes),1)
  replay=self.execute()
  self.assertTrue(replay.replay)
  with self.assertRaises(Denied):self.execute(evidence_ref="changed-payload")
  with self.assertRaises(Denied):self.execute(command_id=OTHER_COMMAND)
  with self.admin.cursor() as c:
   c.execute("SELECT state,revision FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s",(T,ORDER))
   self.assertEqual(c.fetchone(),("CANCELLED",2))
   c.execute("SELECT count(*) FROM doobr_private.order_commands WHERE tenant_id=%s AND order_id=%s",(T,ORDER))
   self.assertEqual(c.fetchone()[0],1)
 def test_failure_rolls_back_and_foreign_tenant_denied(self):
  a=Authority();a.enabled=False
  with self.assertRaises(Denied):self.execute(command_id=OTHER_COMMAND,order_id=OTHER_ORDER,authority=a)
  with self.admin.cursor() as c:
   c.execute("SELECT state,revision FROM doobr_private.delivery_orders WHERE tenant_id=%s AND order_id=%s",(T,OTHER_ORDER))
   self.assertEqual(c.fetchone(),("DRAFT",1))
  with self.assertRaises(Denied):self.execute(order_id=OTHER_ORDER,tenant_id=FOREIGN)
  with self.assertRaises(Denied):self.execute(order_id=OTHER_ORDER,action="DELIVER")
if __name__=="__main__":unittest.main()
