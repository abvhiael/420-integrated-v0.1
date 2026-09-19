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

type ambiguousSubmitter struct{}
func (ambiguousSubmitter) Submit(context.Context,string,userop.PackedUserOperation)(string,error){return "",ambiguousSubmission(errors.New("transport timeout after send"))}

func TestAmbiguousSendRetainsIntentAndRemovesActiveOperation(t *testing.T){
 now:=time.Date(2026,9,19,6,0,0,0,time.UTC)
 operation:=op("0x2222222222222222222222222222222222222222","0x1")
 candidate:=entry(t,operation,now)
 pool:=&fakePool{items:[]mempool.Entry{candidate}}
 rec:=&fakeRecorder{}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:4},pool,fakeValidator{invalid:map[string]bool{}},ambiguousSubmitter{})
 if err!=nil{t.Fatal(err)}
 builder.SetSubmissionRecorder(rec)
 result,err:=builder.SubmitNext(context.Background(),now)
 if err!=nil{t.Fatal(err)}
 if len(result.Submitted)!=0||len(result.Failed)!=1{t.Fatalf("unexpected result %+v",result)}
 if !rec.HasSubmissionOrPending(candidate.Hash){t.Fatal("ambiguous send cleared durable intent")}
 if len(pool.removed)!=1||pool.removed[0]!=candidate.Hash{t.Fatal("ambiguous operation remains eligible for retry")}
}

func TestSubmitterRejectsUntrustedSendAcknowledgments(t *testing.T){
 for _,body:=range []string{
  `{"jsonrpc":"2.0","id":2,"result":"0x`+strings.Repeat("ab",32)+`"}`,
  `{"jsonrpc":"2.0","id":1,"result":"0x1234"}`,
  `not-json`,
 } {
  t.Run(body[:min(len(body),24)],func(t *testing.T){
   server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");_,_=w.Write([]byte(body))}))
   defer server.Close()
   sender,err:=NewRPCSubmitter(server.URL,"0x2222222222222222222222222222222222222222",time.Second)
   if err!=nil{t.Fatal(err)}
   _,err=sender.Submit(context.Background(),"0x1111111111111111111111111111111111111111",op("0x2222222222222222222222222222222222222222","0x1"))
   if !errors.Is(err,ErrAmbiguousSubmission){t.Fatalf("expected ambiguous acknowledgment, got %v",err)}
  })
 }
}
