import unittest
from datetime import datetime,timedelta,timezone
import psycopg
from doobr.custody import apply_custody
from doobr.auth import Denied,Session,Grant,VerifiedPrincipal
T="00000000-0000-4000-8000-000000004001"
C="00000000-0000-4000-8000-000000004002"
B="00000000-0000-4000-8000-000000004003"
S="00000000-0000-4000-8000-000000004004"
R="00000000-0000-4000-8000-000000004005"
O="00000000-0000-4000-8000-000000004006"
F="00000000-0000-4000-8000-000000004007"
DSN="host=localhost dbname=doobr_r02_9 user=postgres password=ci-only-password"
USR="host=localhost dbname=doobr_r02_9 user=doobr_r029_user password=ci-only-password"
class Issuer:
 def verify(self,token,now):return VerifiedPrincipal("issuer","subject","doobr-api","jti",now+timedelta(minutes=5))
 def is_revoked(self,*a):return False
class Store:
 def resolve(self,subject,token,tenant):return Session(T,C,subject,"issuer","jti",datetime.now(timezone.utc)+timedelta(minutes=5),False,None)
 def grants(self,tenant,actor):return [Grant("COURIER","order:"+O,datetime.now(timezone.utc)+timedelta(minutes=5),False)]
class Approve:
 def approve(self,**kwargs):return True
class Reject:
 def approve(self,**kwargs):return False
class PG(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=psycopg.connect(DSN,autocommit=True)
  with cls.admin.cursor() as c:
   c.execute("CREATE ROLE doobr_r029_user LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS")
   c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_r029_user")
   c.execute("GRANT SELECT ON doobr_private.delivery_orders,doobr_private.dispatch_assignments,doobr_private.order_commands TO doobr_r029_user")
   c.execute("GRANT UPDATE(state,revision,updated_at) ON doobr_private.delivery_orders TO doobr_r029_user")
   c.execute("GRANT INSERT ON doobr_private.custody_evidence,doobr_private.order_commands TO doobr_r029_user")
   c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES(%s,'tenant')",(T,))
   for actor,kind in ((C,'COURIER'),(B,'CONSUMER'),(S,'RETAILER')):
    c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES(%s,%s,%s,%s,'ACTIVE')",(T,actor,kind+actor,kind))
   c.execute("""INSERT INTO doobr_private.service_regions
     (tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
     VALUES(%s,%s,'test','CA','BC','Vancouver',ST_Multi(ST_GeomFromText('POLYGON((-123 49,-122 49,-122 50,-123 50,-123 49))',4326)),'policy')""",(T,R))
   c.execute("INSERT INTO doobr_private.delivery_orders(tenant_id,order_id,consumer_id,retailer_id,region_id,state) VALUES(%s,%s,%s,%s,%s,'ASSIGNED')",(T,O,B,S,R))
   c.execute("""INSERT INTO doobr_private.dispatch_offers
    (tenant_id,offer_id,order_id,courier_id,region_id,requested_units,offered_at,expires_at,state)
    VALUES(%s,%s,%s,%s,%s,1,now(),now()+interval '1 hour','ACCEPTED')""",(T,F,O,C,R))
   c.execute("""INSERT INTO doobr_private.dispatch_assignments
    (tenant_id,order_id,courier_id,offer_id,reserved_units,state) VALUES(%s,%s,%s,%s,1,'ACTIVE')""",(T,O,C,F))
 @classmethod
 def tearDownClass(cls):
  with cls.admin.cursor() as c:
   c.execute("REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM doobr_r029_user")
   c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r029_user")
   c.execute("DROP ROLE doobr_r029_user")
  cls.admin.close()
 def command(self,action,command_id,evidence_id,revision,authority=None,**override):
  args=dict(connect=lambda:psycopg.connect(USR),issuer=Issuer(),store=Store(),
   token='valid',tenant_id=T,order_id=O,command_id=command_id,evidence_id=evidence_id,
   action=action,expected_revision=revision,package_seal_ref='sealed',
   issuer_evidence_ref='verified-retailer-custody',recipient_id_ref='verified-id',
   recipient_name_ref='verified-name',signature_ref='verified-signature',
   authority=authority or Approve(),encrypt=lambda **kw:(b'e'*48,'key-v1'))
  return apply_custody(**(args|override))
 def test_atomic_pickup_replay_and_handoff_rejection(self):
  cmd='00000000-0000-4000-8000-000000004011'
  evidence='00000000-0000-4000-8000-000000004012'
  result=self.command('PICKUP',cmd,evidence,1)
  self.assertEqual((result['state'],result['revision'],result['replay']),('PICKED_UP',2,False))
  self.assertTrue(self.command('PICKUP',cmd,evidence,1)['replay'])
  with self.assertRaises(Denied):self.command('PICKUP',cmd,evidence,1,package_seal_ref='changed')
  with self.admin.cursor() as c:
   c.execute("UPDATE doobr_private.delivery_orders SET state='HANDOFF_PENDING',revision=4 WHERE tenant_id=%s AND order_id=%s",(T,O))
  cmd2='00000000-0000-4000-8000-000000004013'
  ev2='00000000-0000-4000-8000-000000004014'
  with self.assertRaises(Denied):self.command('DELIVER',cmd2,ev2,4,authority=Reject())
  with self.admin.cursor() as c:
   c.execute("SELECT count(*) FROM doobr_private.custody_evidence WHERE tenant_id=%s AND evidence_id=%s",(T,ev2))
   self.assertEqual(c.fetchone()[0],0)
  self.assertEqual(self.command('DELIVER',cmd2,ev2,4)['state'],'DELIVERED')
  with self.admin.cursor() as c:
   c.execute("SELECT count(*) FROM doobr_private.custody_evidence WHERE tenant_id=%s AND order_id=%s",(T,O))
   self.assertEqual(c.fetchone()[0],2)
if __name__=='__main__':unittest.main()
