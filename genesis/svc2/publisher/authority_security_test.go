package publisher

import (
 "context"
 "errors"
 "testing"
 "time"
)

func TestCandidateIDCannotBeHijacked(t *testing.T) {
 ctx:=context.Background();l,_:=NewLedger(&testAuth{true},&testSource{true},time.Now)
 c:=candidate();if err:=l.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 for _,mutate:=range []func(*Candidate){
  func(v *Candidate){v.Source.Namespace="different-provider"},
  func(v *Candidate){v.Source.RecordID="0002"},
  func(v *Candidate){v.Kind=Event},
  func(v *Candidate){v.ExpectedVersion=42},
 }{
  other:=c;mutate(&other)
  if err:=l.ImportCandidate(ctx,other);!errors.Is(err,ErrConflict){t.Fatalf("candidate identity takeover: %v",err)}
 }
 original,_:=l.Get(c.ID);if original.Candidate!=c || original.State!=Pending {t.Fatal("identity takeover changed original candidate")}
}

func TestAuthorizedWithdrawalSurvivesSourceRevocation(t *testing.T) {
 ctx:=context.Background();auth:=&testAuth{true};source:=&testSource{true}
 l,_:=NewLedger(auth,source,time.Now);c:=candidate()
 if err:=l.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 if _,err:=l.Decide(ctx,decision(c,Approve,0));err!=nil{t.Fatal(err)}
 source.qualified=false
 record,err:=l.Decide(ctx,decision(c,Withdraw,1));if err!=nil||record.State!=Withdrawn{t.Fatalf("revoked source prevented withdrawal: %v",err)}
 if err:=l.ImportCandidate(ctx,c);!errors.Is(err,ErrUntrustedSource){t.Fatalf("untrusted reimport: %v",err)}
 source.qualified=true
 if err:=l.ImportCandidate(ctx,c);!errors.Is(err,ErrConflict){t.Fatalf("withdrawn record revived: %v",err)}
}
