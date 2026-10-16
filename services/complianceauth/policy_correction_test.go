package complianceauth

import("context";"errors";"testing";"time")
type c0410IndependentApproval struct{denied bool}
func(a c0410IndependentApproval)VerifyPublication(_ context.Context,old,next PublicationFence)error{
 if a.denied||next.Scope!=old.Scope||next.Sequence<=old.Sequence{return ErrUnauthorized}
 return nil
}
func TestC0410CorrectionSupersessionAndHistory(t *testing.T){
 now:=time.Date(2026,10,11,12,0,0,0,time.UTC)
 old:=PublicationFence{Scope:"travel/BC",Sequence:7,RevocationEpoch:4,PolicyDigest:Digest([]byte("erroneous")),DependencyDigest:Digest([]byte("dependency")),ExpiresAt:now.Add(time.Hour)}
 next:=old;next.Sequence=8;next.PolicyDigest=Digest([]byte("restored previously reviewed content"))
 base:=CorrectionCandidate{Target:next,SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("new review")),LegalApprovalExpiresAt:now.Add(time.Minute),ApprovedNow:true,CurrentLawVerified:true,ScopeVerified:true,AuthorID:"author",ReviewerID:"independent reviewer",PublisherID:"publisher",Reason:"correction to current-law checked version"}
 plan,err:=PlanCorrection(old,base,[]byte("retained source error and review evidence"),now)
 if err!=nil||plan.Authorized||!plan.RequiresIndependentPublication||plan.History.HistoricErrorDigest==""||plan.History.PreviousApprovalDigest!=old.PolicyDigest||plan.Next.Sequence!=8{t.Fatalf("invalid correction plan %+v %v",plan,err)}
 cases:=[]struct{name string;change func(*CorrectionCandidate)}{
  {"unlawful rollback",func(x *CorrectionCandidate){x.CurrentLawVerified=false}},
  {"unreviewed",func(x *CorrectionCandidate){x.ApprovedNow=false}},
  {"review expired",func(x *CorrectionCandidate){x.LegalApprovalExpiresAt=now}},
  {"role self approval",func(x *CorrectionCandidate){x.ReviewerID=x.AuthorID}},
  {"scope unverified",func(x *CorrectionCandidate){x.ScopeVerified=false}},
  {"epoch rollback",func(x *CorrectionCandidate){x.Target.RevocationEpoch=3}},
  {"sequence rewind",func(x *CorrectionCandidate){x.Target.Sequence=6}},
  {"same sequence",func(x *CorrectionCandidate){x.Target.Sequence=7}},
  {"different scope",func(x *CorrectionCandidate){x.Target.Scope="travel/AB"}},
  {"bad review digest",func(x *CorrectionCandidate){x.ReviewDigest="invalid"}},
 }
 for _,tc:=range cases{c:=base;tc.change(&c);if _,e:=PlanCorrection(old,c,[]byte("error"),now);e==nil{t.Fatalf("%s accepted",tc.name)}}
 if _,err:=PlanCorrection(old,base,nil,now);err==nil{t.Fatal("missing error evidence")}
 store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:old}}
 if e:=ApplyCorrection(context.Background(),store,c0410IndependentApproval{denied:true},plan,now);e==nil{t.Fatal("denied reviewer accepted")}
 if e:=ApplyCorrection(context.Background(),nil,c0410IndependentApproval{},plan,now);e==nil{t.Fatal("storage outage accepted")}
 if e:=ApplyCorrection(context.Background(),store,c0410IndependentApproval{},plan,now);e!=nil{t.Fatal(e)}
 actual,e:=store.Load(context.Background(),old.Scope);if e!=nil||actual!=next{t.Fatalf("wrong published fence %+v %v",actual,e)}
 if e:=ApplyCorrection(context.Background(),store,c0410IndependentApproval{},plan,now);e==nil{t.Fatal("replayed publication accepted")}
 ctx,cancel:=context.WithCancel(context.Background());cancel()
 if e:=ApplyCorrection(ctx,store,c0410IndependentApproval{},plan,now);!errors.Is(e,ErrUnauthorized){t.Fatalf("cancelled context accepted %v",e)}
}
