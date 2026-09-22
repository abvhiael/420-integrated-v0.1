package publisher

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "testing"
 "time"
)

type testAuth struct{ allowed bool }
func (a *testAuth) Authorize(_ context.Context,_ string,_ Action,_ Kind)error{if !a.allowed{return errors.New("no operator grant")};return nil}
type testSource struct{ qualified bool }
func (s *testSource) VerifySource(_ context.Context,_ SourceEvidence,_ Kind)error{if !s.qualified{return errors.New("revoked source")};return nil}
func digest(s string)string{v:=sha256.Sum256([]byte(s));return hex.EncodeToString(v[:])}
func candidate() Candidate{return Candidate{ID:"internal-place-1",Kind:Place,Source:SourceEvidence{Namespace:"provider-A",RecordID:"0001",Revision:"v1",ManifestID:"manifest-1",TermsRef:"terms-1",AttributionRef:"attribution-1",RetrievedAt:time.Date(2026,9,21,0,0,0,0,time.UTC),PayloadSHA256:digest("raw")},NormalizedSHA256:digest("normalized"),ExpectedVersion:0}}
func decision(c Candidate,a Action,version uint64)Decision{return Decision{CandidateID:c.ID,CandidateSHA256:c.NormalizedSHA256,Action:a,OperatorID:"reviewer",PolicyVersion:"p1",Reason:"explicit operator review",ExpectedDecisionVersion:version}}
func TestFailClosedConfigurationAndUnqualifiedImport(t *testing.T){
 clock:=func()time.Time{return time.Date(2026,9,21,1,0,0,0,time.UTC)}
 if _,err:=NewLedger(nil,&testSource{true},clock);err==nil{t.Fatal("nil authorizer accepted")}
 if _,err:=NewLedger(&testAuth{true},nil,clock);err==nil{t.Fatal("nil verifier accepted")}
 if _,err:=NewLedger(&testAuth{true},&testSource{true},nil);err==nil{t.Fatal("nil clock accepted")}
 s:=&testSource{};l,_:=NewLedger(&testAuth{true},s,clock)
 if err:=l.ImportCandidate(context.Background(),candidate());!errors.Is(err,ErrUntrustedSource){t.Fatalf("untrusted import: %v",err)}
 if _,ok:=l.Get(candidate().ID);ok{t.Fatal("untrusted import recorded")}
 bad:=candidate();bad.Source.TermsRef="";s.qualified=true
 if err:=l.ImportCandidate(context.Background(),bad);!errors.Is(err,ErrInvalid){t.Fatalf("invalid provenance: %v",err)}
}
func TestApprovalRevisionWithdrawalAndTombstone(t *testing.T){
 ctx:=context.Background();auth:=&testAuth{};sources:=&testSource{true}
 l,_:=NewLedger(auth,sources,func()time.Time{return time.Date(2026,9,21,1,0,0,0,time.UTC)})
 c:=candidate();if err:=l.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 r,_:=l.Get(c.ID);if r.State!=Pending{t.Fatal("import became public")}
 if _,err:=l.Decide(ctx,decision(c,Approve,0));!errors.Is(err,ErrUnauthorized){t.Fatalf("unauthorized approval: %v",err)}
 auth.allowed=true;sources.qualified=false
 if _,err:=l.Decide(ctx,decision(c,Approve,0));!errors.Is(err,ErrUntrustedSource){t.Fatalf("revoked source approved: %v",err)}
 sources.qualified=true
 r,err:=l.Decide(ctx,decision(c,Approve,0));if err!=nil||r.State!=Approved{t.Fatalf("approval: %v, %+v",err,r)}
 if _,err:=l.Decide(ctx,decision(c,Approve,0));!errors.Is(err,ErrConflict){t.Fatalf("replayed approval: %v",err)}
 revised:=c;revised.Source.Revision="v2";revised.NormalizedSHA256=digest("normalized-v2")
 if err:=l.ImportCandidate(ctx,revised);err!=nil{t.Fatal(err)}
 r,_=l.Get(c.ID);if r.State!=Pending||r.DecisionVersion!=2{t.Fatalf("revision did not invalidate approval: %+v",r)}
 if _,err:=l.Decide(ctx,decision(c,Approve,2));!errors.Is(err,ErrConflict){t.Fatalf("old digest approved: %v",err)}
 r,err=l.Decide(ctx,decision(revised,Approve,2));if err!=nil||r.State!=Approved{t.Fatalf("reapproval: %v",err)}
 r,err=l.Decide(ctx,decision(revised,Withdraw,3));if err!=nil||r.State!=Withdrawn{t.Fatalf("withdrawal: %v",err)}
 if err:=l.ImportCandidate(ctx,revised);!errors.Is(err,ErrConflict){t.Fatalf("tombstone revived by import: %v",err)}
 if _,err:=l.Decide(ctx,decision(revised,Approve,4));!errors.Is(err,ErrConflict){t.Fatalf("tombstone approved: %v",err)}
 if got:=len(l.History());got!=3{t.Fatalf("expected 3 decisions, got %d",got)}
}
func TestRejectionAndUnknownRecord(t *testing.T){
 ctx:=context.Background();l,_:=NewLedger(&testAuth{true},&testSource{true},time.Now)
 c:=candidate();if _,err:=l.Decide(ctx,decision(c,Approve,0));!errors.Is(err,ErrNotFound){t.Fatal(err)}
 if err:=l.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 r,err:=l.Decide(ctx,decision(c,Reject,0));if err!=nil||r.State!=Rejected{t.Fatalf("reject: %v",err)}
 if err:=l.ImportCandidate(ctx,c);!errors.Is(err,ErrConflict){t.Fatalf("rejected record reimported: %v",err)}
}
