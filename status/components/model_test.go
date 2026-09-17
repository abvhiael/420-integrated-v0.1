package components

import "testing"

func TestGenesisClassesAreValid(t *testing.T) {
	classes := []Class{ClassConsensus, ClassExecution, ClassRPC, ClassIndexer, ClassExplorer, ClassSearch, ClassAnalytics, ClassStorage, ClassAI, ClassOracle, ClassBridge, ClassWallet, ClassDApp}
	for _, class := range classes {
		if !ValidClass(class) { t.Fatalf("expected valid class %q", class) }
	}
	if ValidClass("database") { t.Fatal("unexpected class accepted") }
}

func TestHealthModelSeparatesLivenessReadinessAndPresentation(t *testing.T) {
	c := Component{ID:"rpc-primary", Name:"Primary RPC", Class:ClassRPC, Network:"420-testnet", Environment:"testnet", Public:true}
	cases := []struct{
		name string
		s Snapshot
		ok bool
	}{
		{"healthy", Snapshot{Component:c, Live:true, Ready:true, Health:HealthHealthy}, true},
		{"live-unready-degraded", Snapshot{Component:c, Live:true, Ready:false, Health:HealthDegraded, Reason:"backend lag"}, true},
		{"healthy-not-ready", Snapshot{Component:c, Live:true, Ready:false, Health:HealthHealthy}, false},
		{"healthy-not-live", Snapshot{Component:c, Live:false, Ready:true, Health:HealthHealthy}, false},
		{"maintenance-reason", Snapshot{Component:c, Live:true, Ready:false, Health:HealthMaintenance, Reason:"scheduled upgrade"}, true},
		{"maintenance-no-reason", Snapshot{Component:c, Live:true, Ready:false, Health:HealthMaintenance}, false},
		{"authoritative-forbidden", Snapshot{Component:c, Live:true, Ready:true, Health:HealthHealthy, Authoritative:true}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.s.Validate()
			if tc.ok && err != nil { t.Fatalf("unexpected error: %v", err) }
			if !tc.ok && err == nil { t.Fatal("expected validation error") }
		})
	}
}

func TestRegistryRejectsDuplicateAndListsDeterministically(t *testing.T) {
	r := NewRegistry()
	items := []Component{
		{ID:"wallet", Name:"420 Wallet", Class:ClassWallet, Network:"420-testnet", Environment:"testnet", Public:true},
		{ID:"consensus", Name:"fourtwentyd", Class:ClassConsensus, Network:"420-testnet", Environment:"testnet", Public:true},
		{ID:"indexer", Name:"420Indexer", Class:ClassIndexer, Network:"420-testnet", Environment:"testnet", Public:true},
	}
	for _, item := range items { if err := r.Register(item); err != nil { t.Fatal(err) } }
	if err := r.Register(items[0]); err == nil { t.Fatal("expected duplicate registration failure") }
	got := r.List()
	if len(got) != 3 { t.Fatalf("expected 3 components, got %d", len(got)) }
	want := []string{"consensus","indexer","wallet"}
	for i := range want { if got[i].ID != want[i] { t.Fatalf("unexpected order: %+v", got) } }
}
