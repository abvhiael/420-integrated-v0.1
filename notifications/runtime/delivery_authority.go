package runtime

import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// HTTPDeliveryAuthority is only a protected control-plane transport: it cannot
// create consent or prove chain provenance. A qualified independent authority
// must return exact response scopes and deny absent/expired approvals.
type HTTPDeliveryAuthority struct {
 origin string
 bearer string
 httpClient *http.Client
}
func NewHTTPDeliveryAuthority(endpoint,secret string,client *http.Client)(*HTTPDeliveryAuthority,error){
 u,err:=url.Parse(endpoint)
 if err!=nil||u.Scheme!="https"||u.Hostname()==""||u.User!=nil||
  u.RawQuery!=""||u.Fragment!=""||(u.Path!=""&&u.Path!="/")||
  strings.Contains(u.Host,"@"){return nil,errors.New("delivery authority requires HTTPS root origin")}
 if len(secret)<32||len(secret)>4096{return nil,errors.New("invalid delivery authority bearer")}
 if client==nil{client=&http.Client{Timeout:5*time.Second}}
 if client.Timeout<=0||client.Timeout>30*time.Second{return nil,errors.New("unsafe authority timeout")}
 return &HTTPDeliveryAuthority{origin:u.Scheme+"://"+u.Host,bearer:secret,httpClient:client},nil
}
type scopedApproval struct{
 Approved bool `json:"approved"`
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 PolicyVersion string `json:"policyVersion"`
 EventID string `json:"eventId"`
 ChainID string `json:"chainId"`
 ServiceID string `json:"serviceId"`
}
func (a *HTTPDeliveryAuthority) check(ctx context.Context,path string,principal DeliveryPrincipal,d DeliverySubmit)(bool,error){
 payload:=struct{
  Principal DeliveryPrincipal `json:"principal"`
  Delivery DeliverySubmit `json:"delivery"`
 }{principal,d}
 data,err:=json.Marshal(payload);if err!=nil{return false,err}
 req,err:=http.NewRequestWithContext(ctx,"POST",a.origin+path,bytes.NewReader(data))
 if err!=nil{return false,err}
 req.Header.Set("Authorization","Bearer "+a.bearer)
 req.Header.Set("Content-Type","application/json")
 req.Header.Set("Accept","application/json")
 resp,err:=a.httpClient.Do(req)
 if err!=nil{return false,err}
 defer resp.Body.Close()
 if resp.StatusCode!=http.StatusOK{return false,errors.New("delivery authority refused request")}
 if !strings.HasPrefix(resp.Header.Get("Content-Type"),"application/json"){
  return false,errors.New("delivery authority invalid response type")
 }
 dec:=json.NewDecoder(io.LimitReader(resp.Body,4097));dec.DisallowUnknownFields()
 var v scopedApproval
 if err=dec.Decode(&v);err!=nil{return false,err}
 var extra any
 if err=dec.Decode(&extra);err!=io.EOF{return false,errors.New("delivery authority response overflow")}
 if !v.Approved||v.Tenant!=d.Tenant||v.UserID!=d.UserID||
  v.SubscriptionID!=d.SubscriptionID||v.Recipient!=d.Recipient||
  v.PolicyVersion!=d.PolicyVersion||v.EventID!=d.Event.EventID||
  v.ChainID!=d.Event.ChainID||v.ServiceID!=principal.ServiceID{
  return false,errors.New("delivery authority scope mismatch")
 }
 return true,nil
}
func (a *HTTPDeliveryAuthority) Consent(ctx context.Context,p DeliveryPrincipal,d DeliverySubmit)(DeliveryDecision,error){
 owner,err:=a.check(ctx,"/v1/notifications/owner",p,d)
 if err!=nil||!owner{return DeliveryDecision{},err}
 consent,err:=a.check(ctx,"/v1/notifications/consent",p,d)
 // The independent owner proof still permits cancellation after consent
 // withdrawal. Consent failure must not be mistaken for an owner change.
 if err!=nil{return DeliveryDecision{Owner:true,Consent:false},nil}
 return DeliveryDecision{Owner:true,Consent:consent},nil
}
func (a *HTTPDeliveryAuthority) Provenance(ctx context.Context,d DeliverySubmit)(bool,error){
 return a.check(ctx,"/v1/notifications/provenance",
  DeliveryPrincipal{ServiceID:"bet-worker",Tenant:d.Tenant},d)
}
