package orchestration

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

func regionalRecoverySnapshot() FailureDomainSnapshot {
	return FailureDomainSnapshot{
		FailedGeography: "ca-central",
		AffectedNodeIDs: []string{"ingress", "transcode:000:720p"},
		OccupiedOperators: map[[32]byte]struct{}{b32(13): {}, b32(14): {}},
		OccupiedGeographies: map[string]struct{}{"us-east": {}, "eu-west": {}},
		NodeGeographies: map[string]string{
			"ingress": "ca-central",
			"transcode:000:720p": "ca-central",
			"transcode:001:1080p": "us-east",
			"relay:000": "eu-west",
		},
	}
}

func regionalRecoveryRequests() map[string]RecoveryRequest {
	return map[string]RecoveryRequest{
		"ingress": {
			Node: JobNode{ID: "ingress", Role: RoleIngress, OperatorID: b32(11)},
			Selection: discovery.Request{CapabilityID: b32(31)},
			FailedOperatorID: b32(11),
		},
		"transcode:000:720p": {
			Node: JobNode{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: b32(12)},
			Selection: discovery.Request{CapabilityID: b32(32)},
			FailedOperatorID: b32(12),
		},
	}
}

func TestRegionalRecoveryAssignsUniqueOperatorsAndGeographies(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(21, "ap-south", 100),
		geoSelection(22, "sa-east", 90),
		geoSelection(23, "us-west", 80),
	}}, RecoveryPolicy{})

	plan, err := planner.PlanRegionalRecovery(context.Background(), regionalRecoverySnapshot(), regionalRecoveryRequests(), RegionalRecoveryPolicy{})
	if err != nil { t.Fatal(err) }
	if len(plan.Decisions) != 2 { t.Fatalf("decisions=%d", len(plan.Decisions)) }
	if plan.Decisions[0].NodeID != "ingress" || plan.Decisions[1].NodeID != "transcode:000:720p" { t.Fatalf("order=%v", plan.Decisions) }
	if plan.Decisions[0].Replacement.Provider.OperatorID == plan.Decisions[1].Replacement.Provider.OperatorID { t.Fatal("replacement operator collision") }
	if plan.Decisions[0].Replacement.Provider.Geography == plan.Decisions[1].Replacement.Provider.Geography { t.Fatal("replacement geography collision") }
	for _, decision := range plan.Decisions {
		if decision.Replacement.Provider.Geography == "ca-central" { t.Fatal("failed geography reused") }
	}
}

func TestRegionalRecoveryNeverReturnsPartialBatch(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(21, "ap-south", 100),
	}}, RecoveryPolicy{})

	plan, err := planner.PlanRegionalRecovery(context.Background(), regionalRecoverySnapshot(), regionalRecoveryRequests(), RegionalRecoveryPolicy{})
	if !errors.Is(err, ErrRecoveryExhausted) { t.Fatalf("err=%v", err) }
	if len(plan.Decisions) != 0 { t.Fatalf("partial decisions=%v", plan.Decisions) }
}

func TestRegionalRecoveryFailsClosedWhenAffectedRequestMissing(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{geoSelection(21, "ap-south", 100)}}, RecoveryPolicy{})
	reqs := regionalRecoveryRequests()
	delete(reqs, "ingress")
	_, err := planner.PlanRegionalRecovery(context.Background(), regionalRecoverySnapshot(), reqs, RegionalRecoveryPolicy{})
	if !errors.Is(err, ErrRegionalRecoveryIncomplete) { t.Fatalf("err=%v", err) }
}

func TestRegionalRecoveryPreservesHealthyOccupiedOperators(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(13, "ap-south", 110),
		geoSelection(21, "ap-south", 100),
		geoSelection(22, "sa-east", 90),
	}}, RecoveryPolicy{})
	plan, err := planner.PlanRegionalRecovery(context.Background(), regionalRecoverySnapshot(), regionalRecoveryRequests(), RegionalRecoveryPolicy{})
	if err != nil { t.Fatal(err) }
	for _, decision := range plan.Decisions {
		if decision.Replacement.Provider.OperatorID == b32(13) || decision.Replacement.Provider.OperatorID == b32(14) {
			t.Fatal("healthy occupied operator reused")
		}
	}
}

func TestRegionalRecoveryCanExplicitlyShareHealthyReplacementGeography(t *testing.T) {
	planner := NewRecoveryPlanner(fakeRecoverySelector{selections: []discovery.Selection{
		geoSelection(21, "ap-south", 100),
		geoSelection(22, "ap-south", 90),
	}}, RecoveryPolicy{})
	plan, err := planner.PlanRegionalRecovery(context.Background(), regionalRecoverySnapshot(), regionalRecoveryRequests(), RegionalRecoveryPolicy{AllowSharedReplacementGeography: true})
	if err != nil { t.Fatal(err) }
	if len(plan.Decisions) != 2 { t.Fatalf("decisions=%d", len(plan.Decisions)) }
	if plan.Decisions[0].Replacement.Provider.OperatorID == plan.Decisions[1].Replacement.Provider.OperatorID { t.Fatal("operator collision") }
	if plan.Decisions[0].Replacement.Provider.Geography != "ap-south" || plan.Decisions[1].Replacement.Provider.Geography != "ap-south" { t.Fatalf("geographies=%q,%q", plan.Decisions[0].Replacement.Provider.Geography, plan.Decisions[1].Replacement.Provider.Geography) }
}
