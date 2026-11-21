//go:build account420_integration

package social

import (
 "context"
 "strings"
 "testing"
)

// Simulates the separately authenticated 420ID confidential permission read.
// The ordinary fakeBroker's session map remains authoritative for revocation.
func (b *fakeBroker) Monetization(ctx context.Context,token string)(string,bool,*MonetizationStatus,error){
 subject,active,e:=b.Introspect(ctx,token)
 if e!=nil||!active{return subject,active,nil,e}
 return subject,true,&MonetizationStatus{
  App:"bong-goggles",PolicyVersion:1,Version:1,RewardOptIn:true,
  RewardStage:"wallet_required",CreatorStage:"not_enrolled",
  Source:"420id-consent-v1",
 },nil
}
func TestAUTH11PrivateMonetizationStatusRevocationAndModeGate(t *testing.T){
 _,broker,_,h:=fixture(t)
 a:=login(t,h,broker,memberA)
 b:=login(t,h,broker,memberB)
 if result:=request(h,"GET","/v1/monetization","",a);result.Code!=404{
  t.Fatal("AUTH-11 exposed before activation",result.Code)
 }
 if e:=h.EnableMonetization();e!=nil{t.Fatal(e)}
 if result:=request(h,"GET","/v1/monetization","");result.Code!=401{t.Fatal("anonymous read",result.Code)}
 if result:=request(h,"POST","/v1/monetization","{}",a);result.Code!=404{t.Fatal("browser write accepted",result.Code)}
 if result:=request(h,"GET","/v1/monetization","",a);result.Code!=200{
  t.Fatal("420ID confidential status unavailable",result.Code,result.Body.String())
 }else if result.Header().Get("Cache-Control")!="no-store"||
  !containsAll(result.Body.String(),`"rewardOptIn":true`,`"walletLinked":false`,`"canClaim":false`,`"financialAuthority":false`){
  t.Fatal("status claims paid authority",result.Body.String())
 }
 if result:=request(h,"GET","/v1/monetization","",b);result.Code!=200{t.Fatal("other app member denied",result.Code)}
 broker.mu.Lock();broker.tokens=map[string]string{};broker.mu.Unlock()
 if result:=request(h,"GET","/v1/monetization","",a);result.Code!=401{t.Fatal("revoked parent retained monetization",result.Code)}
}
func TestAUTH11MonetizationBrokerUnavailableFailsClosed(t *testing.T){
 store,broker,sign,h:=fixture(t)
 a:=login(t,h,broker,memberA)
 _=store
 sso:=&struct{Broker}{Broker:broker}
 sign.Broker=sso
 if e:=h.EnableMonetization();e==nil{t.Fatal("provider without scoped introspection accepted")}
 if result:=request(h,"GET","/v1/monetization","",a);result.Code!=404{t.Fatal("disconnected programme exposed",result.Code)}
}
func containsAll(haystack string,needles ...string)bool{
 for _,n:=range needles{if !strings.Contains(haystack,n){return false}}
 return true
}
