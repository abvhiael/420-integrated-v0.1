import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind
from puffbuddies.domain.discovery import *
from puffbuddies.domain.eligibility_authorization import BoundEligibilityAuthorization
from puffbuddies.domain.profiles import ProfileRecord,ProfileVisibility
from puffbuddies.domain.types import *
from puffbuddies.persistence.revocation import DerivedAuthorityToken,RevocationMarker
from puffbuddies.storage.memory import InMemoryPrivateRepository

class PB4DiscoveryTests(unittest.TestCase):
 def profile(self,pid,mode=IntentMode.DATING,lifecycle=LifecycleState.ACTIVE):
  return ProfileRecord(ProfileId(pid),mode,lifecycle,(("bio","bio"),("display_name",pid)),("media:1",),1)

 def auth(self,pid,actor,*,eligible=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,blocked=False):
  c=AuthorizationContext(PrincipalKind.USER,pid,actor_id=actor,eligibility=eligible,
      lifecycle=lifecycle,blocked=blocked)
  return BoundEligibilityAuthorization(c,1,"v1",100)

 def prefs(self,pid,*,modes=frozenset({IntentMode.DATING}),distance=CoarseDistanceBand.REGIONAL,
             cannabis=None,version=1):
  return DiscoveryPreferencesRecord(ProfileId(pid),modes,distance,cannabis,version)

 def subject(self,pid,actor,*,mode=IntentMode.DATING,eligible=EligibilityState.ELIGIBLE,
             lifecycle=LifecycleState.ACTIVE,blocked=False,modes=frozenset({IntentMode.DATING}),
             distance=CoarseDistanceBand.REGIONAL,cannabis_pref=None,use=CannabisUse.NONE,
             generation=4):
  return DiscoverySubject(
    self.auth(pid,actor,eligible=eligible,lifecycle=lifecycle,blocked=blocked),
    self.profile(pid,mode,lifecycle),
    self.prefs(pid,modes=modes,distance=distance,cannabis=cannabis_pref),
    use,DerivedAuthorityToken(pid,generation),RevocationMarker(pid,generation,"CURRENT"))

 def candidate(self,pid,viewer="viewer",**kw):
  s=self.subject(pid,viewer,**kw)
  vis=(
    ProfileVisibility(ProfileId(pid),"display_name",VisibilityAudience.DISCOVERABLE,1),
    ProfileVisibility(ProfileId(pid),"bio",VisibilityAudience.DISCOVERABLE,1),
    ProfileVisibility(ProfileId(pid),"mode",VisibilityAudience.DISCOVERABLE,1),
    ProfileVisibility(ProfileId(pid),"media_refs",VisibilityAudience.DISCOVERABLE,1),
  )
  return DiscoveryCandidate(s,vis,CoarseDistanceBand.NEARBY,2)

 def viewer(self,**kw): return self.subject("viewer","candidate",**kw)

 def test_current_allowed_candidate_is_returned_with_only_discoverable_profile_presentation(self):
  r=discover(self.viewer(),[self.candidate("candidate")])
  self.assertEqual(len(r),1)
  self.assertEqual(r[0].profile_id,ProfileId("candidate"))
  self.assertEqual(r[0].presentation["display_name"],"candidate")
  self.assertNotIn("distance_band",r[0].presentation)
  self.assertNotIn("eligibility",r[0].presentation)

 def test_hard_exclusions_run_before_ranking(self):
  viewer=self.viewer()
  denied=[
   self.candidate("ineligible",eligible=EligibilityState.INELIGIBLE),
   self.candidate("inactive",lifecycle=LifecycleState.DEACTIVATED),
   self.candidate("blocked",blocked=True),
  ]
  self.assertEqual(discover(viewer,denied),())

 def test_stale_discovery_generation_is_excluded(self):
  c=self.candidate("candidate")
  stale=DiscoveryCandidate(
    DiscoverySubject(c.subject.authorization,c.subject.profile,c.subject.preferences,
      c.subject.cannabis_use,DerivedAuthorityToken("candidate",3),c.subject.marker),
    c.visibility,c.distance_band_from_viewer,c.activity_bucket)
  self.assertEqual(discover(self.viewer(),[stale]),())

 def test_self_discovery_is_excluded(self):
  v=self.viewer()
  self_candidate=DiscoveryCandidate(v,(
    ProfileVisibility(ProfileId("viewer"),"display_name",VisibilityAudience.DISCOVERABLE,1),
  ),CoarseDistanceBand.SAME_AREA,1)
  self.assertEqual(discover(v,[self_candidate]),())

 def test_mode_compatibility_is_mutual(self):
  viewer=self.viewer(modes=frozenset({IntentMode.DATING}))
  buddy=self.candidate("buddy",mode=IntentMode.BUDDY,modes=frozenset({IntentMode.DATING}))
  self.assertEqual(discover(viewer,[buddy]),())
  both=self.candidate("both",mode=IntentMode.BOTH,modes=frozenset({IntentMode.DATING}))
  self.assertEqual(len(discover(viewer,[both])),1)

 def test_coarse_distance_is_hard_filter_and_never_returned(self):
  viewer=self.viewer(distance=CoarseDistanceBand.NEARBY)
  c=self.candidate("far")
  c=DiscoveryCandidate(c.subject,c.visibility,CoarseDistanceBand.REGIONAL,c.activity_bucket)
  self.assertEqual(discover(viewer,[c]),())
  near=self.candidate("near")
  r=discover(viewer,[near]);self.assertEqual(len(r),1)
  self.assertFalse(any("distance" in k.lower() for k in r[0].presentation))

 def test_unknown_proximity_fails_closed(self):
  with self.assertRaises(DiscoveryDenied):
   DiscoveryCandidate(self.candidate("x").subject,(),CoarseDistanceBand.UNKNOWN,0)

 def test_cannabis_compatibility_is_private_hard_filter_without_coercion(self):
  viewer=self.viewer(cannabis_pref=frozenset({CannabisUse.NONE}))
  regular=self.candidate("regular",use=CannabisUse.REGULAR)
  none=self.candidate("none",use=CannabisUse.NONE)
  ids=[x.profile_id for x in discover(viewer,[regular,none])]
  self.assertEqual(ids,[ProfileId("none")])

 def test_candidate_preferences_are_also_respected(self):
  viewer=self.viewer(use=CannabisUse.REGULAR)
  c=self.candidate("candidate",cannabis_pref=frozenset({CannabisUse.NONE}))
  self.assertEqual(discover(viewer,[c]),())

 def test_missing_or_non_discoverable_profile_presentation_excludes_candidate(self):
  c=self.candidate("candidate")
  private=tuple(ProfileVisibility(x.profile_id,x.field_key,VisibilityAudience.PRIVATE_SELF,x.version) for x in c.visibility)
  hidden=DiscoveryCandidate(c.subject,private,c.distance_band_from_viewer,c.activity_bucket)
  self.assertEqual(discover(self.viewer(),[hidden]),())

 def test_stale_visibility_version_excludes_fields_and_candidate(self):
  c=self.candidate("candidate")
  stale=tuple(ProfileVisibility(x.profile_id,x.field_key,x.audience,2) for x in c.visibility)
  self.assertEqual(discover(self.viewer(),[DiscoveryCandidate(c.subject,stale,c.distance_band_from_viewer,1)]),())

 def test_ranking_is_derived_and_deterministic_after_hard_filters(self):
  near=self.candidate("near")
  far=self.candidate("far")
  far=DiscoveryCandidate(far.subject,far.visibility,CoarseDistanceBand.REGIONAL,3)
  r=discover(self.viewer(),[far,near])
  self.assertEqual([x.profile_id for x in r],[ProfileId("near"),ProfileId("far")])

 def test_ranking_failure_degrades_to_safe_deterministic_order(self):
  b=self.candidate("b");a=self.candidate("a")
  r=discover(self.viewer(),[b,a],ranking_available=False)
  self.assertEqual([x.profile_id for x in r],[ProfileId("a"),ProfileId("b")])

 def test_ranking_does_not_create_relationship_or_messaging_authority(self):
  r=discover(self.viewer(),[self.candidate("candidate")])
  self.assertEqual(set(r[0].__dataclass_fields__),{"profile_id","presentation"})
  self.assertNotIn("relationship",r[0].presentation)
  self.assertNotIn("match",r[0].presentation)

 def test_bounded_limit(self):
  with self.assertRaises(DiscoveryDenied): discover(self.viewer(),[],limit=0)
  with self.assertRaises(DiscoveryDenied): discover(self.viewer(),[],limit=101)

 def test_preferences_persist_privately_with_optimistic_concurrency(self):
  repo=InMemoryPrivateRepository();p=self.prefs("viewer",cannabis=frozenset({CannabisUse.NONE}))
  row=persist_discovery_preferences(repo,p,expected_version=None)
  loaded,v=load_discovery_preferences(repo,ProfileId("viewer"))
  self.assertEqual(loaded,p);self.assertEqual(v,row.version)
  self.assertNotIn("wallet_address",row.values)
  with self.assertRaises(Exception): persist_discovery_preferences(repo,p,expected_version=None)

 def test_inputs_exclude_wealth_payment_precise_location_and_safety_scores(self):
  self.assertEqual(set(DiscoveryPreferencesRecord.__dataclass_fields__),
    {"profile_id","modes","max_distance_band","allowed_cannabis","version"})
  self.assertEqual(set(DiscoveryResult.__dataclass_fields__),{"profile_id","presentation"})
  self.assertFalse(hasattr(self.candidate("x"),"latitude"))
  self.assertFalse(hasattr(self.candidate("x"),"wallet_balance"))
  self.assertFalse(hasattr(self.candidate("x"),"report_count"))

if __name__=="__main__":unittest.main()
