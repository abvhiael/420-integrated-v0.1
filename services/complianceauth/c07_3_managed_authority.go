package complianceauth

import (
 "bytes"
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "crypto/tls"
 "crypto/x509"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/url"
 "sync"
 "time"
)

var ErrC073Unavailable=errors.New("compliance managed authority unavailable")
type C073CertificateSource interface{Certificate(context.Context)(tls.Certificate,error)}
type C073Config struct{
 Origin,Issuer,Audience,Environment,ClientIdentity,ServerIdentity,ManifestAudience,DatabaseHost string
 Scope C064AuthorScope
 MinimumGeneration uint64
 Timeout time.Duration
}
type C073SecretRecord struct{
 Nonce string `json:"nonce"`
 Purpose string `json:"purpose"`
 Issuer string `json:"issuer"`
 Audience string `json:"audience"`
 Environment string `json:"environment"`
 Workload string `json:"workload"`
 Scope C064AuthorScope `json:"scope"`
 Generation uint64 `json:"generation"`
 NotBefore time.Time `json:"not_before"`
 ExpiresAt time.Time `json:"expires_at"`
 Revoked bool `json:"revoked"`
 ActiveKeyID string `json:"active_key_id"`
 StorageKeys map[string][]byte `json:"storage_keys"`
 SigningKeys map[string]PublicationKeyState `json:"signing_keys"`
 MinimumEpoch uint64 `json:"minimum_epoch"`
 Token []byte `json:"token"`
 DatabaseDSN string `json:"database_dsn"`
}
// Client retains only configuration and monotonic generation floors, never secrets.
// Provision certificate sources and roots externally. No in-process key generation.
type C073Client struct{config C073Config;client *http.Client;mu sync.Mutex;generation map[string]uint64}
func c073Identity(raw string)bool{u,e:=url.Parse(raw);return e==nil&&u.Scheme=="spiffe"&&u.Host!=""&&u.Port()==""&&u.User==nil&&u.RawQuery==""&&u.Fragment==""&&u.Path!=""}
func c073Certificate(cert tls.Certificate,identity string,now time.Time)bool{
 if len(cert.Certificate)==0||cert.PrivateKey==nil{return false};leaf,e:=x509.ParseCertificate(cert.Certificate[0]);if e!=nil||now.Before(leaf.NotBefore)||!now.Before(leaf.NotAfter){return false}
 if len(leaf.URIs)!=1||leaf.URIs[0].String()!=identity{return false};for _,usage:=range leaf.ExtKeyUsage{if usage==x509.ExtKeyUsageClientAuth{return true}};return false
}
func NewC073Client(c C073Config,roots *x509.CertPool,certificates C073CertificateSource)(*C073Client,error){
 u,e:=url.Parse(c.Origin)
 if e!=nil||u.Scheme!="https"||u.Hostname()==""||u.User!=nil||u.Path!=""||u.RawQuery!=""||u.Fragment!=""||roots==nil||certificates==nil||!c073Identity(c.ClientIdentity)||!c073Identity(c.ServerIdentity)||c.ClientIdentity==c.ServerIdentity||!c051Scope(c.Issuer)||!c051Scope(c.Audience)||!c051Scope(c.Scope.Tenant)||!c051Scope(c.Scope.Domain)||!c051Scope(c.Scope.Jurisdiction)||!c051Scope(c.ManifestAudience)||(c.Environment!="production"&&c.Environment!="testnet")||c.MinimumGeneration==0||c.MinimumGeneration>9223372036854775807||c.Timeout<time.Millisecond||c.Timeout>5*time.Second{return nil,ErrC073Unavailable}
 tr:=&http.Transport{Proxy:nil,DisableKeepAlives:true,TLSHandshakeTimeout:c.Timeout,ResponseHeaderTimeout:c.Timeout,TLSClientConfig:&tls.Config{MinVersion:tls.VersionTLS13,RootCAs:roots.Clone(),ServerName:u.Hostname()}}
 tr.TLSClientConfig.GetClientCertificate=func(request *tls.CertificateRequestInfo)(*tls.Certificate,error){ctx,cancel:=context.WithTimeout(request.Context(),c.Timeout);defer cancel();cert,e:=certificates.Certificate(ctx);if e!=nil||ctx.Err()!=nil||!c073Certificate(cert,c.ClientIdentity,time.Now().UTC()){return nil,ErrC073Unavailable};return &cert,nil}
 tr.TLSClientConfig.VerifyConnection=func(state tls.ConnectionState)error{if len(state.VerifiedChains)==0||len(state.PeerCertificates)==0||len(state.PeerCertificates[0].URIs)!=1||state.PeerCertificates[0].URIs[0].String()!=c.ServerIdentity{return ErrC073Unavailable};return nil}
 client:=&http.Client{Transport:tr,Timeout:c.Timeout,CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}}
 return &C073Client{config:c,client:client,generation:map[string]uint64{}},nil
}
func(p *C073Client)Close(){if p!=nil&&p.client!=nil{p.client.CloseIdleConnections()}}
func c073Nonce()string{v:=make([]byte,32);if _,e:=rand.Read(v);e!=nil{return ""};return hex.EncodeToString(v)}
func(p *C073Client)exchange(ctx context.Context,path string,input,output any,token []byte)error{
 if p==nil||p.client==nil||ctx==nil||ctx.Err()!=nil{return ErrC073Unavailable}
 raw,e:=json.Marshal(input);if e!=nil||len(raw)>C071MaxPrivateBytes{return ErrC073Unavailable}
 bounded,cancel:=context.WithTimeout(ctx,p.config.Timeout);defer cancel();request,e:=http.NewRequestWithContext(bounded,http.MethodPost,p.config.Origin+path,bytes.NewReader(raw));if e!=nil{return ErrC073Unavailable}
 request.Header.Set("Content-Type","application/json");request.Header.Set("Accept","application/json");if len(token)>0{request.Header.Set("Authorization","Bearer "+string(token))}
 response,e:=p.client.Do(request);if e!=nil{return ErrC073Unavailable};defer response.Body.Close()
 if response.StatusCode!=http.StatusOK||response.Header.Get("Content-Type")!="application/json"{return ErrC073Unavailable}
 body,e:=io.ReadAll(io.LimitReader(response.Body,C071MaxPrivateBytes+1));if e!=nil||len(body)>C071MaxPrivateBytes{return ErrC073Unavailable}
 decoder:=json.NewDecoder(bytes.NewReader(body));decoder.DisallowUnknownFields();if decoder.Decode(output)!=nil{return ErrC073Unavailable};var extra any
 if !errors.Is(decoder.Decode(&extra),io.EOF)||bounded.Err()!=nil{return ErrC073Unavailable};return nil
}
func(p *C073Client)acceptGeneration(purpose string,g uint64)bool{
 p.mu.Lock();defer p.mu.Unlock();if g<p.config.MinimumGeneration||g<p.generation[purpose]||g>9223372036854775807{return false};p.generation[purpose]=g;return true
}
func c073Token(v []byte)bool{if len(v)<16||len(v)>4096{return false};for _,b:=range v{if b<33||b>126{return false}};return true}
// Every use re-introspects. No positive cache on broker outage, rotation or revocation.
func(p *C073Client)read(ctx context.Context,purpose string)(C073SecretRecord,error){
 var r C073SecretRecord;if p==nil||(purpose!="storage-encryption"&&purpose!="credential-token"&&purpose!="manifest-signing"&&purpose!="database-credential"){return r,ErrC073Unavailable};nonce:=c073Nonce();if nonce==""{return r,ErrC073Unavailable}
 input:=struct{Nonce,Purpose,Audience,Environment,Workload string;Scope C064AuthorScope}{nonce,purpose,p.config.Audience,p.config.Environment,p.config.ClientIdentity,p.config.Scope}
 if p.exchange(ctx,"/v1/secrets",input,&r,nil)!=nil{return C073SecretRecord{},ErrC073Unavailable};now:=time.Now().UTC()
 if r.Nonce!=nonce||r.Purpose!=purpose||r.Issuer!=p.config.Issuer||r.Audience!=p.config.Audience||r.Environment!=p.config.Environment||r.Workload!=p.config.ClientIdentity||r.Scope!=p.config.Scope||r.Revoked||r.NotBefore.IsZero()||r.NotBefore.After(now)||!now.Before(r.ExpiresAt)||r.ExpiresAt.After(now.Add(5*time.Minute)){return C073SecretRecord{},ErrC073Unavailable}
 switch purpose{
 case "storage-encryption":
  if len(r.Token)!=0||r.DatabaseDSN!=""||len(r.SigningKeys)!=0{return C073SecretRecord{},ErrC073Unavailable};if _,e:=NewC071Cipher(r.ActiveKeyID,r.StorageKeys);e!=nil{return C073SecretRecord{},ErrC073Unavailable}
 case "credential-token":
  if !c073Token(r.Token)||len(r.StorageKeys)!=0||len(r.SigningKeys)!=0||r.DatabaseDSN!=""{return C073SecretRecord{},ErrC073Unavailable}
 case "database-credential":
  u,e:=url.Parse(r.DatabaseDSN);if e!=nil||p.config.DatabaseHost==""||u.Hostname()!=p.config.DatabaseHost||ValidProductionDSN(r.DatabaseDSN)!=nil||len(r.StorageKeys)!=0||len(r.SigningKeys)!=0||len(r.Token)!=0{return C073SecretRecord{},ErrC073Unavailable}
 case "manifest-signing":
  if !c073Token(r.Token)||len(r.StorageKeys)!=0||r.DatabaseDSN!=""||len(r.SigningKeys)==0||len(r.SigningKeys)>8||r.MinimumEpoch==0||!c064ID.MatchString(r.ActiveKeyID){return C073SecretRecord{},ErrC073Unavailable}
  for id,k:=range r.SigningKeys{if id!=k.KeyID||!c064ID.MatchString(id)||len(k.PublicKey)!=ed25519.PublicKeySize||k.Environment!=p.config.Environment||k.Domain!=p.config.Scope.Domain||k.Jurisdiction!=p.config.Scope.Jurisdiction||k.Audience!=p.config.ManifestAudience||k.NotBefore.IsZero()||!k.NotBefore.Before(k.NotAfter){return C073SecretRecord{},ErrC073Unavailable}}
  active,ok:=r.SigningKeys[r.ActiveKeyID];if !ok||active.Compromised||now.Before(active.NotBefore)||!now.Before(active.NotAfter){return C073SecretRecord{},ErrC073Unavailable}
 }
 if !p.acceptGeneration(purpose,r.Generation){return C073SecretRecord{},ErrC073Unavailable};return r,nil
}
func(p *C073Client)Token(ctx context.Context,audience string)(string,error){if p==nil||audience!=p.config.Audience{return "",ErrC073Unavailable};r,e:=p.read(ctx,"credential-token");if e!=nil{return "",ErrC073Unavailable};return string(r.Token),nil}
func(p *C073Client)LoadEncryptionKeys(ctx context.Context)(*C071Cipher,error){r,e:=p.read(ctx,"storage-encryption");if e!=nil{return nil,ErrC073Unavailable};return NewC071Cipher(r.ActiveKeyID,r.StorageKeys)}
func NewC073ManagedCipher(ctx context.Context,p *C073Client)(*C071Cipher,error){if p==nil{return nil,ErrC073Unavailable};if _,e:=p.LoadEncryptionKeys(ctx);e!=nil{return nil,ErrC073Unavailable};return &C071Cipher{provider:p},nil}
func(p *C073Client)PublicationKey(ctx context.Context,id string)(PublicationKeyState,uint64,error){r,e:=p.read(ctx,"manifest-signing");if e!=nil{return PublicationKeyState{},0,ErrC073Unavailable};k,ok:=r.SigningKeys[id];if !ok||k.Compromised{return PublicationKeyState{},0,ErrC073Unavailable};return k,r.MinimumEpoch,nil}
func(p *C073Client)SignManifest(ctx context.Context,id string,payload []byte)([]byte,error){
 if p==nil||len(payload)>16384{return nil,ErrC073Unavailable};var m Manifest;d:=json.NewDecoder(bytes.NewReader(payload));d.DisallowUnknownFields();if d.Decode(&m)!=nil{return nil,ErrC073Unavailable};canonicalBytes,_:=canonical(m);if !bytes.Equal(canonicalBytes,payload)||m.Schema!="420compliance-policy/v1"||!digestValid(m.PolicyDigest)||!digestValid(m.ReviewDigest)||m.Sequence==0||m.KeyID!=id||m.Environment!=p.config.Environment||m.Domain!=p.config.Scope.Domain||m.Jurisdiction!=p.config.Scope.Jurisdiction||m.Audience!=p.config.ManifestAudience{return nil,ErrC073Unavailable}
 r,e:=p.read(ctx,"manifest-signing");if e!=nil||r.ActiveKeyID!=id{return nil,ErrC073Unavailable};k:=r.SigningKeys[id];now:=time.Now().UTC();if m.RevocationEpoch<r.MinimumEpoch||now.Before(m.EffectiveFrom)||!now.Before(m.EffectiveUntil)||!now.Before(m.ReviewExpiresAt){return nil,ErrC073Unavailable}
 nonce:=c073Nonce();input:=struct{Nonce,KeyID,Digest string;Payload []byte;Generation uint64}{nonce,id,Digest(payload),payload,r.Generation}
 var result struct{Nonce,KeyID,Digest string;Signature []byte;Generation uint64}
 if nonce==""||p.exchange(ctx,"/v1/sign",input,&result,r.Token)!=nil||result.Nonce!=nonce||result.KeyID!=id||result.Digest!=Digest(payload)||result.Generation!=r.Generation||!p.acceptGeneration("manifest-signing",result.Generation)||len(result.Signature)!=ed25519.SignatureSize||!ed25519.Verify(k.PublicKey,payload,result.Signature){return nil,ErrC073Unavailable};current,e:=p.read(ctx,"manifest-signing");if e!=nil||current.ActiveKeyID!=id||current.Generation!=r.Generation||current.MinimumEpoch>m.RevocationEpoch||!bytes.Equal(current.SigningKeys[id].PublicKey,k.PublicKey){return nil,ErrC073Unavailable};return result.Signature,nil
}
func(p *C073Client)VerifyServiceIdentity(ctx context.Context)error{_,e:=p.read(ctx,"database-credential");return e}
func OpenC073ProductionRuntime(ctx context.Context,p *C073Client,authority IndependentPublicationAuthority)(*ProductionPublicationRuntime,*PublicationControl,error){
 if p==nil||authority==nil||p.config.Environment!="production"{return nil,nil,ErrC073Unavailable};credentials,e:=p.read(ctx,"database-credential");if e!=nil{return nil,nil,ErrC073Unavailable};cipher,e:=NewC073ManagedCipher(ctx,p);if e!=nil{return nil,nil,e}
 runtime,e:=OpenC072ProductionRuntime(ctx,credentials.DatabaseDSN,p.config.Scope,controlScope(p.config.Environment,p.config.Scope.Domain,p.config.Scope.Jurisdiction),cipher,authority);if e!=nil{return nil,nil,ErrC073Unavailable}
 runtime.Durable.Identity=p;control:=NewPublicationControl();control.ExternalKeys=p;return runtime,control,nil
}
var _ ManagedManifestSigner=(*C073Client)(nil)
var _ CredentialProviderToken=(*C073Client)(nil)
