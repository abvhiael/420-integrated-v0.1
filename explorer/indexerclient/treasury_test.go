package indexerclient
import("context";"fmt";"net/http";"net/http/httptest";"strings";"testing")
func TestTreasuryExplorerCommitment(t *testing.T){
 h:="0x"+strings.Repeat("ab",32);a:="0x"+strings.Repeat("12",20)
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/v1/treasury/disbursements/"+h||r.URL.Query().Get("chainId")!="420"{t.Error("wrong read boundary")}
  fmt.Fprintf(w,`{"apiVersion":"v1","data":{"chainId":"420","disbursementId":"%s","budgetId":"%s","asset":"%s","amount":"1","state":"EXECUTED","vaultReleaseHash":"%s","executor":"%s","blockNumber":"4","blockHash":"%s","transactionHash":"%s","transactionIndex":0,"logIndex":0,"authoritative":false}}`,h,h,a,h,a,h,h)
 }));defer server.Close()
 c,err:=NewWithHTTPClient(server.URL,server.Client());if err!=nil{t.Fatal(err)}
 v,err:=c.TreasuryRead(context.Background(),420,"disbursements",h);if err!=nil{t.Fatal(err)}
 if v.Authoritative||v.VaultReleaseVerified||!strings.Contains(v.ReleaseEvidence,"not verified"){t.Fatalf("invalid authority %+v",v)}
}
