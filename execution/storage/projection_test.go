package storage

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

type fakeCanonicalReader struct {
	snapshots map[string]AssignmentSnapshot
	windows map[string]map[uint32]struct{ ch Challenge; deadline time.Time }
}

func (f fakeCanonicalReader) AssignmentByAgreement(_ context.Context, id string) (AssignmentSnapshot,error) {
	s, ok := f.snapshots[id]
	if !ok { return AssignmentSnapshot{}, ErrInactiveAssignment }
	return s,nil
}
func (f fakeCanonicalReader) Window(_ context.Context, id string, idx uint32) (Challenge,time.Time,error) {
	byAgreement, ok := f.windows[id]
	if !ok { return Challenge{},time.Time{},ErrProjectionState }
	w, ok := byAgreement[idx]
	if !ok { return Challenge{},time.Time{},ErrProjectionState }
	return w.ch,w.deadline,nil
}

func projectionFixture(t *testing.T) (*StorageProjection,fakeCanonicalReader) {
	t.Helper()
	start := time.Unix(1_800_000_000,0).UTC()
	a := Assignment{AgreementID:"0xaaa",CommitmentID:"0xccc",NodeID:"0xnnn",ShardRoot:"root",SizeBytes:10,StartTime:start,EndTime:start.Add(2*time.Hour),Active:true}
	reader := fakeCanonicalReader{
		snapshots: map[string]AssignmentSnapshot{"0xaaa":{Assignment:a,WindowCount:2,NextWindow:0}},
		windows: map[string]map[uint32]struct{ ch Challenge; deadline time.Time }{
			"0xaaa":{
				0:{ch:Challenge{AgreementID:"0xaaa",CommitmentID:"0xccc",ChallengeID:"0xch0",Epoch:start.Add(time.Hour)},deadline:start.Add(70*time.Minute)},
				1:{ch:Challenge{AgreementID:"0xaaa",CommitmentID:"0xccc",ChallengeID:"0xch1",Epoch:start.Add(2*time.Hour)},deadline:start.Add(130*time.Minute)},
			},
		},
	}
	state, err := NewFileProjectionStateStore(filepath.Join(t.TempDir(),"projection.json"))
	if err != nil { t.Fatal(err) }
	p, err := NewStorageProjection(StorageContracts{Agreement:"0xagreement",Settlement:"0xsettlement"},StorageEventTopics{AgreementActivated:"0xactivated",AgreementCompleted:"0xcompleted",AgreementCancelled:"0xcancelled",SettlementOpened:"0xopened",SettlementCompleted:"0xsettled",SettlementCancelled:"0xsetcancel"},reader,state)
	if err != nil { t.Fatal(err) }
	return p,reader
}

func TestProjectionHydratesCanonicalAssignmentOnActivation(t *testing.T) {
	p,_ := projectionFixture(t)
	log := ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa","0xccc","0xnnn"},BlockHash:"0x1"}
	if err := p.Apply(context.Background(),log); err != nil { t.Fatal(err) }
	a, err := p.Assignment(context.Background(),"0xccc")
	if err != nil { t.Fatal(err) }
	if a.AgreementID != "0xaaa" || a.NodeID != "0xnnn" || !a.Active { t.Fatalf("assignment=%+v",a) }
}

func TestProjectionRejectsActivationThatDisagreesWithCanonicalRead(t *testing.T) {
	p,_ := projectionFixture(t)
	log := ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa","0xbad","0xnnn"},BlockHash:"0x1"}
	if err := p.Apply(context.Background(),log); !errors.Is(err,ErrInvalidChainState) { t.Fatalf("got %v",err) }
}

func TestProjectionDeactivatesCompletedAgreementAndPersists(t *testing.T) {
	p,reader := projectionFixture(t)
	ctx := context.Background()
	if err := p.Apply(ctx,ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa","0xccc","0xnnn"},BlockHash:"0x1"}); err != nil { t.Fatal(err) }
	if err := p.Apply(ctx,ChainLog{Address:"0xagreement",Topics:[]string{"0xcompleted","0xaaa"},BlockHash:"0x2"}); err != nil { t.Fatal(err) }
	if _, err := p.Assignment(ctx,"0xccc"); !errors.Is(err,ErrInactiveAssignment) { t.Fatalf("got %v",err) }
	state, err := NewFileProjectionStateStore(filepath.Join(filepath.Dir(p.State.(*FileProjectionStateStore).path),"projection.json"))
	if err != nil { t.Fatal(err) }
	p2, err := NewStorageProjection(p.Contracts,p.Topics,reader,state)
	if err != nil { t.Fatal(err) }
	if _, err := p2.Assignment(ctx,"0xccc"); !errors.Is(err,ErrInactiveAssignment) { t.Fatalf("restart got %v",err) }
}

func TestSettlementOpenAttachesSettlementIDFromCanonicalAgreement(t *testing.T) {
	p,_ := projectionFixture(t)
	ctx := context.Background()
	if err := p.Apply(ctx,ChainLog{Address:"0xsettlement",Topics:[]string{"0xopened","0xsettlement1","0xaaa","0xconsumer"},BlockHash:"0x3"}); err != nil { t.Fatal(err) }
	p.mu.RLock(); got := p.snapshots["0xaaa"].SettlementID; p.mu.RUnlock()
	if got != "0xsettlement1" { t.Fatalf("settlement=%s",got) }
}

func TestProofSchedulerOnlyReturnsOpenCanonicalWindowAndAdvances(t *testing.T) {
	p,_ := projectionFixture(t)
	ctx := context.Background()
	if err := p.Apply(ctx,ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa","0xccc","0xnnn"},BlockHash:"0x1"}); err != nil { t.Fatal(err) }
	s := ProofScheduler{Projection:p}
	before := time.Unix(1_800_000_000,0).UTC().Add(59*time.Minute)
	if due,err := s.Due(ctx,before); err != nil || len(due)!=0 { t.Fatalf("before due=%v err=%v",due,err) }
	now := time.Unix(1_800_000_000,0).UTC().Add(65*time.Minute)
	due, err := s.Due(ctx,now)
	if err != nil { t.Fatal(err) }
	if len(due)!=1 || due[0].WindowIndex!=0 || due[0].Challenge.ChallengeID!="0xch0" { t.Fatalf("due=%+v",due) }
	if err := s.MarkSubmitted(ctx,due[0]); err != nil { t.Fatal(err) }
	if due,err := s.Due(ctx,now); err != nil || len(due)!=0 { t.Fatalf("after due=%v err=%v",due,err) }
}

func TestProjectionResetClearsRuntimeAuthority(t *testing.T) {
	p,_ := projectionFixture(t)
	ctx := context.Background()
	if err := p.Apply(ctx,ChainLog{Address:"0xagreement",Topics:[]string{"0xactivated","0xaaa","0xccc","0xnnn"},BlockHash:"0x1"}); err != nil { t.Fatal(err) }
	if err := p.Reset(ctx,10); err != nil { t.Fatal(err) }
	if _,err := p.Assignment(ctx,"0xccc"); !errors.Is(err,ErrInactiveAssignment) { t.Fatalf("got %v",err) }
}
