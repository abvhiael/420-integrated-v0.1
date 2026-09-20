package bundle

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
 "github.com/420integrated/420-integrated/bundler/userop"
)

type closeoutRejectedSubmitter struct{ calls int }
func (s *closeoutRejectedSubmitter) Submit(context.Context,string,userop.PackedUserOperation)(string,error){s.calls++;return "",errors.New("rpc error -32000: transaction rejected")}

// An explicit JSON-RPC rejection is distinguishable from an ambiguous transport
// outcome: only the former may release a durable intent for a later revalidation.
func TestCloseoutExplicitRejectionAllowsRevalidationRetry(t *testing.T){
 now:=time.Date(2026,9,19,18,0,0,0,time.UTC)
 candidate:=entry(t,op("0x2222222222222222222222222222222222222222","0x1"),now)
 pool:=&fakePool{items:[]mempool.Entry{candidate}}
 recorder:=&fakeRecorder{}
 submitter:=&closeoutRejectedSubmitter{}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:4},pool,fakeValidator{invalid:map[string]bool{}},submitter)
 if err!=nil{t.Fatal(err)}
 builder.SetSubmissionRecorder(recorder)
 for i:=0;i<2;i++ {
  result,err:=builder.SubmitNext(context.Background(),now.Add(time.Duration(i)*time.Second))
  if err!=nil{t.Fatal(err)}
  if len(result.Failed)!=1||len(result.Submitted)!=0{t.Fatalf("unexpected rejection result %+v",result)}
  if recorder.HasSubmissionOrPending(candidate.Hash){t.Fatal("explicit rejection retained pending intent")}
 }
 if submitter.calls!=2{t.Fatalf("expected retry after explicit rejection, got %d calls",submitter.calls)}
 if len(pool.removed)!=0{t.Fatalf("explicit rejection removed retry-eligible operation: %v",pool.removed)}
}

// A valid-looking transaction hash accompanying an invalid JSON-RPC identity
// cannot be treated as acceptance and must never release the submission intent.
func TestCloseoutHostileAcknowledgmentDoesNotPermitResend(t *testing.T){
 now:=time.Date(2026,9,19,18,0,0,0,time.UTC)
 candidate:=entry(t,op("0x2222222222222222222222222222222222222222","0x1"),now)
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,_ *http.Request){
  w.Header().Set("Content-Type","application/json")
  _,_=w.Write([]byte(`{"jsonrpc":"2.0","id":2,"result":"0x`+strings.Repeat("ab",32)+`"}`))
 }))
 defer server.Close()
 sender:=&RPCSubmitter{url:server.URL,from:"0x2222222222222222222222222222222222222222",client:&http.Client{Timeout:time.Second}}
 pool:=&fakePool{items:[]mempool.Entry{candidate}}
 recorder:=&fakeRecorder{}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:4},pool,fakeValidator{invalid:map[string]bool{}},sender)
 if err!=nil{t.Fatal(err)}
 builder.SetSubmissionRecorder(recorder)
 result,err:=builder.SubmitNext(context.Background(),now)
 if err!=nil{t.Fatal(err)}
 if len(result.Failed)!=1||len(result.Submitted)!=0{t.Fatalf("hostile response was accepted: %+v",result)}
 if !recorder.HasSubmissionOrPending(candidate.Hash){t.Fatal("hostile response released submission intent")}
 if len(pool.removed)!=1||pool.removed[0]!=candidate.Hash{t.Fatal("hostile response left operation eligible for resend")}
}
