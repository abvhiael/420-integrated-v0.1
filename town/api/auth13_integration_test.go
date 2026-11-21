package api

import (
 "bytes"
 "database/sql"
 "net/http"
 "net/http/httptest"
 "testing"

 gateway "github.com/420integrated/420-integrated/services/420id/app-gateway"
)

func TestAUTH13TownExplicitWalletFreeGatewayAdmission(t *testing.T){
 var s Server
 if e:=s.Enable420ID(nil);e==nil{t.Fatal("nil account bridge accepted")}
 makeGateway:=func(app string)*gateway.Gateway{
  g,e:=gateway.New(gateway.Config{AppID:app,DB:&sql.DB{},
   ClientSecret:bytes.Repeat([]byte{12},32),
   SessionKey:bytes.Repeat([]byte{34},32),TrustedTLSProxy:true})
  if e!=nil{t.Fatal(e)}
  return g
 }
 if e:=s.Enable420ID(makeGateway("420pay"));e==nil{t.Fatal("financial app identity substituted for Town")}
 if e:=s.Enable420ID(makeGateway("420town"));e!=nil{t.Fatal("approved Town account gateway rejected",e)}
 for _,r:=range []*http.Request{
  httptest.NewRequest("GET","https://evil.org/v1/posts/example",nil),
  httptest.NewRequest("POST","https://town.420integrated.org/v1/posts/example",nil),
 }{
  r.Header.Set("Authorization","Bearer malformed")
  if _,e:=s.account420.Current(r.Context(),r);e==nil{
   t.Fatal("untrusted HTTP session accepted")
  }
 }
}
