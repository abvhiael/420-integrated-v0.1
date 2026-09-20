package interoperability

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

func operatorForDomain(t *testing.T, chain uint64, entryPoint string, ready bool) *httptest.Server {
 t.Helper()
 return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  switch r.URL.Path {
  case "/readyz":
   if r.Method!=http.MethodGet {t.Errorf("readiness used %s",r.Method)}
   w.Header().Set("Content-Type","application/json")
   _=json.NewEncoder(w).Encode(map[string]any{"ready":ready,"chain_id":chain,"entry_point":entryPoint})
  case "/rpc":
   if r.Method!=http.MethodPost {t.Errorf("RPC used %s",r.Method)}
   var req struct { ID int `json:"id"`;Method string `json:"method"` }
   if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{t.Error(err);return}
   if req.Method=="eth_sendUserOperation" {t.Error("read-only probe attempted submission");return}
   w.Header().Set("Content-Type","application/json")
   switch req.Method {
   case "eth_supportedEntryPoints": _=json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,"result":[]string{entryPoint}})
   case "eth_getUserOperationReceipt": _=json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,"result":nil})
   default:t.Errorf("unexpected RPC method %s",req.Method)
   }
  default:http.NotFound(w,r)
  }
 }))
}

func TestCheckDomainAcceptsQualifiedOperatorAndRejectsWrongDomain(t *testing.T){
 cases:=[]struct{name string; chain uint64;entry string; ready bool;accepted bool}{
  {"matching",420,fixtureEntryPoint,true,true},
  {"wrong_chain",421,fixtureEntryPoint,true,false},
  {"wrong_entrypoint",420,"0x2222222222222222222222222222222222222222",true,false},
  {"not_ready",420,fixtureEntryPoint,false,false},
 }
 for _,tc:=range cases {t.Run(tc.name,func(t *testing.T){
  server:=operatorForDomain(t,tc.chain,tc.entry,tc.ready);defer server.Close()
  p:=Probe{Client:&http.Client{Timeout:time.Second},EntryPoint:fixtureEntryPoint}
  result,err:=p.CheckDomain(context.Background(),server.URL+"/rpc",420)
  if tc.accepted {if err!=nil||result.ChainID!=420||result.EntryPoint!=fixtureEntryPoint||!result.Ready{t.Fatalf("matching domain rejected: %+v, %v",result,err)}} else if err==nil {t.Fatalf("invalid domain accepted: %+v",result)}
 })}
}

func TestCheckOperatorsForChainDoesNotMaskDivergentOperator(t *testing.T){
 good:=operatorForDomain(t,420,fixtureEntryPoint,true);defer good.Close()
 wrong:=operatorForDomain(t,421,fixtureEntryPoint,true);defer wrong.Close()
 probe:=Probe{Client:&http.Client{Timeout:time.Second},EntryPoint:fixtureEntryPoint}
 report,err:=probe.CheckOperatorsForChain(context.Background(),[]string{good.URL+"/rpc",wrong.URL+"/rpc"},420)
 if err!=nil {t.Fatal(err)}
 if report.AllQualified||report.IndependentOwnershipVerified||report.DistinctOrigins!=2||len(report.Operators)!=2{t.Fatalf("incorrect domain report: %+v",report)}
 if !report.Operators[0].WireQualified||!report.Operators[0].DomainQualified||!report.Operators[1].WireQualified||report.Operators[1].DomainQualified||!strings.Contains(report.Operators[1].Error,"chain mismatch") {t.Fatalf("divergent operator was not isolated: %+v",report.Operators)}
}

func TestCheckOperatorsForChainRejectsInvalidChainAndOfflineOperator(t *testing.T){
 server:=operatorForDomain(t,420,fixtureEntryPoint,true)
 endpoint:=server.URL+"/rpc"
 server.Close()
 probe:=Probe{Client:&http.Client{Timeout:time.Second},EntryPoint:fixtureEntryPoint}
 if _,err:=probe.CheckOperatorsForChain(context.Background(),[]string{endpoint},0);err==nil {t.Fatal("zero chain qualified")}
 report,err:=probe.CheckOperatorsForChain(context.Background(),[]string{endpoint},420)
 if err!=nil {t.Fatal(err)}
 if report.AllQualified||len(report.Operators)!=1||report.Operators[0].WireQualified {t.Fatalf("offline operator was qualified: %+v",report)}
}
