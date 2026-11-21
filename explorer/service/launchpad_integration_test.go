package service

import (
  "context"
  "strings"
  "testing"

  "github.com/420integrated/420-integrated/indexer/model"
)

func TestLaunchpadExplorerPreservesCanonicalPayContributionAndEvidenceLogProvenance(t *testing.T){
  sigs:=[]string{
    "0x87d741fc83b0293ee8848e75d68b992c2494f6ca4189a16118aee528e0c383bf", // real PaymentSet
    "0x7398823e322ab91a0f8c600cae8332d7257dabced1aa80594d740b0fdf872b90", // real ContributionRecorded
    "0x4eb83f152568db723c84ad661f3eb23bf181fbd52e5a3f098c02f32ec76d133c", // real NotificationPublished
    "0x4d6f05369919be8bbefae70556aff15ed3a924fc24bae705af7144f2fac4cdf2", // real ReputationEvidencePublished
  }
  sale:="0x"+strings.Repeat("aa",32)
  logs:=make([]model.LogRecord,len(sigs))
  for i,sig:=range sigs{
    log:=exp25Log([]string{sig,sale},"0x"+strings.Repeat("00",32))
    log.LogIndex=uint64(i)
    logs[i]=log
  }
  idx:=exp25Fake("0x91d216e2"+strings.Repeat("00",96),"0",logs,1)
  svc,err:=New(idx,420,0)
  if err!=nil{t.Fatal(err)}
  view,err:=svc.TransactionDetail(context.Background(),"0xtx")
  if err!=nil{t.Fatal(err)}
  if len(view.Logs)!=len(sigs){t.Fatalf("missing Launchpad Explorer records: %d",len(view.Logs))}
  for i,log:=range view.Logs{
    if log.ChainID!=420||log.BlockNumber!=9||log.LogIndex!=uint64(i)||
      log.Topics[0]!=sigs[i]||log.Topics[1]!=sale||log.Data!=logs[i].Data||
      log.TransactionHash!="0xtx"||log.Address!=logs[i].Address{
      t.Fatalf("unverified or substituted Launchpad raw event[%d]: %+v",i,log)
    }
  }
  logs[3].Topics[1]="0x1234"
  idx=exp25Fake("0x","0",logs,1)
  svc,err=New(idx,420,0)
  if err!=nil{t.Fatal(err)}
  if _,err=svc.TransactionDetail(context.Background(),"0xtx");err==nil{
    t.Fatal("malformed Launchpad reputation topic accepted by Explorer")
  }
}
