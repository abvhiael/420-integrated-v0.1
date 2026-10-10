package complianceauth
import("errors";"testing";"time")
func TestC033TemporalLegalAndKnowledgeTime(t *testing.T){
 at:=time.Date(2026,3,8,10,30,0,0,time.UTC) // PDT 03:30, skipped 02:30 local
 v:=TemporalVersion{EvidenceID:"old",SourceDigest:Digest([]byte("old")),RecordedAt:at.Add(-72*time.Hour),EffectiveFrom:at.Add(-96*time.Hour)}
 q:=TemporalRequest{At:at,KnowledgeAt:at,Timezone:"America/Vancouver",StartLocal:"03:00",EndLocal:"05:00",Versions:[]TemporalVersion{v}}
 got,err:=EvaluateTemporalApplicability(q)
 if err!=nil||got.State!="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"||got.PolicyAuthorized||got.LocalTime==""{t.Fatalf("DST spring %+v %v",got,err)}
 t.Run("before commencement",func(t *testing.T){x:=q;x.Versions=[]TemporalVersion{v};x.Versions[0].EffectiveFrom=at.Add(time.Minute);d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="NOT_OPERATIVE"{t.Fatalf("%+v %v",d,e)}})
 t.Run("repeal",func(t *testing.T){x:=q;x.Versions=[]TemporalVersion{v};x.Versions[0].RepealedAt=at;d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="NOT_OPERATIVE"{t.Fatalf("%+v %v",d,e)}})
 t.Run("expiry",func(t *testing.T){x:=q;x.Versions=[]TemporalVersion{v};x.Versions[0].EffectiveUntil=at;d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="NOT_OPERATIVE"{t.Fatalf("%+v %v",d,e)}})
 t.Run("historical knowledge",func(t *testing.T){x:=q;x.KnowledgeAt=at.Add(-time.Hour);x.Versions=[]TemporalVersion{v,{EvidenceID:"new",SourceDigest:Digest([]byte("new")),RecordedAt:at,EffectiveFrom:at.Add(-time.Hour)}};d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.EvidenceID!="old"{t.Fatalf("future discovery leaks into history %+v %v",d,e)}})
 t.Run("fall back repeated clock time",func(t *testing.T){x:=q;x.At=time.Date(2026,11,1,8,30,0,0,time.UTC);x.KnowledgeAt=x.At;x.StartLocal="01:00";x.EndLocal="02:00";d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"||d.PolicyAuthorized{t.Fatalf("%+v %v",d,e)};x.At=x.At.Add(time.Hour);d,e=EvaluateTemporalApplicability(x);if e!=nil||d.State!="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"||d.PolicyAuthorized{t.Fatalf("second 01:30 %+v %v",d,e)}})
 t.Run("overnight",func(t *testing.T){x:=q;x.StartLocal="22:00";x.EndLocal="04:00";x.Overnight=true;d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"{t.Fatalf("%+v %v",d,e)}})
 t.Run("closed hours",func(t *testing.T){x:=q;x.StartLocal="09:00";x.EndLocal="17:00";d,e:=EvaluateTemporalApplicability(x);if e!=nil||d.State!="OUTSIDE_LOCAL_HOURS"{t.Fatalf("%+v %v",d,e)}})
 bad:=[]TemporalRequest{}
 x:=q;x.Timezone="Unknown/Zone";bad=append(bad,x)
 x=q;x.StartLocal="25:00";bad=append(bad,x)
 x=q;x.Overnight=true;bad=append(bad,x)
 x=q;x.Versions=[]TemporalVersion{v,v};bad=append(bad,x)
 x=q;x.KnowledgeAt=v.RecordedAt.Add(-time.Second);bad=append(bad,x)
 for _,tc:=range bad{d,e:=EvaluateTemporalApplicability(tc);if !errors.Is(e,ErrTemporalUncertain)||d.PolicyAuthorized{t.Fatalf("unsafe temporal acceptance %+v %v",d,e)}}
}
