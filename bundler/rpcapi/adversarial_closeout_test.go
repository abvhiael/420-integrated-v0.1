package rpcapi

import (
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

// These cases must terminate at the public transport boundary without invoking
// the admission backend. A hostile client must not be able to bypass the
// canonical operation parser or turn malformed input into a successful send.
func TestGEN1120AdversarialIngressRejectsWithoutAdmission(t *testing.T) {
 const point = "0x1111111111111111111111111111111111111111"
 base := map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),point}}
 cases := []struct{name string; body any}{
  {"empty_params",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{}}},
  {"wrong_version",map[string]any{"jsonrpc":"1.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),point}}},
  {"array_batch",[]any{base}},
  {"invalid_id",map[string]any{"jsonrpc":"2.0","id":map[string]any{"bad":true},"method":"eth_sendUserOperation","params":[]any{rpcFixture(),point}}},
  {"wrong_entrypoint",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),"0x1234"}}},
  {"nonnumeric_nonce",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{map[string]any{"sender":"0x2222222222222222222222222222222222222222","nonce":"0xzz"},point}}},
  {"nested_params",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":map[string]any{"operation":rpcFixture()}}},
 }
 for _,tc:=range cases {
  t.Run(tc.name,func(t *testing.T){
   backend:=&fakeBackend{sendHash:"0x"+strings.Repeat("ab",32)}
   handler,err:=NewHandler(backend);if err!=nil{t.Fatal(err)}
   raw,err:=json.Marshal(tc.body);if err!=nil{t.Fatal(err)}
   req:=httptest.NewRequest(http.MethodPost,"/",bytes.NewReader(raw));req.Header.Set("Content-Type","application/json")
   recorder:=httptest.NewRecorder();handler.ServeHTTP(recorder,req)
   if recorder.Code!=http.StatusOK{t.Fatalf("unexpected HTTP status %d",recorder.Code)}
   var result map[string]any
   if err:=json.Unmarshal(recorder.Body.Bytes(),&result);err!=nil{t.Fatalf("invalid JSON-RPC rejection: %v",err)}
   if _,ok:=result["error"];!ok{t.Fatalf("malformed request was accepted: %v",result)}
   if backend.lastEntry!=""{t.Fatalf("malformed request reached submission backend: %q",backend.lastEntry)}
  })
 }
}

func TestGEN1120OversizeIngressRejectsBeforeBackend(t *testing.T){
 backend:=&fakeBackend{sendHash:"0x"+strings.Repeat("ab",32)}
 handler,err:=NewHandler(backend);if err!=nil{t.Fatal(err)}
 request:=httptest.NewRequest(http.MethodPost,"/",strings.NewReader(strings.Repeat("a",maxRequestBytes+1)))
 request.Header.Set("Content-Type","application/json")
 response:=httptest.NewRecorder();handler.ServeHTTP(response,request)
 if backend.lastEntry!=""{t.Fatal("oversized request reached submission backend")}
 if response.Code!=http.StatusOK{t.Fatalf("unexpected HTTP status %d",response.Code)}
 var result map[string]any
 if err:=json.Unmarshal(response.Body.Bytes(),&result);err!=nil{t.Fatal(err)}
 if _,ok:=result["error"];!ok{t.Fatalf("oversized request was accepted: %v",result)}
}
