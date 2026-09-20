package bundle

import (
 "context"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
)

// A malicious or alternate Pool may return an economic ranking. The builder
// must impose the public Genesis policy before applying its per-cycle cap.
func TestGenesisBuilderOrderingIgnoresFeeAndSponsor(t *testing.T) {
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 early:=op("0x2222222222222222222222222222222222222222","0x1")
 late:=op("0x3333333333333333333333333333333333333333","0x1")
 early.GasFees="0x"+strings.Repeat("00",31)+"01"
 late.GasFees="0x"+strings.Repeat("ff",32)
 late.PaymasterAndData="0x1234"
 first:=entry(t,early,now.Add(-time.Second))
 second:=entry(t,late,now)
 pool:=&fakePool{items:[]mempool.Entry{second,first}}
 sub:=&fakeSubmitter{fails:map[string]bool{}}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:1,OrderingPolicy:"fifo-v1"},pool,fakeValidator{invalid:map[string]bool{}},sub)
 if err!=nil{t.Fatal(err)}
 result,err:=builder.SubmitNext(context.Background(),now)
 if err!=nil{t.Fatal(err)}
 if result.Selected!=1 || len(result.Submitted)!=1 || result.Submitted[0].UserOpHash!=first.Hash {t.Fatalf("fee or sponsor changed FIFO selection: %+v",result)}
 if len(sub.order)!=1 || sub.order[0]!=early.Sender {t.Fatalf("unexpected submission order: %v",sub.order)}
 if len(pool.removed)!=1 || pool.removed[0]!=first.Hash {t.Fatalf("unselected candidate removed: %v",pool.removed)}
}

func TestGenesisBuilderRejectsUnpublishedEconomicPolicy(t *testing.T) {
 for _,policy:=range []string{"fee-first","sponsored-first","operator-priority","fifo-v2"} {
  _,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:1,OrderingPolicy:policy},&fakePool{},fakeValidator{},&fakeSubmitter{})
  if err==nil {t.Fatalf("accepted undisclosed Genesis policy %q",policy)}
 }
}
