package treasuryread
import("encoding/json";"strings";"testing")
func TestTreasuryBoundary(t *testing.T){
 h:="0x"+strings.Repeat("ab",32);a:="0x"+strings.Repeat("12",20)
 data:=map[string]any{"chainId":"420","budgetId":h,"asset":a,"blockNumber":"9","blockHash":h,"transactionHash":h,"transactionIndex":0,"logIndex":0,"authoritative":false,"ceiling":"100","committed":"90","executed":"80"}
 check:=func(want bool){t.Helper();b,_:=json.Marshal(data);if (Validate(b,420,"budgets",h)==nil)!=want{t.Fatalf("unexpected result for %s",b)}}
 check(true);data["executed"]="91";check(false);data["executed"]="80";delete(data,"authoritative");check(false);data["authoritative"]=false;data["budgetId"]="0x"+strings.Repeat("cd",32);check(false)
}
