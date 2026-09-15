package storage

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

type memoryRepairJournal struct{ events []RepairJobEvent }
func (m *memoryRepairJournal) AppendRepairEvent(_ context.Context, e RepairJobEvent) error { m.events = append(m.events, e); return nil }
func (m *memoryRepairJournal) RepairEvents(_ context.Context, jobID string) ([]RepairJobEvent, error) { out:=[]RepairJobEvent{}; for _,e:=range m.events{if equalHex(e.JobID,jobID){out=append(out,e)}}; return out,nil }

type journalWriterStub struct{ failStage string }
func (s *journalWriterStub) ReadRepairLifecycle(context.Context, RepairExecutionIntent)(RepairLifecycleState,error){return RepairLifecycleState{},nil}
func (s *journalWriterStub) EnsureAgreement(context.Context,RepairExecutionIntent)(string,error){if s.failStage=="agreement"{return "",errors.New("boom")};return hashWord(1),nil}
func (s *journalWriterStub) EnsureCommitment(context.Context,RepairExecutionIntent,string)(string,error){if s.failStage=="commitment"{return "",errors.New("boom")};return hashWord(2),nil}
func (s *journalWriterStub) EnsureCapacityReservation(context.Context,RepairExecutionIntent,string)(string,error){return hashWord(3),nil}
func (s *journalWriterStub) EnsureAgreementActive(context.Context,RepairExecutionIntent,string,string,string)error{return nil}
func (s *journalWriterStub) EnsureShardTransferred(context.Context,RepairExecutionIntent,string,string)error{return nil}
func (s *journalWriterStub) EnsurePlacementReplaced(context.Context,RepairExecutionIntent,string)error{return nil}

func repairJournalIntent() RepairExecutionIntent {
	return RepairExecutionIntent{ManifestID:hashWord(10),ObjectID:hashWord(11),ManifestHash:hashWord(12),DataShards:2,TotalShards:3,Shard:RepairShardRef{ShardIndex:1,AgreementID:hashWord(20),CommitmentID:hashWord(21),NodeID:hashWord(22),ShardRoot:hashWord(23),SizeBytes:64},Candidate:RepairProviderCandidate{OfferID:hashWord(30),NodeID:hashWord(31),ProviderID:hashWord(32),AvailableBytes:1024}}
}

func TestRepairJobIDDeterministic(t *testing.T){ a:=RepairJobID(hashWord(1),7); b:=RepairJobID(hashWord(1),7); c:=RepairJobID(hashWord(1),8); if a!=b||a==c{t.Fatalf("unexpected ids %s %s %s",a,b,c)} }

func TestRebuildRepairJobState(t *testing.T){ now:=time.Unix(100,0).UTC(); job:=RepairJobID(hashWord(1),2); events:=[]RepairJobEvent{{JobID:job,ManifestID:hashWord(1),ShardIndex:2,Stage:RepairStagePlanned,Attempt:1,At:now},{JobID:job,ManifestID:hashWord(1),ShardIndex:2,Stage:RepairStageAgreement,Attempt:1,AgreementID:hashWord(3),At:now.Add(time.Second)},{JobID:job,ManifestID:hashWord(1),ShardIndex:2,Stage:RepairStageFailed,Attempt:1,Error:"transfer: boom",At:now.Add(2*time.Second)},{JobID:job,ManifestID:hashWord(1),ShardIndex:2,Stage:RepairStageTransferred,Attempt:2,At:now.Add(3*time.Second)},{JobID:job,ManifestID:hashWord(1),ShardIndex:2,Stage:RepairStageReplaced,Attempt:2,At:now.Add(4*time.Second)}}; state,err:=RebuildRepairJobState(events); if err!=nil{t.Fatal(err)}; if !state.Complete||state.Attempt!=2||state.Stage!=RepairStageReplaced||state.LastError!=""{t.Fatalf("bad state %+v",state)} }

func TestFileRepairJournalRoundTrip(t *testing.T){ path:=filepath.Join(t.TempDir(),"repair","journal.jsonl"); j:=&FileRepairJournal{Path:path}; e:=RepairJobEvent{JobID:RepairJobID(hashWord(1),1),ManifestID:hashWord(1),ShardIndex:1,Stage:RepairStagePlanned,Attempt:1,At:time.Unix(50,0)}; if err:=j.AppendRepairEvent(context.Background(),e);err!=nil{t.Fatal(err)}; got,err:=j.RepairEvents(context.Background(),e.JobID);if err!=nil{t.Fatal(err)};if len(got)!=1||got[0].Stage!=RepairStagePlanned{t.Fatalf("bad events %+v",got)} }

func TestJournaledWriterRecordsFailureAndRetry(t *testing.T){ intent:=repairJournalIntent(); journal:=&memoryRepairJournal{}; inner:=&journalWriterStub{failStage:"agreement"}; w:=JournaledRepairLifecycleWriter{Inner:inner,Journal:journal,Now:func()time.Time{return time.Unix(100,0)}}; if _,err:=w.EnsureAgreement(context.Background(),intent);err==nil{t.Fatal("expected failure")}; if len(journal.events)!=1||journal.events[0].Stage!=RepairStageFailed||journal.events[0].Attempt!=1{t.Fatalf("bad first events %+v",journal.events)}; inner.failStage=""; if _,err:=w.EnsureAgreement(context.Background(),intent);err!=nil{t.Fatal(err)}; if len(journal.events)!=2||journal.events[1].Stage!=RepairStageAgreement||journal.events[1].Attempt!=2{t.Fatalf("bad retry events %+v",journal.events)} }

func TestJournalRejectsBackwardSuccessfulStage(t *testing.T){ now:=time.Now(); job:=RepairJobID(hashWord(1),1); _,err:=RebuildRepairJobState([]RepairJobEvent{{JobID:job,ManifestID:hashWord(1),ShardIndex:1,Stage:RepairStageCommitment,Attempt:1,At:now},{JobID:job,ManifestID:hashWord(1),ShardIndex:1,Stage:RepairStageAgreement,Attempt:1,At:now.Add(time.Second)}}); if err==nil{t.Fatal("expected backward stage rejection")} }
