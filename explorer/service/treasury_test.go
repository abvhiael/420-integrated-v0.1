package service

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "strings"
 "testing"
 "time"
 "github.com/420integrated/420-integrated/explorer/indexerclient"
 "github.com/420integrated/420-integrated/indexer/treasuryread"
)
type treasuryReaderFixture struct{fakeIndexer;view indexerclient.TreasuryProjection;err error;chain uint64}
func(f *treasuryReaderFixture)TreasuryRead(_ context.Context,chain uint64,kind,id string)(indexerclient.TreasuryProjection,error){f.chain=chain;return f.view,f.err}
func TestTreasuryServiceRevalidatesAndCannotPromoteRelease(t *testing.T){
 h:="0x"+strings.Repeat("a",64);addr:="0x"+strings.Repeat("b",40)
 data:=fmt.Sprintf(`{"chainId":"420","disbursementId":"%s","budgetId":"%s","asset":"%s","amount":"1","state":"EXECUTED","vaultReleaseHash":"%s","executor":"%s","blockNumber":"1","blockHash":"%s","transactionHash":"%s","transactionIndex":0,"logIndex":0,"authoritative":false}`,h,h,addr,h,addr,h,h)
 f:=&treasuryReaderFixture{view:indexerclient.TreasuryProjection{Data:json.RawMessage(data),ReleaseEvidence:"verified Vault release"}}
 svc,err:=New(f,420,time.Minute);if err!=nil{t.Fatal(err)}
 view,err:=svc.Treasury(context.Background(),"disbursements",h)
 if err!=nil||f.chain!=420||view.ReleaseEvidence!="Treasury commitment only; Vault release not verified"{t.Fatalf("unexpected projection %+v %v",view,err)}
 f.view.VaultReleaseVerified=true;if _,err=svc.Treasury(context.Background(),"disbursements",h);!errors.Is(err,treasuryread.ErrAuthority){t.Fatalf("accepted Vault authority: %v",err)}
 f.view.VaultReleaseVerified=false;f.view.Data=json.RawMessage(strings.Replace(data,"\"420\"","\"1\"",1));if _,err=svc.Treasury(context.Background(),"disbursements",h);!errors.Is(err,treasuryread.ErrWrongChain){t.Fatalf("accepted wrong chain: %v",err)}
 f.view.Data=json.RawMessage(strings.Replace(data,"\"authoritative\":false","\"authoritative\":true",1));if _,err=svc.Treasury(context.Background(),"disbursements",h);!errors.Is(err,treasuryread.ErrAuthority){t.Fatalf("accepted canonical authority: %v",err)}
 svc,_=New(&fakeIndexer{},420,time.Minute);if _,err=svc.Treasury(context.Background(),"disbursements",h);err==nil{t.Fatal("accepted missing Treasury capability")}
}
