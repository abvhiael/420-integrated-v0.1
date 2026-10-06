import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.messaging_eligibility import *
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class PB29MessagingEligibilityTests(unittest.TestCase):
 def bound(self,subject,actor,**kw):
  d=dict(principal=PrincipalKind.USER,subject_id=subject,actor_id=actor,
         eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
         relationship=RelationshipState.MATCHED,blocked=False)
  d.update(kw)
  return BoundEligibilityAuthorization(AuthorizationContext(**d),9,"pb-age-v1",100)
 def pair(self,**kw):
  left=kw.pop("left",self.bound("left","right"))
  right=kw.pop("right",self.bound("right","left"))
  return MessagingEligibilityPair(left,right)
 def marker(self,subject,g=6): return RevocationMarker(subject,g,"CURRENT")
 def token(self,subject,g=6): return DerivedAuthorityToken(subject,g)

 def test_current_mutual_match_and_eligibility_allows_gate(self):
  self.assertTrue(ordinary_messaging_allowed(self.pair()))

 def test_either_side_ineligible_fails_closed(self):
  for side in ("left","right"):
   for state in (EligibilityState.UNKNOWN,EligibilityState.EXPIRED,EligibilityState.REVOKED,EligibilityState.INELIGIBLE):
    b=self.bound(side,"right" if side=="left" else "left",eligibility=state)
    self.assertFalse(ordinary_messaging_allowed(self.pair(**{side:b})))

 def test_match_required_on_both_sides(self):
  for side in ("left","right"):
   for rel in (RelationshipState.NONE,RelationshipState.LIKED,RelationshipState.UNMATCHED,RelationshipState.BLOCKED):
    b=self.bound(side,"right" if side=="left" else "left",relationship=rel)
    self.assertFalse(ordinary_messaging_allowed(self.pair(**{side:b})))

 def test_lifecycle_and_block_revocation_override_prior_match(self):
  self.assertFalse(ordinary_messaging_allowed(self.pair(
   left=self.bound("left","right",lifecycle=LifecycleState.SUSPENDED))))
  self.assertFalse(ordinary_messaging_allowed(self.pair(
   right=self.bound("right","left",lifecycle=LifecycleState.DEACTIVATED))))
  self.assertFalse(ordinary_messaging_allowed(self.pair(
   right=self.bound("right","left",blocked=True))))

 def test_messenger_native_deny_is_additional_deny_never_grant(self):
  self.assertFalse(ordinary_messaging_allowed(self.pair(),messenger_native_denied=True))
  unmatched=self.pair(left=self.bound("left","right",relationship=RelationshipState.NONE))
  self.assertFalse(ordinary_messaging_allowed(unmatched,messenger_native_denied=False))

 def test_stale_messaging_generation_on_either_side_fails(self):
  p=self.pair()
  with self.assertRaises(PermissionError):
   require_ordinary_messaging(p,
    left_token=self.token("left",5),left_marker=self.marker("left",6),
    right_token=self.token("right",6),right_marker=self.marker("right",6))
  with self.assertRaises(PermissionError):
   require_ordinary_messaging(p,
    left_token=self.token("left",6),left_marker=self.marker("left",6),
    right_token=self.token("right",5),right_marker=self.marker("right",6))

 def test_current_generations_and_current_authority_pass(self):
  require_ordinary_messaging(self.pair(),
   left_token=self.token("left"),left_marker=self.marker("left"),
   right_token=self.token("right"),right_marker=self.marker("right"))

 def test_stale_match_cannot_be_resurrected_by_messaging_gate(self):
  p=self.pair(left=self.bound("left","right",relationship=RelationshipState.UNMATCHED))
  with self.assertRaises(MessagingEligibilityDenied):
   require_ordinary_messaging(p,
    left_token=self.token("left"),left_marker=self.marker("left"),
    right_token=self.token("right"),right_marker=self.marker("right"))

 def test_gate_contains_no_message_payload_transport_or_public_graph(self):
  self.assertEqual(set(MessagingEligibilityPair.__dataclass_fields__),{"left","right"})
  for forbidden in ("message","body","attachment","ciphertext","conversation_id","wallet_address","public_match_graph"):
   self.assertNotIn(forbidden,MessagingEligibilityPair.__dataclass_fields__)

if __name__=="__main__":unittest.main()
