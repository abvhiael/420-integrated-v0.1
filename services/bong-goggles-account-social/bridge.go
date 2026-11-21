package social

import (
 "bytes"
 "context"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/url"
 "regexp"
 "strings"
 "time"
)

var tokenPattern=regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
// Broker is the ONLY trusted 420ID SSO authority. Session and subject are
// minted by 420ID, never by the browser or the social service.
type Broker interface {
 Authorize(state,challenge string)string
 Exchange(ctx context.Context,code,verifier string)(token,subject string,expires time.Time,err error)
 Introspect(ctx context.Context,token string)(subject string,active bool,err error)
 Revoke(ctx context.Context,token string)error
}
type HTTPBroker struct {
 base,callback,clientID,secret string
 httpClient *http.Client
}
func NewHTTPBroker(authority,callback,clientID,secret string,client *http.Client)(*HTTPBroker,error){
 u,e:=url.Parse(authority)
 if e!=nil||u.Scheme!="https"||u.Host==""||u.Port()!=""||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Path!=""&&u.Path!="/"||
  u.Hostname()!="auth.420integrated.org"||u.String()!=authority{return nil,ErrInvalid}
 cb,e:=url.Parse(callback)
 if e!=nil||cb.Scheme!="https"||cb.Hostname()!="bonggoggles.420integrated.org"||cb.Port()!=""||
  cb.Path!="/social-api/auth/callback"||cb.RawQuery!=""||cb.Fragment!=""||cb.User!=nil||cb.String()!=callback||
  clientID!="bong-goggles"{return nil,ErrInvalid}
 b,e:=base64.RawURLEncoding.Strict().DecodeString(secret)
 if e!=nil||len(b)!=32||!tokenPattern.MatchString(secret){return nil,ErrInvalid}
 if client==nil{client=&http.Client{Timeout:5*time.Second}}
 cloned:=*client
 cloned.CheckRedirect=func(_ *http.Request,_ []*http.Request)error{return errors.New("redirect forbidden")}
 return &HTTPBroker{base:strings.TrimSuffix(authority,"/"),callback:callback,clientID:clientID,secret:secret,httpClient:&cloned},nil
}
func (b *HTTPBroker) Authorize(state,challenge string)string{
 u,_:=url.Parse(b.base+"/sso/authorize")
 q:=u.Query()
 q.Set("app",b.clientID)
 q.Set("redirect_uri",b.callback)
 q.Set("state",state)
 q.Set("code_challenge",challenge)
 q.Set("code_challenge_method","S256")
 u.RawQuery=q.Encode()
 return u.String()
}
func (b *HTTPBroker) exchange(ctx context.Context,path string,payload any,out any)error{
 raw,e:=json.Marshal(payload);if e!=nil{return ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,"POST",b.base+path,bytes.NewReader(raw));if e!=nil{return ErrUnavailable}
 req.Header.Set("Content-Type","application/json")
 req.Header.Set("Accept","application/json")
 req.SetBasicAuth(b.clientID,b.secret)
 resp,e:=b.httpClient.Do(req);if e!=nil{return ErrUnavailable}
 defer resp.Body.Close()
 if resp.StatusCode!=200||!strings.HasPrefix(resp.Header.Get("Content-Type"),"application/json"){return ErrUnavailable}
 data,e:=io.ReadAll(io.LimitReader(resp.Body,4097));if e!=nil||len(data)>4096{return ErrUnavailable}
 decoder:=json.NewDecoder(bytes.NewReader(data));decoder.DisallowUnknownFields()
 if decoder.Decode(out)!=nil||decoder.Decode(&struct{}{})!=io.EOF{return ErrUnavailable}
 return nil
}
func (b *HTTPBroker) Exchange(ctx context.Context,code,verifier string)(string,string,time.Time,error){
 if !tokenPattern.MatchString(code)||!tokenPattern.MatchString(verifier){return "","",time.Time{},ErrInvalid}
 var result struct {
  AccessToken string `json:"accessToken"`
  TokenType string `json:"tokenType"`
  Session struct{
   Subject struct{App string `json:"app"`;ID string `json:"sub"`} `json:"subject"`
   Method string `json:"method"`
   ExpiresAt time.Time `json:"expiresAt"`
   IdleUntil time.Time `json:"idleUntil"`
   ID string `json:"id"`
   IssuedAt time.Time `json:"issuedAt"`
  } `json:"session"`
 }
 e:=b.exchange(ctx,"/v1/sso/token",map[string]string{
 "code":code,"codeVerifier":verifier,"redirectUri":b.callback,
 },&result)
 if e!=nil{return "","",time.Time{},e}
 if !tokenPattern.MatchString(result.AccessToken)||result.TokenType!="Bearer"||
  result.Session.Method!="sso"||result.Session.Subject.App!=b.clientID||!uuid.MatchString(result.Session.Subject.ID)||
  result.Session.ExpiresAt.IsZero()||result.Session.IdleUntil.IsZero(){return "","",time.Time{},ErrUnavailable}
 until:=result.Session.ExpiresAt
 if result.Session.IdleUntil.Before(until){until=result.Session.IdleUntil}
 if !until.After(time.Now()){return "","",time.Time{},ErrUnavailable}
 return result.AccessToken,result.Session.Subject.ID,until,nil
}
// Explicit AUTH-11 data is private readiness, not token entitlement.
type MonetizationStatus struct {
 App string `json:"app"`
 PolicyVersion int `json:"policyVersion"`
 Version int64 `json:"version"`
 RewardOptIn bool `json:"rewardOptIn"`
 CreatorOptIn bool `json:"creatorOptIn"`
 WalletLinked bool `json:"walletLinked"`
 RewardStage string `json:"rewardStage"`
 CreatorStage string `json:"creatorStage"`
 CanClaim bool `json:"canClaim"`
 Paid bool `json:"paid"`
 PaymentAuthorized bool `json:"paymentAuthorized"`
 FinancialAuthority bool `json:"financialAuthority"`
 Source string `json:"source"`
}
type ssoInspect struct {
 Active bool `json:"active"`
 Subject *struct{App string `json:"app"`;ID string `json:"sub"`} `json:"subject"`
 ExpiresAt time.Time `json:"expiresAt"`
 IdleUntil time.Time `json:"idleUntil"`
 Method string `json:"method"`
 Monetization *MonetizationStatus `json:"monetization,omitempty"`
}
func (b *HTTPBroker) inspect(ctx context.Context,token string)(ssoInspect,error){
 var result ssoInspect
 if !tokenPattern.MatchString(token){return result,ErrInvalid}
 if e:=b.exchange(ctx,"/v1/sso/introspect",map[string]string{"token":token},&result);e!=nil{return result,e}
 if !result.Active{return result,nil}
 if result.Subject==nil||result.Subject.App!=b.clientID||!uuid.MatchString(result.Subject.ID)||
 result.Method!="sso"||!result.ExpiresAt.After(time.Now())||!result.IdleUntil.After(time.Now()){
  return ssoInspect{},ErrUnavailable
 }
 return result,nil
}
func (b *HTTPBroker) Introspect(ctx context.Context,token string)(string,bool,error){
 result,e:=b.inspect(ctx,token)
 if e!=nil{return "",false,e}
 if !result.Active{return "",false,nil}
 return result.Subject.ID,true,nil
}
func validateMonetizationStatus(s *MonetizationStatus)bool{
 if s==nil{return true}
 if s.App!="bong-goggles"||s.PolicyVersion!=1||s.Version<0||
  s.Source!="420id-consent-v1"||s.CanClaim||s.Paid||s.PaymentAuthorized||s.FinancialAuthority{return false}
 switch s.RewardStage{case "not_enrolled","wallet_required","canonical_verification_required":default:return false}
 switch s.CreatorStage{case "not_enrolled","operator_programme_required":default:return false}
 if (!s.RewardOptIn&&s.RewardStage!="not_enrolled")||
   (s.RewardOptIn&&!s.WalletLinked&&s.RewardStage!="wallet_required")||
   (s.RewardOptIn&&s.WalletLinked&&s.RewardStage!="canonical_verification_required")||
   (!s.CreatorOptIn&&s.CreatorStage!="not_enrolled")||
   (s.CreatorOptIn&&s.CreatorStage!="operator_programme_required"){return false}
 return true
}
// Only returned to the verified same-app session. Never accepts caller
// wallet claims; the central 420ID confidential authority decides readiness.
func (b *HTTPBroker) Monetization(ctx context.Context,token string)(string,bool,*MonetizationStatus,error){
 result,e:=b.inspect(ctx,token)
 if e!=nil{return "",false,nil,e}
 if !result.Active{return "",false,nil,nil}
 if !validateMonetizationStatus(result.Monetization){return "",false,nil,ErrUnavailable}
 return result.Subject.ID,true,result.Monetization,nil
}
func (b *HTTPBroker) Revoke(ctx context.Context,token string)error{
 if !tokenPattern.MatchString(token){return ErrInvalid}
 var result struct{Revoked bool `json:"revoked"`}
 if e:=b.exchange(ctx,"/v1/sso/revoke",map[string]string{"token":token},&result);e!=nil{return e}
 if !result.Revoked{return ErrUnavailable}
 return nil
}
func digestValue(raw []byte)[32]byte{return sha256.Sum256(raw)}
