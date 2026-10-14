package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c042Authority struct{ grant ReviewerGrant; session ReviewerSession; fail bool }
func(a c042Authority) VerifyReviewerGrant(_ context.Context,_,_,_ string)(ReviewerGrant,error){if a.fail{return ReviewerGrant{},errors.New("outage")};return a.grant,nil}
func(a c042Authority) VerifyReviewerSession(_ context.Context,_ string)(ReviewerSession,error){if a.fail{return ReviewerSession{},errors.New("outage")};return a.session,nil}
func TestC042ReviewerQualificationDelegationMFAAndInvalidation(t *testing.T){
 ctx:=context.Background()
 now:=time.Date(2026,10,10,22,0,0,0,time.UTC)
 digest:=Digest([]byte("original-reviewed-content"))
 request:=ReviewAuthorizationRequest{ReviewerID:"reviewer",AuthorID:"author",ApproverID:"approver",PublisherID:"publisher",SessionID:"session",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,Role:"reviewer",Now:now}
 authority:=c042Authority{grant:ReviewerGrant{SubjectID:"reviewer",DelegatedBy:"delegator",Role:"reviewer",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),QualificationExpiresAt:now.Add(time.Hour)},session:ReviewerSession{SubjectID:"reviewer",SessionID:"session",Audience:"420compliance-review",IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),AuthenticatedAt:now.Add(-time.Minute),MFAAuthenticatedAt:now.Add(-time.Minute)}}
 check:=func(label string,a c042Authority,r ReviewAuthorizationRequest,allowed bool){t.Helper();out,err:=AuthorizeReview(ctx,a,r);if (err==nil)!=allowed{t.Fatalf("%s authorization=%+v error=%v",label,out,err)};if allowed&&(out.ReviewerID!=r.ReviewerID||out.PolicyDigest!=r.PolicyDigest||!out.ValidUntil.After(now)){t.Fatalf("%s invalid bound authorization %+v",label,out)}}
 check("valid independent reviewer",authority,request,true)
 a:=authority;a.grant.Revoked=true;check("revoked delegation",a,request,false)
 a=authority;a.session.Revoked=true;check("revoked session",a,request,false)
 a=authority;a.grant.QualificationExpiresAt=now;check("expired qualifications",a,request,false)
 a=authority;a.grant.Role="publisher";check("least privilege role",a,request,false)
 a=authority;a.grant.Domain="travel";check("cross domain",a,request,false)
 a=authority;a.grant.Jurisdiction="ON";check("cross jurisdiction",a,request,false)
 a=authority;a.grant.DelegatedBy="author";check("author cannot delegate",a,request,false)
 a=authority;a.grant.DelegatedBy="reviewer";check("self delegation",a,request,false)
 a=authority;a.session.SubjectID="author";check("session impersonation",a,request,false)
 a=authority;a.session.Audience="another-app";check("wrong audience",a,request,false)
 a=authority;a.session.ExpiresAt=now;check("expired session",a,request,false)
 a=authority;a.session.ExpiresAt=now.Add(20*time.Minute);check("long lived session",a,request,false)
 a=authority;a.session.MFAAuthenticatedAt=now.Add(-6*time.Minute);check("stale MFA",a,request,false)
 a=authority;a.session.MFAAuthenticatedAt=time.Time{};check("missing MFA",a,request,false)
 a=authority;a.session.MFAAuthenticatedAt=now.Add(time.Second);check("future MFA",a,request,false)
 a=authority;a.grant.PolicyDigest=Digest([]byte("tampered"));check("content mismatch",a,request,false)
 r:=request;r.PolicyDigest=Digest([]byte("changed reviewed content"));check("approval invalid after edit",authority,r,false)
 r=request;r.ReviewerID="author";check("self review",authority,r,false)
 check("independent authority outage",c042Authority{fail:true},request,false)
 if _,err:=AuthorizeReview(ctx,nil,request);err==nil{t.Fatal("missing authority accepted")}
 cancelled,cancel:=context.WithCancel(ctx);cancel()
 if _,err:=AuthorizeReview(cancelled,authority,request);err==nil{t.Fatal("cancelled authority accepted")}
}
