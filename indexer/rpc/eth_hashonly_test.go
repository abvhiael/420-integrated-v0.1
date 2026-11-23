package rpc

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/indexer/model"
)

func TestBundleHashOnlyCanonicalLookup(t *testing.T) {
 // The real JWT Engine returned an array of tx hashes for a block with a
 // signed EIP-1559 transaction even when expansion was requested. Never
 // discard it, synthesize metadata, or accept a mismatched lookup/receipt.
 txHash := "0x" + strings.Repeat("aa",32)
 blockHash := "0x" + strings.Repeat("bb",32)
 cases := []struct {
  name string
  modify func(tx map[string]any)
  reject bool
 }{
  {name:"authentic hash-only block and canonical receipt"},
  {name:"wrong transaction hash",modify:func(tx map[string]any){tx["hash"]="0x"+strings.Repeat("cc",32)},reject:true},
  {name:"wrong canonical block hash",modify:func(tx map[string]any){tx["blockHash"]="0x"+strings.Repeat("dd",32)},reject:true},
  {name:"wrong canonical block number",modify:func(tx map[string]any){tx["blockNumber"]="0x3"},reject:true},
  {name:"wrong transaction index",modify:func(tx map[string]any){tx["transactionIndex"]="0x1"},reject:true},
  {name:"missing transaction",modify:func(tx map[string]any){for k:=range tx{delete(tx,k)}},reject:true},
 }
 for _, tc := range cases {
  t.Run(tc.name,func(t *testing.T){
   mux:=http.NewServeMux()
   mux.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){
    var req request
    if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{t.Fatal(err)}
    var result any
    switch req.Method{
    case "eth_getBlockByNumber":
     result=map[string]any{"number":"0x2","hash":blockHash,
      "parentHash":"0x"+strings.Repeat("ee",32),"timestamp":"0x18",
      "transactions":[]string{txHash}}
    case "eth_getTransactionByHash":
     tx:=map[string]any{"hash":txHash,"blockHash":blockHash,"blockNumber":"0x2",
      "transactionIndex":"0x0","from":"0x"+strings.Repeat("01",20),
      "to":"0x"+strings.Repeat("02",20),"value":"0x1","input":"0x"}
     if tc.modify!=nil{tc.modify(tx)}
     result=tx
    case "eth_getTransactionReceipt":
     result=map[string]any{"transactionHash":txHash,"transactionIndex":"0x0",
      "blockHash":blockHash,"blockNumber":"0x2","status":"0x1",
      "gasUsed":"0x5208","effectiveGasPrice":"0x3b9aca00",
      "contractAddress":"","logs":[]any{}}
    default:t.Fatalf("unexpected JSON-RPC method %s",req.Method)
    }
    w.Header().Set("content-type","application/json")
    if err:=json.NewEncoder(w).Encode(map[string]any{
     "jsonrpc":"2.0","id":req.ID,"result":result});err!=nil{t.Fatal(err)}
   })
   server:=httptest.NewServer(mux)
   defer server.Close()
   client:=NewClient(server.URL,time.Second)
   bundle,err:=client.BundleByNumber(context.Background(),420,2,model.FinalityHead,"v1")
   if tc.reject {
    if err==nil{t.Fatal("mismatched hash-only transaction passed canonical verification")}
    return
   }
   if err!=nil{t.Fatal(err)}
   if len(bundle.Transactions)!=1 || len(bundle.Receipts)!=1 ||
      bundle.Transactions[0].Hash!=txHash || bundle.Transactions[0].BlockHash!=blockHash ||
      bundle.Receipts[0].TransactionHash!=txHash ||
      bundle.Receipts[0].BlockHash!=blockHash ||
      bundle.Receipts[0].ActualFeeWei!="21000000000000"{
     t.Fatalf("hash-only canonical transaction/receipt provenance lost: %+v",bundle)
   }
  })
 }
}

func TestBundleRejectsMalformedHashOnlyTransaction(t *testing.T) {
 for _, bad:=range []string{"not-a-hash","0x01","0x"+strings.Repeat("g0",32)}{
  t.Run(bad,func(t *testing.T){
   srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
    var req request
    if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{t.Fatal(err)}
    if req.Method!="eth_getBlockByNumber"{t.Fatalf("unexpected hash-only lookup for invalid %s",bad)}
    json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,
      "result":map[string]any{"number":"0x2","hash":"0x"+strings.Repeat("ab",32),
        "parentHash":"0x"+strings.Repeat("cd",32),"timestamp":"0x18",
        "transactions":[]string{bad}}})
   }))
   defer srv.Close()
   if _,err:=NewClient(srv.URL,time.Second).BundleByNumber(context.Background(),420,2,model.FinalityHead,"v1");err==nil{
    t.Fatal("malformed hash-only transaction accepted")
   }
  })
 }
}
