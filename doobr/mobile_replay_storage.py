"""R03.9 idempotent replay journal using PostgreSQL unique index and RLS."""
from .auth import Denied
class PostgresReplayLedger:
 def __init__(self,connect):self.connect=connect
 def record_once(self,*,tenant_id,device_id,command_id,kind,opaque_ref,at):
  try:
   with self.connect() as db:
    with db.transaction():
     with db.cursor() as c:
      c.execute("SELECT set_config('doobr.tenant_id',%s,true)",(tenant_id,))
      c.execute("""INSERT INTO doobr_private.mobile_replay_receipts
        (tenant_id,device_id,command_id,kind,opaque_ref,received_at)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (tenant_id,device_id,command_id) DO NOTHING
        RETURNING command_id""",(tenant_id,device_id,command_id,kind,opaque_ref,at))
      return c.fetchone() is not None
  except Exception as exc:raise Denied("replay journal unavailable") from exc
