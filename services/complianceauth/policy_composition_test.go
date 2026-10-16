package complianceauth
import("errors";"testing")
func TestC034ReviewedPolicyComposition(t *testing.T){
 makeRule:=func(scope,jur,outcome string)ComposedRequirement{return ComposedRequirement{Scope:scope,Jurisdiction:jur,RuleID:"rule-1",PolicyDigest:Digest([]byte("policy")),ReviewDigest:Digest([]byte("independent-review")),ReviewState:"INDEPENDENTLY_REVIEWED",Outcome:outcome}}
 input:=CompositionRequest{RequiredScopes:[]string{"retailer_license","recipient_age"},ApplicableJurisdictions:[]string{"CA","CA-BC"},Requirements:[]ComposedRequirement{
  makeRule("retailer_license","CA","ALLOW_CANDIDATE"),makeRule("retailer_license","CA-BC","ALLOW_CANDIDATE"),
  makeRule("recipient_age","CA","ALLOW_CANDIDATE"),makeRule("recipient_age","CA-BC","ALLOW_CANDIDATE")}}
 decision,err:=ComposeReviewedPolicy(input)
 if err!=nil||decision.Outcome!="REVIEWED_CANDIDATE_AUTHORIZATION_REQUIRED"||decision.PolicyAuthorized||len(decision.CoveredScopes)!=4{t.Fatalf("valid candidate %+v %v",decision,err)}
 t.Run("omission",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements[:3]...);d,e:=ComposeReviewedPolicy(x);if e!=nil||d.Outcome!="REVIEW_REQUIRED"||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
 t.Run("conflicting authority",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements...);x.Requirements=append(x.Requirements,makeRule("recipient_age","CA","DENY"));d,e:=ComposeReviewedPolicy(x);if e!=nil||d.Outcome!="DENY"||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
 t.Run("deny outranks all candidates",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements...);x.Requirements[0].Outcome="DENY";d,e:=ComposeReviewedPolicy(x);if e!=nil||d.Outcome!="DENY"{t.Fatalf("%+v %v",d,e)}})
 t.Run("unreviewed",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements...);x.Requirements[0].ReviewState="PENDING";d,e:=ComposeReviewedPolicy(x);if e!=nil||d.Outcome!="REVIEW_REQUIRED"||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
 t.Run("duplicate",func(t *testing.T){x:=input;x.Requirements=append(append([]ComposedRequirement(nil),input.Requirements...),input.Requirements[0]);d,e:=ComposeReviewedPolicy(x);if e!=nil||d.Outcome!="REVIEW_REQUIRED"{t.Fatalf("%+v %v",d,e)}})
 t.Run("unknown jurisdiction",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements...);x.Requirements[0].Jurisdiction="CA-ON";d,e:=ComposeReviewedPolicy(x);if !errors.Is(e,ErrCompositionInvalid)||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
 t.Run("missing review proof",func(t *testing.T){x:=input;x.Requirements=append([]ComposedRequirement(nil),input.Requirements...);x.Requirements[0].ReviewDigest="bad";d,e:=ComposeReviewedPolicy(x);if !errors.Is(e,ErrCompositionInvalid)||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
 t.Run("no scopes",func(t *testing.T){x:=input;x.RequiredScopes=nil;d,e:=ComposeReviewedPolicy(x);if !errors.Is(e,ErrCompositionInvalid)||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)}})
}
