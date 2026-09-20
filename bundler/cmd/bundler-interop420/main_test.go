package main

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

const testEntryPoint="0x1111111111111111111111111111111111111111"

func TestRunnerRejectsMissingAndUnexpectedArguments(t *testing.T){
 for _,args:=range [][]string{nil,{"-chain-id","420"},{"-chain-id","420","-entry-point",testEntryPoint},{"-chain-id","420","-entry-point",testEntryPoint,"-endpoint","http://localhost:8080/rpc","unexpected"}}{
  if _,err:=run(args);err==nil{t.Fatalf("accepted incomplete arguments: %v",args)}
 }
}

func TestRunnerEmitsDomainQualifiedReadOnlyMatrix(t *testing.T){
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path=="/readyz" {
   if r.Method!=http.MethodGet{t.Errorf("wrong readiness method: %s",r.Method)}
   _=json.NewEncoder(w).Encode(map[string]any{"chain_id":420,"entry_point":testEntryPoint,"ready":true})
   return
  }
  if r.URL.Path!="/rpc"||r.Method!=http.MethodPost{http.NotFound(w,r);return}
  var request struct{ID int `json:"id"`;Method string `json:"method"`}
  if err:=json.NewDecoder(r.Body).Decode(&request);err!=nil{t.Error(err);return}
  if request.Method=="eth_sendUserOperation"{t.Fatal("runner submitted an operation")}
  result:=any(nil)
  if request.Method=="eth_supportedEntryPoints"{result=[]string{testEntryPoint}} else if request.Method!="eth_getUserOperationReceipt"{t.Errorf("unexpected method %s",request.Method)}
  _=json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":request.ID,"result":result})
 }))
 defer server.Close()
 report,err:=run([]string{"-chain-id","420","-entry-point",testEntryPoint,"-endpoint",server.URL+"/rpc"})
 if err!=nil{t.Fatal(err)}
 if !report.AllQualified||len(report.Operators)!=1||!report.Operators[0].DomainQualified||!report.Operators[0].WireQualified||report.IndependentOwnershipVerified{t.Fatalf("wrong report: %+v",report)}
 if _,err:=run([]string{"-chain-id","421","-entry-point",testEntryPoint,"-endpoint",server.URL+"/rpc"});err!=nil&&!strings.Contains(err.Error(),"chain"){t.Fatalf("unexpected error: %v",err)}
}
