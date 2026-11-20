package social

import (
 "bytes"
 "context"
 "crypto/sha256"
 "net/http"
 "testing"
 "time"
)
func TestSocialValidationAndSecureSessionStorage(t *testing.T){
 for _,v:=range []string{"Hello world","Hello\nworld","<script>html stored as plain text</script>"}{
  if !safeText(v,2000,false){t.Fatal("valid text rejected",v)}
 }
 for _,v:=range []string{""," leading ","\t", "\x00","x\u202e","foo\u200dbar"}{
  if safeText(v,2000,false){t.Fatal("unsafe text accepted",v)}
 }
 if !safeText("",500,true){t.Fatal("empty bio rejected")}
 if !uuid.MatchString("12345678-1234-4123-8123-123456789abc"){t.Fatal("uuid rejected")}
 if uuid.MatchString("00000000-0000-0000-0000-000000000000"){t.Fatal("zero UUID accepted")}
 if _,e:=NewStore(nil);e==nil{t.Fatal("nil store accepted")}
 if _,e:=NewSignOn(&Store{},nil,make([]byte,32));e==nil{t.Fatal("nil broker accepted")}
 if _,e:=NewSignOn(&Store{},dummyBroker{},[]byte("short"));e==nil{t.Fatal("weak session key")}
 secret:=encodeToken(bytes.Repeat([]byte{1},32))
 if _,e:=NewHTTPBroker("https://auth.420integrated.org","https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",secret,nil);e!=nil{t.Fatal(e)}
 for _,v:=range []struct{authority,callback,client,secret string}{
  {"http://auth.420integrated.org","https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",secret},
  {"https://evil.invalid","https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",secret},
  {"https://auth.420integrated.org","https://evil.invalid/callback","bong-goggles",secret},
  {"https://auth.420integrated.org","https://bonggoggles.420integrated.org/social-api/auth/callback?next=1","bong-goggles",secret},
  {"https://auth.420integrated.org","https://bonggoggles.420integrated.org/social-api/auth/callback","420pay",secret},
  {"https://auth.420integrated.org","https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles","weak"},
 }{
  if _,e:=NewHTTPBroker(v.authority,v.callback,v.client,v.secret,nil);e==nil{t.Fatal("unsafe broker",v)}
 }
 key:=sha256.Sum256([]byte("an independent local test secret"))
 s:=&SignOn{key:key}
 plain:=[]byte("session-private-token")
 encrypted,e:=s.seal(plain);if e!=nil||bytes.Contains(encrypted,plain){t.Fatal("unencrypted session")}
 decrypted,e:=s.open(encrypted);if e!=nil||!bytes.Equal(decrypted,plain){t.Fatal("decrypt session",e)}
 encrypted[len(encrypted)-1]^=1;if _,e=s.open(encrypted);e==nil{t.Fatal("tampered ciphertext")}
 if _,e=decodeToken("bad");e==nil{t.Fatal("invalid session cookie")}
 if _,_,e=validCursor("invalid");e==nil{t.Fatal("invalid cursor")}
}
type dummyBroker struct{}
func (dummyBroker) Authorize(string,string)string{return "https://auth.420integrated.org"}
func (dummyBroker) Exchange(context.Context,string,string)(string,string,time.Time,error){return "","",time.Time{},ErrUnavailable}
func (dummyBroker) Introspect(context.Context,string)(string,bool,error){return "",false,ErrUnavailable}
func (dummyBroker) Revoke(context.Context,string)error{return ErrUnavailable}
var _ Broker=dummyBroker{}
var _ http.Handler=(*Handler)(nil)
