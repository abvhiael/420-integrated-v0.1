package complianceauth

import (
 "context"
 "errors"
 "strings"
 "testing"
 "time"
)
type c068Evaluator struct{decision C068ConsumerDecision;err error;onEvaluate func()}
func(e c068Evaluator)EvaluateForConsumer(context.Context,string,C064AuthorScope)(C068ConsumerDecision,error){
 if e.onEvaluate!=nil{e.onEvaluate()}
 return e.decision,e.err
}
func TestC068DOOBrTravelConsumerFailClosed(t *testing.T){
 now:=time.Now().UTC()
 for _,audience:=range []string{"DOOBr","420Travel"}{
  t.Run(audience,func(t *testing.T){
   scope:=C064AuthorScope{Tenant:"tenant1",Domain:"travel",Jurisdiction:"BC"}
   p:=&c068RemoteProvider{session:C068DeviceSession{SubjectID:"user1",SessionID:"session1",DeviceID:"phone1",Audience:audience,Scope:scope,ExpiresAt:now.Add(time.Hour)}}
   device:=C068DeviceGate{Authority:C068ExternalDeviceAuthority{Provider:p},Now:func()time.Time{return now}}
   d:=C068ConsumerDecision{Outcome:"ALLOW",Scope:scope,Audience:audience,EvidenceDigest:strings.Repeat("a",64)}
   gateway:=C068ConsumerGateway{Devices:device,Evaluator:c068Evaluator{decision:d}}
   token:="opaque-issuer-token"
   if _,err:=gateway.Check(context.Background(),token,"phone1",audience);err!=nil{t.Fatal(err)}
   for _,outcome:=range []string{"DENY","UNKNOWN","REVIEW_REQUIRED",""}{
    bad:=d;bad.Outcome=outcome;gateway.Evaluator=c068Evaluator{decision:bad}
    if _,err:=gateway.Check(context.Background(),token,"phone1",audience);!errors.Is(err,ErrC068ConsumerBlocked){t.Fatalf("non-ALLOW %s passed",outcome)}
   }
   gateway.Evaluator=c068Evaluator{decision:d,onEvaluate:func(){p.session.Revoked=true}}
   if _,err:=gateway.Check(context.Background(),token,"phone1",audience);!errors.Is(err,ErrC068ConsumerBlocked){t.Fatal("revocation during evaluation bypassed")}
   p.session.Revoked=false
   gateway.Evaluator=c068Evaluator{decision:d}
   if _,err:=gateway.Check(context.Background(),token,"phone1",map[string]string{"DOOBr":"420Travel","420Travel":"DOOBr"}[audience]);!errors.Is(err,ErrC068ConsumerBlocked){t.Fatal("cross-app replay permitted")}
   stale:=d;stale.EvidenceDigest=""
   gateway.Evaluator=c068Evaluator{decision:stale}
   if _,err:=gateway.Check(context.Background(),token,"phone1",audience);!errors.Is(err,ErrC068ConsumerBlocked){t.Fatal("missing decision evidence permitted")}
  })
 }
}
