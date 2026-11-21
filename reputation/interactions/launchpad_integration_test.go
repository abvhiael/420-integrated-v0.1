package interactions

import (
  "context"
  "testing"
  "time"
  "github.com/420integrated/420-integrated/reputation/model"
)

func TestLaunchpadReputationContributionAndDeliveryAreVerifiedOnlyAfterFinality(t *testing.T){
  for _,kind:=range []Kind{KindContribution,KindRewardDelivery}{
    record:=Record{
      Kind:kind, EvidenceRef:"0x"+"deadbeef", IssuerID:"420/service/launchpad/v1",
      Reviewer:"launchpad-backer-profile",ReviewerType:"PROFILE",
      Subject:"launchpad-creator-profile",SubjectType:"PROFILE",
      OccurredAtUnix:time.Date(2026,11,20,0,0,0,0,time.UTC).Unix(),Final:true,
    }
    adapter,err:=NewAdapter("420Launchpad",kind,fakeRecords{record:record})
    if err!=nil{t.Fatal(err)}
    verifier,err:=NewVerifier(map[Kind]Source{kind:adapter})
    if err!=nil{t.Fatal(err)}
    reviewer:=model.SubjectRef{Type:"PROFILE",ID:record.Reviewer}
    subject:=model.SubjectRef{Type:"PROFILE",ID:record.Subject}
    got,err:=verifier.Verify(context.Background(),model.DomainCrowdfunding,kind,record.EvidenceRef,reviewer,subject)
    if err!=nil{t.Fatal(err)}
    if got.Source!="420Launchpad"||got.IssuerID!="420/service/launchpad/v1"||!got.Final{
      t.Fatalf("unverified Launchpad reputation evidence: %+v",got)
    }
    if _,err:=verifier.Verify(context.Background(),model.DomainMarketplace,kind,record.EvidenceRef,reviewer,subject);err==nil{
      t.Fatal("crowdfunding evidence accepted in the marketplace reputation domain")
    }
    record.Final=false
    unresolved,err:=NewAdapter("420Launchpad",kind,fakeRecords{record:record})
    if err!=nil{t.Fatal(err)}
    verifier,err=NewVerifier(map[Kind]Source{kind:unresolved})
    if err!=nil{t.Fatal(err)}
    if _,err=verifier.Verify(context.Background(),model.DomainCrowdfunding,kind,record.EvidenceRef,reviewer,subject);err==nil{
      t.Fatal("unfinalized Launchpad evidence was used for reputation")
    }
  }
}
