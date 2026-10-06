import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from puffbuddies.domain.verification_reputation import *
from puffbuddies.domain.discovery import DiscoveryPreferencesRecord,CoarseDistanceBand
from puffbuddies.domain.types import *
from puffbuddies.domain.safety import SafetyCase
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind

class PB9IntegrationTests(unittest.TestCase):
 def indicator(self,visible=True):
  return issue_indicator(profile_id=ProfileId("alice"),kind=VerificationKind.IDENTITY_CREDENTIAL,
   source=VerificationSource.IDENTITY,source_version="v1",issued_at_epoch=100,
   expires_at_epoch=200,current_generation=3,user_visible=visible).indicator

 def test_verification_badge_does_not_create_eligibility_lifecycle_match_or_consent(self):
  p=verification_presentation([self.indicator()],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120)
  self.assertEqual(p.indicators,("identity_verified",))
  ctx=AuthorizationContext(PrincipalKind.USER,"alice",actor_id="bob",
   eligibility=EligibilityState.UNKNOWN,lifecycle=LifecycleState.PROFILE_INCOMPLETE,
   relationship=RelationshipState.NONE)
  self.assertEqual(ctx.eligibility,EligibilityState.UNKNOWN)
  self.assertEqual(ctx.relationship,RelationshipState.NONE)

 def test_safety_and_report_history_are_not_reputation_inputs(self):
  fields=set(VerificationIndicator.__dataclass_fields__)|set(VerificationPresentation.__dataclass_fields__)
  for x in ("report_count","block_count","moderation_history","risk_score","case_id"):
   self.assertNotIn(x,fields)

 def test_verification_does_not_change_private_discovery_preferences(self):
  prefs=DiscoveryPreferencesRecord(ProfileId("alice"),frozenset({IntentMode.DATING}),
   CoarseDistanceBand.REGIONAL,None,1)
  before=prefs
  verification_presentation([self.indicator()],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120)
  self.assertEqual(prefs,before)

 def test_revoked_indicator_cannot_survive_as_badge(self):
  x=self.indicator()
  r=revoke_indicator(x,source=VerificationSource.IDENTITY,current_generation=4)
  self.assertEqual(verification_presentation([r.indicator],profile_id=ProfileId("alice"),
   audience=VisibilityAudience.DISCOVERABLE,now_epoch=120).indicators,())

if __name__=="__main__":unittest.main()
