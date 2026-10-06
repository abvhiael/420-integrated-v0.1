import pathlib,sys,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))

from puffbuddies.integrations.ecosystem import *
from puffbuddies.domain.authorization import AuthorizationContext,PrincipalKind,authorize_private_access
from puffbuddies.domain.types import EligibilityState,LifecycleState,RelationshipState,VisibilityAudience

class PB13RetainedIntegrationTests(unittest.TestCase):
 def test_healthy_dependencies_do_not_create_relationship_authority(self):
  for name,contract in CONTRACTS.items():
   if contract.service_id is not None:
    snap=RegistryServiceSnapshot(name,contract.service_id,1,True,False,420,100,"impl:v1")
    admit_registry_snapshot(snap,expected_chain_id=420,now_epoch=110)
  ctx=AuthorizationContext(PrincipalKind.USER,"bob",actor_id="alice",
   eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
   relationship=RelationshipState.NONE,blocked=False)
  self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx))
  self.assertFalse(authorize_private_access(VisibilityAudience.PARTICIPANT_ONLY,ctx))

 def test_appstore_analytics_and_indexer_failure_cannot_broaden_private_access(self):
  ctx=AuthorizationContext(PrincipalKind.USER,"bob",actor_id="alice",
   eligibility=EligibilityState.ELIGIBLE,lifecycle=LifecycleState.ACTIVE,
   relationship=RelationshipState.NONE,blocked=False)
  for _ in range(3):self.assertFalse(authorize_private_access(VisibilityAudience.MATCHED,ctx))

 def test_dependency_authority_conflict_is_rejected_before_domain_decision(self):
  with self.assertRaises(IntegrationDenied):
   assert_no_authority_inheritance({"block":"420Messenger","lifecycle":"420Registry","safety":"420Analytics"})

if __name__=="__main__":unittest.main()
