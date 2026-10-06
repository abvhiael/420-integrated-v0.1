import pathlib, sys, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from puffbuddies.domain.types import *
from puffbuddies.domain.boundaries import *

class PB11DomainTests(unittest.TestCase):
    def test_modes_are_canonical(self): self.assertEqual({x.value for x in IntentMode},{"DATING","BUDDY","BOTH"})
    def test_visibility_vocabulary_is_complete(self): self.assertEqual({x.value for x in VisibilityAudience},{"PRIVATE_SELF","DISCOVERABLE","MATCHED","PARTICIPANT_ONLY","MODERATOR_ONLY","SERVICE_MINIMUM","AGGREGATE_ONLY","PUBLIC_EXPLICIT","NEVER_PUBLIC"})
    def test_sensitive_defaults_are_not_public(self):
        self.assertEqual(PUBLICLY_ENUMERABLE,frozenset())
        for k in ("membership","eligibility_evidence","preferences","precise_location","relationship","safety","lifecycle","wallet_profile_link"):
            self.assertNotEqual(DEFAULT_AUDIENCE[k],VisibilityAudience.PUBLIC_EXPLICIT)
    def test_derived_systems_are_not_authority(self):
        for x in ("420Indexer","420Search","420Explorer","420Analytics","client","cache","projection"): self.assertIn(x,DERIVED_NON_AUTHORITIES)
    def test_external_authority_is_bounded(self):
        self.assertEqual(EXTERNAL_AUTHORITIES["eligibility_evidence"],"420Identity")
        self.assertEqual(CANONICAL_OWNER["eligibility_decision"],"puffbuddies")
        self.assertEqual(EXTERNAL_AUTHORITIES["message_transport"],"420Messenger")
        self.assertNotIn("relationship",EXTERNAL_AUTHORITIES)
    def test_cannabis_is_optional_not_identity(self):
        p=DiscoveryPreferences(frozenset({IntentMode.BUDDY}),None); self.assertIsNone(p.cannabis_compatible)
        self.assertIn("CannabisProfile",CANONICAL_PRIVATE_TYPES)
    def test_private_types_have_no_wallet_or_public_ids(self):
        self.assertNotIn("wallet",Profile.__annotations__)
        self.assertNotIn("address",Profile.__annotations__)
    def test_relationship_is_private_pair_state(self):
        r=Relationship(ProfileId("a"),ProfileId("b"),RelationshipState.MATCHED); self.assertEqual(r.state,RelationshipState.MATCHED)

if __name__=="__main__": unittest.main()
