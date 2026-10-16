package complianceauth

import (
 "context"
 "testing"
 "time"
)
func TestC042AuthorizedLifecycleIntegration(t *testing.T){
 now:=time.Date(2026,10,10,22,0,0,0,time.UTC)
 digest:=Digest([]byte("draft-policy"))
 lifecycle,err:=NewPolicyLifecycle("document",digest,"author");if err!=nil{t.Fatal(err)}
 valid:=func(subject,role,session string)c042Authority{return c042Authority{
  grant:ReviewerGrant{SubjectID:subject,DelegatedBy:"legal-admin",Role:role,Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),QualificationExpiresAt:now.Add(time.Hour)},
  session:ReviewerSession{SubjectID:subject,SessionID:session,Audience:"420compliance-review",IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),AuthenticatedAt:now.Add(-time.Minute),MFAAuthenticatedAt:now.Add(-time.Minute)},
 }}
 srv:=AuthorizedReviewTransition{Lifecycle:lifecycle,Authority:valid("reviewer","reviewer","review-session"),Domain:"delivery",Jurisdiction:"BC"}
 if err:=srv.Apply(context.Background(),LifecycleReviewed,"author","review-session",now,1);err==nil{t.Fatal("author reviewed own policy")}
 if err:=srv.Apply(context.Background(),LifecycleReviewed,"reviewer","review-session",now,1);err!=nil{t.Fatal(err)}
 if err:=srv.Apply(context.Background(),LifecycleReviewed,"reviewer","review-session",now,1);err==nil{t.Fatal("replay accepted")}
 if err:=srv.Apply(context.Background(),LifecycleApproved,"reviewer","review-session",now,2);err==nil{t.Fatal("reviewer self-approved")}
 srv.Authority=valid("approver","approver","approve-session")
 if err:=srv.Apply(context.Background(),LifecycleApproved,"approver","approve-session",now,2);err!=nil{t.Fatal(err)}
 r,events:=lifecycle.Snapshot();if r.State!=LifecycleApproved||r.ReviewerID!="reviewer"||r.ApproverID!="approver"||len(events)!=2{t.Fatalf("bad lifecycle %+v",r)}
 for _,bad:=range []struct{name string;auth c042Authority}{
  {"outage",c042Authority{fail:true}},
  {"revoked",func()c042Authority{a:=valid("reviewer","reviewer","review-session");a.session.Revoked=true;return a}()},
  {"content mutated",func()c042Authority{a:=valid("reviewer","reviewer","review-session");a.grant.PolicyDigest=Digest([]byte("different"));return a}()},
  {"expired qualification",func()c042Authority{a:=valid("reviewer","reviewer","review-session");a.grant.QualificationExpiresAt=now;return a}()},
 } {
  other,_:=NewPolicyLifecycle("independent-"+bad.name,digest,"author")
  probe:=AuthorizedReviewTransition{Lifecycle:other,Authority:bad.auth,Domain:"delivery",Jurisdiction:"BC"}
  if err:=probe.Apply(context.Background(),LifecycleReviewed,"reviewer","review-session",now,1);err==nil{t.Fatalf("%s authorized",bad.name)}
  current,history:=other.Snapshot();if current.State!=LifecycleDraft||len(history)!=0{t.Fatalf("%s mutated without authority",bad.name)}
 }
}
