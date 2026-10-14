import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import Mock
from doobr.auth import Session,Grant,VerifiedPrincipal,Denied
from doobr.wallet_consent import WalletConsent,authorize_wallet_action
NOW=datetime(2026,10,12,tzinfo=timezone.utc)
def fixture(**changes):
 identity=Mock();identity.verify.return_value=VerifiedPrincipal("id","subject","doobr-api","tok",NOW+timedelta(hours=1));identity.is_revoked.return_value=False
 store=Mock();store.resolve.return_value=Session("tenant","actor","subject","id","tok",NOW+timedelta(hours=1),False,NOW+timedelta(minutes=30))
 store.grants.return_value=[Grant("CONSUMER","order",NOW+timedelta(hours=1),False)]
 details=dict(issuer="420Wallet",tenant_id="tenant",actor_id="actor",session_token_id="tok",
 consent_id="consent",audience="doobr-api",action="CANCEL_OWN_ORDER",resource="order",
 nonce="fresh_nonce",issued_at=NOW-timedelta(minutes=1),expires_at=NOW+timedelta(minutes=10),revoked=False)
 details.update(changes)
 wallet=Mock();wallet.verify_consent.return_value=WalletConsent(**details);wallet.is_revoked.return_value=False
 nonces=Mock();nonces.record_once.return_value=True
 return identity,store,wallet,nonces
def verify(p):
 identity,store,wallet,nonces=p
 return authorize_wallet_action(identity=identity,session_store=store,signed_token="signed",
 tenant_id="tenant",action="CANCEL_OWN_ORDER",resource="order",
 signed_consent="wallet-signed",wallet=wallet,nonces=nonces,now=NOW)
class WalletTests(unittest.TestCase):
 def test_consent_consumed_once(self):
  p=fixture();self.assertEqual(verify(p).actor_id,"actor")
  p[3].record_once.assert_called_once()
  p[3].record_once.return_value=False
  with self.assertRaises(Denied):verify(p)
 def test_invalid_consent_denied(self):
  for name,value in (("tenant_id","cross"),("actor_id","other"),("session_token_id","old"),
      ("audience","wrong"),("action","READ_OWN_ORDER"),("resource","other"),
      ("consent_id",""),("nonce",""),("revoked",True),
      ("issued_at",NOW+timedelta(seconds=1)),("expires_at",NOW),
      ("expires_at",NOW+timedelta(hours=2))):
   with self.subTest(name=name),self.assertRaises(Denied):verify(fixture(**{name:value}))
 def test_revoked_session_or_wallet_or_outage(self):
  p=fixture();p[2].is_revoked.return_value=True
  with self.assertRaises(Denied):verify(p)
  p=fixture();p[1].resolve.return_value=None
  with self.assertRaises(Denied):verify(p)
  p=fixture();p[3].record_once.side_effect=TimeoutError()
  with self.assertRaises(Denied):verify(p)
  p=fixture();p[0].is_revoked.return_value=True
  with self.assertRaises(Denied):verify(p)
if __name__=="__main__":unittest.main()
