"""R02.2 persisted auth integration. Exercises Postgres row visibility and revocation with non-owner DB role."""
import os
import unittest
from dataclasses import replace
from datetime import datetime,timezone,timedelta
import psycopg
from doobr.auth import authorize, Permission, VerifiedPrincipal, Denied
from doobr.session_store import PostgresSessionStore

TENANT="00000000-0000-4000-8000-000000000211"
OTHER="00000000-0000-4000-8000-000000000212"
ACTOR="00000000-0000-4000-8000-000000000221"
SESSION="00000000-0000-4000-8000-000000000231"
GRANT="00000000-0000-4000-8000-000000000241"
NOW=datetime.now(timezone.utc)
class Issuer:
    def verify(self, signed_token, now):
        return VerifiedPrincipal("identity","user-1","doobr-api","jti",now+timedelta(hours=1))
    def is_revoked(self, issuer,jti):return False
class Cases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=psycopg.connect(host="localhost",port=5432,dbname="doobr_r02_2",user="postgres",password="ci-only-password",autocommit=True)
        with cls.admin.cursor() as c:
            c.execute("CREATE ROLE doobr_auth_runtime LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS")
            c.execute("GRANT USAGE ON SCHEMA doobr_private TO doobr_auth_runtime")
            c.execute("GRANT SELECT ON doobr_private.identity_sessions,doobr_private.role_grants,doobr_private.actors TO doobr_auth_runtime")
            c.execute("INSERT INTO doobr_private.tenants(tenant_id,label) VALUES (%s,'Auth A'),(%s,'Auth B')",(TENANT,OTHER))
            c.execute("INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES (%s,%s,'identity:user-1','COURIER','ACTIVE')",(TENANT,ACTOR))
            c.execute("""INSERT INTO doobr_private.identity_sessions
                       (tenant_id,session_id,actor_id,issuer_ref,token_jti_digest,audience,wallet_consent,wallet_consent_expires_at,expires_at)
                       VALUES (%s,%s,%s,'identity',decode('5b1288bdb86ccf33cc0158da1a1f405c4095d9c00fe9dadd9c58af82ff2abae5','hex'),'doobr-api',true,now()+interval '30 minutes',now()+interval '1 hour')""",(TENANT,SESSION,ACTOR))
            c.execute("""INSERT INTO doobr_private.role_grants(tenant_id,actor_id,grant_id,role,resource_ref,granted_by,expires_at)
                       VALUES (%s,%s,%s,'COURIER','order:1','issuer:reviewer',now()+interval '1 hour')""",(TENANT,ACTOR,GRANT))
    @classmethod
    def tearDownClass(cls):
        with cls.admin.cursor() as c:
            c.execute("REVOKE ALL ON doobr_private.identity_sessions,doobr_private.role_grants,doobr_private.actors FROM doobr_auth_runtime")
            c.execute("REVOKE USAGE ON SCHEMA doobr_private FROM doobr_auth_runtime")
            c.execute("DROP ROLE doobr_auth_runtime")
        cls.admin.close()
    def setUp(self):
        with self.admin.cursor() as c:
            c.execute("UPDATE doobr_private.actors SET state='ACTIVE' WHERE tenant_id=%s",(TENANT,))
            c.execute("UPDATE doobr_private.identity_sessions SET revoked_at=NULL,expires_at=now()+interval '1 hour',wallet_consent=true,wallet_consent_expires_at=now()+interval '30 minutes' WHERE tenant_id=%s",(TENANT,))
            c.execute("UPDATE doobr_private.role_grants SET revoked_at=NULL,expires_at=now()+interval '1 hour' WHERE tenant_id=%s",(TENANT,))
        self.store=PostgresSessionStore(lambda:psycopg.connect(host="localhost",port=5432,dbname="doobr_r02_2",user="doobr_auth_runtime",password="ci-only-password"))
    def attempt(self,tenant=TENANT):
        return authorize(issuer=Issuer(),store=self.store,signed_token="signed-fixture",tenant_id=tenant,permission=Permission("COURIER","PICKUP","order:1",True),now=datetime.now(timezone.utc))
    def test_authorized_and_tenant_constrained(self):
        self.assertEqual(self.attempt().actor_id,ACTOR)
        with self.assertRaises(Denied):self.attempt(OTHER)
    def test_persistent_revocation_and_expiry(self):
        for table,assignment in [
          ("identity_sessions","revoked_at=now()"),
          ("identity_sessions","expires_at=now()-interval '1 second'"),
          ("identity_sessions","wallet_consent_expires_at=now()-interval '1 second'"),
          ("identity_sessions","wallet_consent=false"),
          ("role_grants","revoked_at=now()"),
          ("role_grants","expires_at=now()-interval '1 second'"),
          ("actors","state='SUSPENDED'")]:
            self.setUp()
            with self.admin.cursor() as c:
                c.execute(f"UPDATE doobr_private.{table} SET {assignment} WHERE tenant_id=%s",(TENANT,))
            with self.assertRaises(Denied,msg=assignment):self.attempt()
    def test_role_not_admin_and_no_other_order(self):
        with self.assertRaises(Denied):
            authorize(issuer=Issuer(),store=self.store,signed_token="x",tenant_id=TENANT,permission=Permission("OPERATOR","READ_INCIDENT","order:1"),now=datetime.now(timezone.utc))
        with self.assertRaises(Denied):
            authorize(issuer=Issuer(),store=self.store,signed_token="x",tenant_id=TENANT,permission=Permission("COURIER","PICKUP","order:2"),now=datetime.now(timezone.utc))
if __name__=="__main__":unittest.main()
