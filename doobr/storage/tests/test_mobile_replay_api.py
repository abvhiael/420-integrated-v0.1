import unittest
from datetime import datetime,timedelta,timezone
from doobr.auth import Denied
from doobr.mobile_replay_api import ReplayRequest,handle_replay
T="00000000-0000-4000-8000-000000000101"
D="00000000-0000-4000-8000-000000000102"
C="00000000-0000-4000-8000-000000000103"
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
class Identity:
 def __init__(self,enabled=True):self.enabled=enabled
 def verify_replay(self,**kwargs):return self.enabled
class Ledger:
 def __init__(self):self.ids=set()
 def record_once(self,**kwargs):
  key=(kwargs["tenant_id"],kwargs["device_id"],kwargs["command_id"])
  if key in self.ids:return False
  self.ids.add(key);return True
def request(**overrides):
 d=dict(method="POST",path="/private/v1/mobile/replay",bearer_token="signed",
  tenant_id=T,device_id=D,commands=[dict(command_id=C,kind="REFRESH_STATUS",
  opaque_ref="opaque0001",created_at=NOW)],trusted_origin=True,trusted_device=True,trusted_csrf=True)
 d.update(overrides);return ReplayRequest(**d)
class ReplayTests(unittest.TestCase):
 def test_reconnect_idempotency(self):
  ledger=Ledger()
  a=handle_replay(request=request(),identity=Identity(),ledger=ledger,at=NOW)
  b=handle_replay(request=request(),identity=Identity(),ledger=ledger,at=NOW)
  self.assertEqual(a["processed"][0]["status"],"ACCEPTED")
  self.assertEqual(b["processed"][0]["status"],"DUPLICATE")
 def test_revocation_denies(self):
  with self.assertRaises(Denied):handle_replay(request=request(),identity=Identity(False),ledger=Ledger(),at=NOW)
 def test_untrusted_transport_denied(self):
  for flag in ("trusted_origin","trusted_device","trusted_csrf"):
   with self.assertRaises(Denied):handle_replay(request=request(**{flag:False}),identity=Identity(),ledger=Ledger(),at=NOW)
 def test_location_and_regulated_commands_rejected(self):
  for kind in ("SEND_GPS","DELIVER","PAY","SIGN_CUSTODY"):
   with self.assertRaises(Denied):
    handle_replay(request=request(commands=[dict(command_id=C,kind=kind,opaque_ref="opaque0001",created_at=NOW)]),identity=Identity(),ledger=Ledger(),at=NOW)
 def test_expiry_and_extra_data_denied(self):
  stale=dict(command_id=C,kind="REFRESH_STATUS",opaque_ref="opaque0001",created_at=NOW-timedelta(minutes=6))
  self.assertEqual(handle_replay(request=request(commands=[stale]),identity=Identity(),ledger=Ledger(),at=NOW)["processed"],[])
  with self.assertRaises(Denied):
   handle_replay(request=request(commands=[dict(stale,latitude=50)]),identity=Identity(),ledger=Ledger(),at=NOW)
if __name__=="__main__":unittest.main()
