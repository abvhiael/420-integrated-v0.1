"""R03.9 idempotent replay journal using PostgreSQL unique index and RLS.

Only canonical DOOBr and explicitly isolated staging schema are selectable.
Database role must not own tables, inherit privileged roles or bypass RLS.
"""
from .auth import Denied
SCHEMAS=frozenset(("doobr_private","doobr_staging"))
class PostgresReplayLedger:
 def __init__(self,connect,*,schema="doobr_private"):
  if schema not in SCHEMAS:raise Denied("unknown DOOBr schema")
  self.connect=connect
  self.table=schema+".mobile_replay_receipts"
 def record_once(self,*,tenant_id,device_id,command_id,kind,opaque_ref,at):
  try:
   with self.connect() as db:
    with db.transaction():
     with db.cursor() as c:
      c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
      c.execute("""INSERT INTO """+self.table+""" (tenant_id,device_id,command_id,kind,opaque_ref,received_at)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (tenant_id,device_id,command_id) DO NOTHING
        RETURNING command_id""",(tenant_id,device_id,command_id,kind,opaque_ref,at))
      return c.fetchone() is not None
  except Exception as exc:raise Denied("replay journal unavailable") from exc
