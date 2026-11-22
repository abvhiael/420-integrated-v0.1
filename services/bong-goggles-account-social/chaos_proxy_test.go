package social

import (
 "bytes"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/base64"
 "encoding/hex"
 "io"
 "net/http"
 "strings"
 "testing"
)
func TestCCCAccountProxyConfigurationAndBodyBinding(t *testing.T){
 key:=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{0x6e},32))
 for _,origin:=range []string{"http://bonggoggles-chaos.onrender.com",
  "https://evil.example.com","https://bonggoggles-chaos.onrender.com/evil",
  "https://bonggoggles-chaos.onrender.com?key=secret","https://user@bonggoggles-chaos.onrender.com"}{
  h:=&Handler{Store:&Store{},SignOn:&SignOn{}}
  if err:=h.EnableChaosProxy(origin,key);err==nil{t.Fatalf("accepted unsafe backend %s",origin)}
 }
 h:=&Handler{Store:&Store{},SignOn:&SignOn{}}
 if err:=h.EnableChaosProxy("https://bonggoggles-chaos.onrender.com",key);err!=nil{t.Fatal(err)}
 if err:=h.EnableChaosProxy("https://bonggoggles-chaos.onrender.com",key);err==nil{t.Fatal("key reconfiguration")}
 h2:=&Handler{Store:&Store{},SignOn:&SignOn{}}
 if err:=h2.EnableChaosProxy("https://bonggoggles-chaos.onrender.com","wrong");err==nil{t.Fatal("short key")}
 subject:="10000000-0000-4000-8000-000000000001"
 body:=[]byte(`{"humanSeats":2,"bots":[]}`)
 name:=base64.RawURLEncoding.EncodeToString([]byte("Martha"))
 at:="1795300000";path:="/v1/chaos/rooms"
 signed:=chaosSignature(h.Chaos.key[:],"POST",path,at,subject,name,body)
 digest:=sha256.Sum256(body)
 msg:=strings.Join([]string{"POST",path,at,subject,name,hex.EncodeToString(digest[:])},"\n")
 mac:=hmac.New(sha256.New,h.Chaos.key[:]);mac.Write([]byte(msg))
 if signed!=base64.RawURLEncoding.EncodeToString(mac.Sum(nil)){t.Fatal("proxy body signature mismatch")}
 if signed==chaosSignature(h.Chaos.key[:],"POST",path,at,subject,name,[]byte(`{"humanSeats":4}`)){t.Fatal("body tamper not detected")}
 if signed==chaosSignature(h.Chaos.key[:],"GET",path,at,subject,name,body){t.Fatal("method substitution")}
 if signed==chaosSignature(h.Chaos.key[:],"POST","/v1/chaos/rooms/other",at,subject,name,body){t.Fatal("path substitution")}
 if signed==chaosSignature(h.Chaos.key[:],"POST",path,at,"20000000-0000-4000-8000-000000000002",name,body){t.Fatal("subject substitution")}
 req,_:=http.NewRequest("POST","https://bonggoggles.420integrated.org/v1/chaos/rooms",io.NopCloser(bytes.NewReader(body)))
 req.Header.Set("Content-Type","application/json")
 if err:=strictJSON(req,&map[string]any{});err!=nil{t.Fatal(err)}
 bad,_:=http.NewRequest("POST","https://bonggoggles.420integrated.org/v1/chaos/rooms",
  io.NopCloser(strings.NewReader(`{"humanSeats":2,"humanSeats":4}`)))
 bad.Header.Set("Content-Type","application/json")
 if strictJSON(bad,&map[string]any{})==nil{t.Fatal("duplicate JSON keys accepted")}
}
