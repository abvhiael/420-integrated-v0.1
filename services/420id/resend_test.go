package account

import (
 "context"
 "encoding/json"
 "fmt"
 "net/http"
 "net/http/httptest"
 "strings"
 "sync"
 "testing"
)

func TestResendHTTPSVerification(t *testing.T){
 const key="re_disposable_test_key_123456789"
 const sender="accounts@auth.example.org"
 secret:=encodeBytes(make([]byte,32))
 m,e:=NewResendMailer(key,sender);if e!=nil{t.Fatal(e)}
 if m.endpoint!=resendEndpoint{t.Fatal("wrong production endpoint")}
 sameKey:=""
 var mu sync.Mutex
 s:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||r.URL.Path!="/emails"||r.Header.Get("Authorization")!="Bearer "+key||r.Header.Get("Content-Type")!="application/json"{t.Error("unexpected HTTP request")}
  id:=r.Header.Get("Idempotency-Key");if !strings.HasPrefix(id,"420id-")||len(id)!=70||strings.Contains(id,secret){t.Error("idempotency header invalid")}
  mu.Lock();if sameKey!=""&&sameKey!=id{t.Error("unstable idempotency header")};sameKey=id;mu.Unlock()
  var body struct{From string;To []string;Subject,Text string}
  if json.NewDecoder(r.Body).Decode(&body)!=nil||body.From!=sender||len(body.To)!=1||body.To[0]!="test@example.org"||body.Subject!="Your 420ID sign-in code"||!strings.Contains(body.Text,secret)||strings.Contains(body.Text,key){t.Error("invalid verification message")}
  w.Header().Set("Content-Type","application/json");fmt.Fprint(w,`{"id":"ee63b37c-5a9b-4e48-8b4c-07499d442bbf"}`)
 }));defer s.Close()
 m.endpoint=s.URL+"/emails";m.client.Transport=s.Client().Transport
 for i:=0;i<2;i++{if e=m.SendVerification(context.Background(),"test@example.org",secret);e!=nil{t.Fatal(e)}}
 if e=m.SendVerification(context.Background(),"test@example.org\r\n", "bad");e==nil{t.Fatal("invalid code accepted")}
 if e=m.SendVerification(context.Background(),"test@example.org\r\nBcc:a@example.org",secret);e==nil{t.Fatal("invalid recipient accepted")}
 for _,v:=range []string{"","wrong","re_foo\r\nInjected: yes"}{if _,e=NewResendMailer(v,sender);e==nil{t.Fatal("invalid credential accepted")}}
}
func TestResendHTTPSFailureClosed(t *testing.T){
 const key="re_disposable_test_key_123456789"
 secret:=encodeBytes(make([]byte,32))
 for _,tc:=range []struct{status int;body string}{
  {401,"provider secret "+key},{403,"denied"},{429,"quota exceeded"},{500,"failed"},{200,"not JSON"},{200,`{"id":""}`},{200,`{"id":"ee63b37c-5a9b-4e48-8b4c-07499d442bbf","ID":"bad"}`},{200,strings.Repeat("x",4097)},
 }{
  s:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.WriteHeader(tc.status);fmt.Fprint(w,tc.body)}))
  m,e:=NewResendMailer(key,"accounts@example.org");if e!=nil{t.Fatal(e)}
  m.endpoint=s.URL+"/emails";m.client.Transport=s.Client().Transport
  e=m.SendVerification(context.Background(),"test@example.org",secret);s.Close()
  if e!=ErrUnavailable{t.Fatalf("expected generic failure for %d, got %v",tc.status,e)}
 }
 t.Run("redirect not followed",func(t *testing.T){
  target:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){t.Error("redirect followed")}));defer target.Close()
  redirect:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){http.Redirect(w,r,target.URL,http.StatusTemporaryRedirect)}));defer redirect.Close()
  m,_:=NewResendMailer(key,"accounts@example.org");m.endpoint=redirect.URL;m.client.Transport=redirect.Client().Transport
  if e:=m.SendVerification(context.Background(),"test@example.org",secret);e!=ErrUnavailable{t.Fatal(e)}
 })
 t.Run("untrusted certificate",func(t *testing.T){
  s:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){t.Error("untrusted certificate accepted")}));defer s.Close()
  m,_:=NewResendMailer(key,"accounts@example.org");m.endpoint=s.URL
  if e:=m.SendVerification(context.Background(),"test@example.org",secret);e!=ErrUnavailable{t.Fatal(e)}
 })
}
