package complianceauth
import("errors";"testing";"time")
func TestProvisionNormalizationLegalStatus(t *testing.T){
 at:=time.Date(2026,10,10,12,0,0,0,time.UTC)
 s:=ProvisionSource{SourceID:"FED-ACT",SourceDigest:Digest([]byte("source")),Locator:"s.1",InstrumentID:"CannabisAct",OriginalText:"Original  operative\n wording",Status:StatusInForce,EffectiveFrom:at.Add(-time.Hour),StatusAuthorityRef:"official-commencement-evidence"}
 got,err:=NormalizeProvisions(s,nil,at)
 if err!=nil||!got.EligibleForPolicy||got.OriginalText!=s.OriginalText||got.NormalizedText!="Original operative wording"{t.Fatalf("base: %+v %v",got,err)}
 amend:=AmendmentSource{AmendmentID:"bill-1",ReplacesLocator:"s.1",OriginalText:"Proposed replacement wording",SourceDigest:Digest([]byte("bill")),Status:StatusBill,StatusAuthorityRef:"parliament-bill"}
 got,err=NormalizeProvisions(s,[]AmendmentSource{amend},at)
 if err!=nil||got.NormalizedText!="Original operative wording"||len(got.Amendments)!=1||got.Amendments[0].OriginalText!=amend.OriginalText{t.Fatalf("bill changed operative text: %+v %v",got,err)}
 amend.Status=StatusProposal
 got,err=NormalizeProvisions(s,[]AmendmentSource{amend},at)
 if err!=nil||got.NormalizedText!="Original operative wording"{t.Fatal("proposal changed law",err)}
 amend.Status=StatusEnactedNotInForce
 got,err=NormalizeProvisions(s,[]AmendmentSource{amend},at)
 if err!=nil||got.NormalizedText!="Original operative wording"{t.Fatal("not commenced changed law",err)}
 amend.Status=StatusInForce;amend.EffectiveFrom=at.Add(-time.Minute)
 got,err=NormalizeProvisions(s,[]AmendmentSource{amend},at)
 if err!=nil||got.NormalizedText!="Proposed replacement wording"||!got.EligibleForPolicy{t.Fatalf("effective amendment: %+v %v",got,err)}
 amend.EffectiveFrom=at.Add(time.Hour)
 if _,err=NormalizeProvisions(s,[]AmendmentSource{amend},at);!errors.Is(err,ErrUnverifiedLegalStatus){t.Fatal("future amendment activated")}
 s.Status=StatusBill
 got,err=NormalizeProvisions(s,nil,at)
 if err!=nil||got.EligibleForPolicy{t.Fatal("bill activated")}
 s.Status=StatusUnknown
 got,err=NormalizeProvisions(s,nil,at)
 if err!=nil||got.EligibleForPolicy{t.Fatal("unknown activated")}
 s.Status=StatusInForce;s.StatusAuthorityRef=""
 if _,err=NormalizeProvisions(s,nil,at);!errors.Is(err,ErrUnverifiedLegalStatus){t.Fatal("unverified status passed")}
 s.StatusAuthorityRef="official";s.SourceDigest="tampered"
 if _,err=NormalizeProvisions(s,nil,at);!errors.Is(err,ErrUnverifiedLegalStatus){t.Fatal("bad digest passed")}
}
