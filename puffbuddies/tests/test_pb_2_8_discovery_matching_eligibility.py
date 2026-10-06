import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.authorization import *
from puffbuddies.domain.discovery_matching_eligibility import *
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker

class PB28DiscoveryMatchingEligibilityTests(unittest.TestCase):
 def bound(self,subject,actor,**kw):
  d=dict(principal=PrincipalKind.USER,subject_id=subject,actor_id=actor,
         eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
         relationship=RelationshipState.NONE,blocked=False)
  d.update(kw)
  return BoundEligibilityAuthorization(AuthorizationContext(**d),7,"pb-age-v1",100)

 def pair(self,**kw):
  v=kw.pop("viewer",self.bound("viewer","candidate"))
  c=kw.pop("candidate",self.bound("candidate","viewer"))
  return DiscoveryMatchingPair(v,c)

 def marker(self,subject,g=4): return RevocationMarker(subject,g,"CURRENT")
 def token(self,subject,g=4): return DerivedAuthorityToken(subject,g)

 def test_discovery_requires_both_current_eligible_active(self):
  self.assertTrue(discovery_candidate_allowed(self.pair()))
  for side in ("viewer","candidate"):
   for state in (EligibilityState.UNKNOWN,EligibilityState.EXPIRED,EligibilityState.REVOKED,EligibilityState.INELIGIBLE):
    b=self.bound(side,"candidate" if side=="viewer" else "viewer",eligibility=state)
    p=self.pair(**{side:b})
    self.assertFalse(discovery_candidate_allowed(p))

 def test_discovery_hard_exclusions_precede_visibility_or_ranking(self):
  self.assertFalse(discovery_candidate_allowed(self.pair(
   candidate=self.bound("candidate","viewer",lifecycle=LifecycleState.SUSPENDED))))
  self.assertFalse(discovery_candidate_allowed(self.pair(
   candidate=self.bound("candidate","viewer",blocked=True))))
  self.assertFalse(discovery_candidate_allowed(self.pair(
   viewer=self.bound("viewer","candidate",blocked=True))))

 def test_match_intent_requires_both_current_eligible_active(self):
  self.assertTrue(match_intent_allowed(self.pair()))
  self.assertFalse(match_intent_allowed(self.pair(
   viewer=self.bound("viewer","candidate",eligibility=EligibilityState.EXPIRED))))
  self.assertFalse(match_intent_allowed(self.pair(
   candidate=self.bound("candidate","viewer",eligibility=EligibilityState.REVOKED))))
  self.assertFalse(match_intent_allowed(self.pair(
   candidate=self.bound("candidate","viewer",lifecycle=LifecycleState.DEACTIVATED))))

 def test_stale_discovery_generation_is_rejected_for_either_side(self):
  p=self.pair()
  with self.assertRaises(PermissionError):
   require_discovery_candidate(p,
    viewer_token=self.token("viewer",3),viewer_marker=self.marker("viewer",4),
    candidate_token=self.token("candidate",4),candidate_marker=self.marker("candidate",4))
  with self.assertRaises(PermissionError):
   require_discovery_candidate(p,
    viewer_token=self.token("viewer",4),viewer_marker=self.marker("viewer",4),
    candidate_token=self.token("candidate",3),candidate_marker=self.marker("candidate",4))

 def test_stale_matching_generation_is_rejected_for_either_side(self):
  p=self.pair()
  with self.assertRaises(PermissionError):
   require_match_intent(p,
    viewer_token=self.token("viewer",4),viewer_marker=self.marker("viewer",4),
    candidate_token=self.token("candidate",3),candidate_marker=self.marker("candidate",4))

 def test_current_generations_and_current_eligibility_pass(self):
  p=self.pair()
  require_discovery_candidate(p,
   viewer_token=self.token("viewer"),viewer_marker=self.marker("viewer"),
   candidate_token=self.token("candidate"),candidate_marker=self.marker("candidate"))
  require_match_intent(p,
   viewer_token=self.token("viewer"),viewer_marker=self.marker("viewer"),
   candidate_token=self.token("candidate"),candidate_marker=self.marker("candidate"))

 def test_eligibility_gate_does_not_manufacture_reciprocal_match(self):
  p=self.pair()
  self.assertTrue(match_intent_allowed(p))
  self.assertEqual(p.viewer.context.relationship,RelationshipState.NONE)
  self.assertEqual(p.candidate.context.relationship,RelationshipState.NONE)

 def test_pair_contains_no_profile_payload_or_ranking_output(self):
  self.assertEqual(set(DiscoveryMatchingPair.__dataclass_fields__),{"viewer","candidate"})

if __name__=="__main__":unittest.main()
