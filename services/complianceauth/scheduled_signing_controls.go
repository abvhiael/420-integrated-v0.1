package complianceauth

import (
 "context"
 "encoding/base64"
 "crypto/ed25519"
 "errors"
 "sync"
 "time"
)

// ManagedManifestSigner is a separate KMS/HSM workload authority. The
// application never supplies, persists or exports a signing private key.
type ManagedManifestSigner interface {
 SignManifest(context.Context,string,[]byte)([]byte,error)
}
type PublicationKeyState struct {
 KeyID string
 Environment string
 Domain string
 Jurisdiction string
 Audience string
 PublicKey ed25519.PublicKey
 NotBefore time.Time
 NotAfter time.Time
 Compromised bool
}
type PublicationControl struct {
 mu sync.RWMutex
 keys map[string]PublicationKeyState
 halted map[string]bool
 epoch uint64
}
func controlScope(env,domain,jurisdiction string)string{return base64.RawURLEncoding.EncodeToString([]byte(env))+"."+base64.RawURLEncoding.EncodeToString([]byte(domain))+"."+base64.RawURLEncoding.EncodeToString([]byte(jurisdiction))}
func NewPublicationControl()*PublicationControl{return &PublicationControl{keys:map[string]PublicationKeyState{},halted:map[string]bool{},epoch:1}}
func(c *PublicationControl) RegisterKey(k PublicationKeyState)error{
 if c==nil||k.KeyID==""||k.Environment==""||k.Domain==""||k.Jurisdiction==""||k.Audience==""||len(k.PublicKey)!=ed25519.PublicKeySize||k.NotBefore.IsZero()||!k.NotBefore.Before(k.NotAfter){return ErrUnauthorized}
 c.mu.Lock();defer c.mu.Unlock()
 if _,exists:=c.keys[k.KeyID];exists{return ErrUnauthorized}
 k.PublicKey=append(ed25519.PublicKey(nil),k.PublicKey...)
 c.keys[k.KeyID]=k
 return nil
}
// EmergencyHalt is restrictive only; unhalting is deliberately unavailable
// through this emergency API and must follow independently approved recovery.
func(c *PublicationControl) EmergencyHalt(environment,domain,jurisdiction string)error{
 if c==nil||environment==""||domain==""||jurisdiction==""{return ErrUnauthorized}
 c.mu.Lock();defer c.mu.Unlock()
 c.halted[controlScope(environment,domain,jurisdiction)]=true;c.epoch++
 return nil
}
func(c *PublicationControl) CompromiseKey(keyID string)error{
 if c==nil||keyID==""{return ErrUnauthorized}
 c.mu.Lock();defer c.mu.Unlock()
 k,ok:=c.keys[keyID];if !ok{return ErrUnauthorized}
 k.Compromised=true;c.keys[keyID]=k;c.epoch++
 return nil
}
func(c *PublicationControl) AllowManifest(m Manifest,now time.Time)error{
 if c==nil||now.IsZero(){return ErrUnauthorized}
 c.mu.RLock();defer c.mu.RUnlock()
 k,ok:=c.keys[m.KeyID]
 if !ok||k.Compromised||c.halted[controlScope(m.Environment,m.Domain,m.Jurisdiction)]||
 k.Environment!=m.Environment||k.Domain!=m.Domain||k.Jurisdiction!=m.Jurisdiction||k.Audience!=m.Audience||
 now.Before(k.NotBefore)||!now.Before(k.NotAfter)||m.RevocationEpoch<c.epoch||
 m.EffectiveFrom.IsZero()||now.Before(m.EffectiveFrom)||!now.Before(m.EffectiveUntil)||!now.Before(m.ReviewExpiresAt){return ErrUnauthorized}
 return nil
}
// SignScheduledManifest never accepts an in-process private key and refuses
// stale, compromised, unreviewed or out-of-scope scheduled policies.
func(c *PublicationControl) SignScheduledManifest(ctx context.Context,signer ManagedManifestSigner,m Manifest,now time.Time)(SignedManifest,error){
 if ctx==nil||ctx.Err()!=nil||signer==nil||m.Schema!="420compliance-policy/v1"||!digestValid(m.PolicyDigest)||!digestValid(m.ReviewDigest)||m.Sequence==0{return SignedManifest{},ErrUnauthorized}
 if err:=c.AllowManifest(m,now);err!=nil{return SignedManifest{},err}
 bytes,err:=canonical(m);if err!=nil{return SignedManifest{},err}
 sig,err:=signer.SignManifest(ctx,m.KeyID,bytes)
 if err!=nil{return SignedManifest{},errors.Join(ErrUnavailable,err)}
 if len(sig)!=ed25519.SignatureSize{return SignedManifest{},ErrUnauthorized}
 c.mu.RLock()
 k,ok:=c.keys[m.KeyID]
 valid:=ok&&!k.Compromised&&!c.halted[controlScope(m.Environment,m.Domain,m.Jurisdiction)]&&m.RevocationEpoch>=c.epoch&&ed25519.Verify(k.PublicKey,bytes,sig)
 c.mu.RUnlock()
 if !valid||ctx.Err()!=nil{return SignedManifest{},ErrUnauthorized}
 return SignedManifest{Manifest:m,Signature:sig},nil
}
func(c *PublicationControl) VerifyScheduledManifest(s SignedManifest,now time.Time)error{
 if err:=c.AllowManifest(s.Manifest,now);err!=nil{return err}
 c.mu.RLock();k:=c.keys[s.Manifest.KeyID];c.mu.RUnlock()
 trust:=Trust{Keys:map[string]Key{s.Manifest.KeyID:{Public:k.PublicKey,Environment:k.Environment}},Environment:k.Environment,Audience:k.Audience,Domain:k.Domain,Jurisdiction:k.Jurisdiction,MinimumEpoch:s.Manifest.RevocationEpoch,MinimumSequence:1}
 return trust.Verify(s,now)
}
