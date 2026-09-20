package rpcapi

import (
 "encoding/json"
 "fmt"
 "strings"
 "testing"

 "github.com/420integrated/420-integrated/bundler/lifecycle"
 "github.com/420integrated/420-integrated/bundler/userop"
)

// Independently constructed wallet and third-party envelopes exercise the same
// JSON-RPC wire contract against distinct, replaceable operator backends.
func TestCrossClientOperatorWireCompatibility(t *testing.T) {
 const entry = "0x1111111111111111111111111111111111111111"
 operation := rpcFixture()
 hash, err := userop.Hash(420, entry, operation)
 if err != nil { t.Fatal(err) }
 for _, operator := range []string{"operator-a", "operator-b"} {
  t.Run(operator, func(t *testing.T) {
   b := &fakeBackend{sendHash: "0x"+strings.ToUpper(hash[2:]), points: []string{entry}}
   h, err := NewHandler(b)
   if err != nil { t.Fatal(err) }
   for _, client := range []struct {name string; id any; operation any}{
    {"wallet", 1, operation},
    {"third-party", "external-request-42", map[string]any{
     "sender": operation.Sender,
     "nonce": operation.Nonce, "initCode": operation.InitCode,
     "callData": operation.CallData, "accountGasLimits": operation.AccountGasLimits,
     "preVerificationGas": operation.PreVerificationGas, "gasFees": operation.GasFees,
     "paymasterAndData": operation.PaymasterAndData, "signature": operation.Signature,
    }},
   } {
    t.Run(client.name, func(t *testing.T) {
     envelope := map[string]any{"jsonrpc":"2.0","id":client.id,"method":"eth_sendUserOperation","params":[]any{client.operation,entry}}
     result := call(t,h,envelope)
     if result["result"] != hash { t.Fatalf("hash mismatch: got %v want %s",result,hash) }
     if fmt.Sprint(result["id"]) != fmt.Sprint(client.id) { t.Fatalf("request id changed: %v",result) }
     if b.lastEntry != entry { t.Fatalf("entry point changed: %q", b.lastEntry) }
    })
   }
   supported := call(t,h,map[string]any{"jsonrpc":"2.0","id":"probe","method":"eth_supportedEntryPoints","params":[]any{}})
   points,ok := supported["result"].([]any)
   if !ok || len(points)!=1 || points[0]!=entry {t.Fatalf("incompatible supportedEntryPoints: %v",supported)}
  })
 }
}

func TestCrossClientReceiptNullAndInclusionShape(t *testing.T) {
 const entry = "0x1111111111111111111111111111111111111111"
 hash := "0x"+strings.Repeat("ab",32)
 tx := "0x"+strings.Repeat("cd",32)
 block := "0x"+strings.Repeat("ef",32)
 b := &fakeBackend{}
 h,err := NewHandler(b)
 if err != nil {t.Fatal(err)}
 request := map[string]any{"jsonrpc":"2.0","id":"wallet-receipt","method":"eth_getUserOperationReceipt","params":[]any{hash}}
 pending := call(t,h,request)
 if result,exists := pending["result"]; !exists || result!=nil {t.Fatalf("unknown operation must return JSON null: %v",pending)}
 b.receipt = lifecycle.Receipt{UserOpHash:hash,EntryPoint:entry,TransactionHash:tx,BlockHash:block,BlockNumber:"0x2a",Success:true,Lifecycle:"included"}
 b.receiptFound=true
 included := call(t,h,request)
 raw,err := json.Marshal(included["result"])
 if err!=nil {t.Fatal(err)}
 var wire struct {
  UserOpHash string `json:"userOpHash"`
  EntryPoint string `json:"entryPoint"`
  TransactionHash string `json:"transactionHash"`
  BlockHash string `json:"blockHash"`
  BlockNumber string `json:"blockNumber"`
  Success *bool `json:"success"`
  Lifecycle string `json:"lifecycle"`
 }
 if err:=json.Unmarshal(raw,&wire);err!=nil{t.Fatal(err)}
 if wire.UserOpHash!=hash||wire.EntryPoint!=entry||wire.TransactionHash!=tx||wire.BlockHash!=block||wire.BlockNumber!="0x2a"||wire.Success==nil||!*wire.Success||wire.Lifecycle!="included" {t.Fatalf("Wallet inclusion receipt contract mismatch: %+v",wire)}
}
