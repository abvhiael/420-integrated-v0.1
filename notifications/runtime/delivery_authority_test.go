package runtime

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

func TestIndependentHTTPSDeliveryAuthorityEnforcesExactScopes(t *testing.T){
 request:=testDelivery()
 consentAllowed:=true
 token:=strings.Repeat("s",64)
 server:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"||r.Header.Get("Authorization")!="Bearer "+token{
   http.Error(w,"unauthorized",401);return
  }
  var body struct{
   Principal DeliveryPrincipal `json:"principal"`
   Delivery DeliverySubmit `json:"delivery"`
  }
  if err:=json.NewDecoder(r.Body).Decode(&body);err!=nil{http.Error(w,"invalid",400);return}
  if body.Principal.ServiceID!="bet-worker"||body.Delivery.Tenant!="420bet"{
   http.Error(w,"wrong source",403);return
  }
  approved:=r.URL.Path!="/v1/notifications/consent"||consentAllowed
  w.Header().Set("Content-Type","application/json")
  _=json.NewEncoder(w).Encode(scopedApproval{
   Approved:approved,Tenant:body.Delivery.Tenant,
   UserID:body.Delivery.UserID,SubscriptionID:body.Delivery.SubscriptionID,
   Recipient:body.Delivery.Recipient,PolicyVersion:body.Delivery.PolicyVersion,
   EventID:body.Delivery.Event.EventID,ChainID:body.Delivery.Event.ChainID,
   ServiceID:body.Principal.ServiceID,
  })
 }))
 defer server.Close()
 client:=server.Client()
 client.Timeout=3*time.Second
 authority,err:=NewHTTPDeliveryAuthority(server.URL,token,client)
 if err!=nil{t.Fatal(err)}
 principal:=DeliveryPrincipal{ServiceID:"bet-worker",Tenant:"420bet"}
 approved,err:=authority.Consent(context.Background(),principal,request)
 if err!=nil||!approved.Owner||!approved.Consent{t.Fatalf("positive consent: %#v %v",approved,err)}
 provenance,err:=authority.Provenance(context.Background(),request)
 if err!=nil||!provenance{t.Fatalf("positive provenance: %v",err)}
 consentAllowed=false
 revoked,err:=authority.Consent(context.Background(),principal,request)
 if err!=nil||!revoked.Owner||revoked.Consent{
  t.Fatalf("revoked subscriber must retain ownership: %#v %v",revoked,err)
 }
 wrong:=DeliveryPrincipal{ServiceID:"malicious-app",Tenant:"other"}
 denied,e:=authority.Consent(context.Background(),wrong,request)
 if e==nil&&denied.Owner{t.Fatal("wrong service scope authorized")}
}
func TestIndependentDeliveryAuthorityRejectsInsecureOrMissingConfiguration(t *testing.T){
 if _,err:=NewHTTPDeliveryAuthority("http://authority.example",strings.Repeat("s",64),nil);err==nil{
  t.Fatal("non-TLS authority accepted")
 }
 if _,err:=NewHTTPDeliveryAuthority("https://authority.example","short",nil);err==nil{
  t.Fatal("unqualified secret accepted")
 }
 if _,err:=NewHTTPDeliveryAuthority("https://example.com/root",strings.Repeat("s",64),nil);err==nil{
  t.Fatal("unapproved authority path accepted")
 }
}
