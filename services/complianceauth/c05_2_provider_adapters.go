package complianceauth

import (
 "context"
 "crypto/sha256"
 "crypto/subtle"
 "crypto/tls"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// CredentialProviderConfig binds each authority to a distinct pinned TLS
// origin and service identity. Tokens are injected by a credential source.
type CredentialProviderConfig struct {
 Name string
 BaseURL string
 Audience string
 ExpectedIssuer string
 Timeout time.Duration
}
type CredentialAuthorityRecord struct {
 Issuer string `json:"issuer"`
 Audience string `json:"audience"`
 Subject string `json:"subject"`
 TenantID string `json:"tenant_id"`
 EvidenceReference string `json:"evidence_reference"`
 EvidenceDigest string `json:"evidence_digest"`
 ExpiresAt time.Time `json:"expires_at"`
 Revoked bool `json:"revoked"`
 Active bool `json:"active"`
}
type CredentialProviderToken interface { Token(context.Context,string)(string,error) }
type CredentialProviderHTTP struct {
 Config CredentialProviderConfig
 Client *http.Client
 Tokens CredentialProviderToken
}
func(p CredentialProviderHTTP) Fetch(ctx context.Context,tenant,subject string,now time.Time)(CredentialAuthorityRecord,error){
 var zero CredentialAuthorityRecord
 c:=p.Config
 if ctx==nil||ctx.Err()!=nil||p.Client==nil||p.Tokens==nil||now.IsZero()||!c051Scope(tenant)||!c051Scope(subject)||!c051Scope(c.Name)||!c051Scope(c.Audience)||!c051Scope(c.ExpectedIssuer)||c.Timeout<=0||c.Timeout>30*time.Second {return zero,ErrUnavailable}
 u,e:=url.Parse(c.BaseURL)
 if e!=nil||u.Scheme!="https"||u.Hostname()==""||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Path!=""||u.Port()!="" {return zero,ErrUnavailable}
 if p.Client.Transport==nil {return zero,ErrUnavailable}
 tr,ok:=p.Client.Transport.(*http.Transport)
 if !ok||tr.TLSClientConfig==nil||tr.TLSClientConfig.InsecureSkipVerify||tr.Proxy!=nil||tr.DialContext!=nil||tr.DialTLSContext!=nil||tr.TLSClientConfig.MinVersion<tls.VersionTLS12{return zero,ErrUnavailable}
 token,e:=p.Tokens.Token(ctx,c.Audience);if e!=nil||len(token)<8||len(token)>4096{return zero,ErrUnavailable}
 requestCtx,cancel:=context.WithTimeout(ctx,c.Timeout);defer cancel()
 endpoint:=u.String()+"/v1/credentials?tenant="+url.QueryEscape(tenant)+"&subject="+url.QueryEscape(subject)
 req,e:=http.NewRequestWithContext(requestCtx,http.MethodGet,endpoint,nil);if e!=nil{return zero,ErrUnavailable}
 req.Header.Set("Authorization","Bearer "+token);req.Header.Set("Accept","application/json")
 client:=*p.Client
 client.CheckRedirect=func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}
 response,e:=client.Do(req);if e!=nil{return zero,ErrUnavailable};defer response.Body.Close()
 if response.StatusCode!=http.StatusOK||!strings.HasPrefix(response.Header.Get("Content-Type"),"application/json"){return zero,ErrUnavailable}
 d:=json.NewDecoder(io.LimitReader(response.Body,16<<10));d.DisallowUnknownFields()
 var record CredentialAuthorityRecord
 if e:=d.Decode(&record);e!=nil{return zero,ErrUnavailable}
 var extra any
 if e:=d.Decode(&extra);!errors.Is(e,io.EOF){return zero,ErrUnavailable}
 if record.Issuer!=c.ExpectedIssuer||record.Audience!=c.Audience||record.TenantID!=tenant||record.Subject!=subject||!record.Active||record.Revoked||!now.Before(record.ExpiresAt)||!digestValid(record.EvidenceDigest)||!c051Scope(record.EvidenceReference)||len(record.EvidenceReference)>128{return zero,ErrUnauthorized}
 return record,nil
}
type CredentialTriplet struct{ Identity,VerifyProvider,Registry CredentialProviderHTTP }
type CredentialTripletResult struct{ PrivateReferences [3]string; EvidenceDigest string }
func(t CredentialTriplet) Verify(ctx context.Context,tenant,subject string,now time.Time)(CredentialTripletResult,error){
 var zero CredentialTripletResult
 providers:=[]CredentialProviderHTTP{t.Identity,t.VerifyProvider,t.Registry}
 for i,n:=range []string{"Identity","Verify","Registry"} {if providers[i].Config.Name!=n{return zero,ErrUnavailable}}
 var results [3]CredentialAuthorityRecord
 for i,p:=range providers{
  r,e:=p.Fetch(ctx,tenant,subject,now);if e!=nil{return zero,e}
  results[i]=r
 }
 // Scoped private references are never returned by public HTTP guidance.
 for i,r:=range results{zero.PrivateReferences[i]=r.EvidenceReference}
 payload:=results[0].EvidenceDigest+results[1].EvidenceDigest+results[2].EvidenceDigest
 sum:=sha256.Sum256([]byte(payload));zero.EvidenceDigest=hex.EncodeToString(sum[:])
 if subtle.ConstantTimeCompare([]byte(results[0].Subject),[]byte(results[1].Subject))!=1||results[1].Subject!=results[2].Subject{return CredentialTripletResult{},ErrUnauthorized}
 return zero,nil
}
