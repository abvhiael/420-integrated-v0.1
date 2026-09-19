package lifecycle

import (
	"strings"
	"testing"
	"time"
)

func TestSubmissionIntentBlocksDuplicateAndCompletes(t *testing.T){
	s:=NewStore()
	h:="0x"+strings.Repeat("11",32)
	tx:="0x"+strings.Repeat("22",32)
	ep:="0x4444444444444444444444444444444444444444"
	now:=time.Unix(100,0)
	if err:=s.BeginSubmission(h,ep,now);err!=nil{t.Fatal(err)}
	if !s.HasSubmissionOrPending(h){t.Fatal("intent not visible")}
	if err:=s.BeginSubmission(h,ep,now.Add(time.Second));err!=nil{t.Fatal(err)}
	if err:=s.RecordSubmission(h,tx,ep,now.Add(time.Second));err!=nil{t.Fatal(err)}
	if !s.HasSubmissionOrPending(h){t.Fatal("completed submission not visible")}
	snap:=s.SnapshotRecovery()
	if len(snap.Pending)!=0 || len(snap.Submissions)!=1{t.Fatalf("unexpected snapshot %+v",snap)}
}

func TestRecoverySnapshotRoundTripAndRejectsAmbiguity(t *testing.T){
	s:=NewStore()
	h1:="0x"+strings.Repeat("11",32)
	h2:="0x"+strings.Repeat("22",32)
	tx:="0x"+strings.Repeat("33",32)
	ep:="0x4444444444444444444444444444444444444444"
	now:=time.Unix(100,0)
	if err:=s.BeginSubmission(h1,ep,now);err!=nil{t.Fatal(err)}
	if err:=s.RecordSubmission(h2,tx,ep,now);err!=nil{t.Fatal(err)}
	snap:=s.SnapshotRecovery()
	restored:=NewStore()
	if err:=restored.RestoreRecovery(snap);err!=nil{t.Fatal(err)}
	if !restored.HasSubmissionOrPending(h1)||!restored.HasSubmissionOrPending(h2){t.Fatal("round trip lost recovery state")}
	bad:=RecoverySnapshot{Pending:[]PendingSubmission{{UserOpHash:h1,EntryPoint:ep,StartedAt:now}},Submissions:[]Submission{{UserOpHash:h1,TransactionHash:tx,EntryPoint:ep,SubmittedAt:now}}}
	if err:=restored.RestoreRecovery(bad);err==nil{t.Fatal("accepted ambiguous recovery state")}
}
