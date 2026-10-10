package complianceauth
import("errors";"testing";"time")
func TestSourceHealthNeverRenewsReview(t *testing.T){
 now:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 baseline:=SourceHealthInput{SourceID:"FED-ACT",CollectedAt:now,LastSuccessfulAt:now,ReviewExpiresAt:now.Add(time.Hour),ReviewedPolicyDigest:Digest([]byte("reviewed")),MaxSourceAge:time.Hour}
 ok,err:=AssessSourceHealth(baseline,now)
 if err!=nil||ok.MayAuthorize||ok.ReviewRenewed||ok.Status!="SOURCE_HEALTHY_REVIEW_CURRENT_AUTHORIZATION_UNPROVEN"{t.Fatalf("healthy check incorrectly authorized: %+v %v",ok,err)}
 cases:=[]struct{name,reason string;change func(*SourceHealthInput)}{
 {"collection failed","COLLECTION_FAILED",func(x *SourceHealthInput){x.CollectionFailed=true}},
 {"disappeared","SOURCE_DISAPPEARED",func(x *SourceHealthInput){x.SourceMissing=true}},
 {"unreadable","UNREADABLE_UPDATE",func(x *SourceHealthInput){x.UnreadableUpdate=true}},
 {"stale","SOURCE_STALE",func(x *SourceHealthInput){x.LastSuccessfulAt=now.Add(-2*time.Hour)}},
 {"expired independent review","LEGAL_REVIEW_EXPIRED",func(x *SourceHealthInput){x.ReviewExpiresAt=now}},
 {"missing independent review","LEGAL_REVIEW_EXPIRED",func(x *SourceHealthInput){x.ReviewExpiresAt=time.Time{}}},
 {"invalid review digest","REVIEW_EVIDENCE_MISSING",func(x *SourceHealthInput){x.ReviewedPolicyDigest="bad"}},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){x:=baseline;tc.change(&x);got,err:=AssessSourceHealth(x,now);if err!=nil||got.MayAuthorize||got.ReviewRenewed||got.Escalation!="BLOCK_TRANSACTION_AND_ESCALATE_TO_SOURCE_OWNER_AND_INDEPENDENT_REVIEWER"{t.Fatalf("unsafe health %+v %v",got,err)};found:=false;for _,r:=range got.Reasons{if r==tc.reason{found=true}};if !found{t.Fatalf("expected %s got %+v",tc.reason,got.Reasons)}})}
 expired:=baseline;expired.ReviewExpiresAt=now.Add(-time.Minute);expired.LastSuccessfulAt=now
 got,err:=AssessSourceHealth(expired,now);if err!=nil||got.MayAuthorize||got.ReviewRenewed{t.Fatal("successful fetch renewed expired legal review")}
 invalid:=baseline;invalid.MaxSourceAge=0
 if _,err:=AssessSourceHealth(invalid,now);!errors.Is(err,ErrInvalidSourceHealth){t.Fatal("invalid freshness policy accepted")}
}
