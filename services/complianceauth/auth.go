// Package complianceauth provides fail-closed offline policy publication and discovery validation.
// It does not issue legal approvals or enable regulated transactions.
package complianceauth

import (
 "crypto/ed25519"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "net/url"
 "strings"
 "time"
)
var ErrUnauthorized=errors.New("compliance authorization denied")
var ErrUnavailable=errors.New("compliance authority unavailable")
type Endpoint struct { Name string `json:"name"`; URL string `json:"url"`; Audience string `json:"audience"`; Environment string `json:"environment"`; ExpiresAt time.Time `json:"expires_at"` }
type Directory struct { Entries map[string]Endpoint; AllowedHosts map[string]bool; Environment string }
func(d Directory) Resolve(name,audience string,now time.Time)(Endpoint,error){
 e,ok:=d.Entries[name];if !ok||name==""||e.Name!=name||e.Audience!=audience||e.Environment!=d.Environment||!now.Before(e.ExpiresAt){return Endpoint{},ErrUnavailable}
 u,err:=url.Parse(e.URL);if err!=nil||u.Scheme!="https"||u.Hostname()==""||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||!d.AllowedHosts[u.Hostname()]||strings.Contains(e.URL,"@"){return Endpoint{},ErrUnavailable}
 return e,nil
}
type Manifest struct {
 Schema string `json:"schema"`
 PolicyDigest string `json:"policy_digest"`
 ReviewDigest string `json:"review_digest"`
 Domain string `json:"domain"`
 Jurisdiction string `json:"jurisdiction"`
 Audience string `json:"audience"`
 Environment string `json:"environment"`
 KeyID string `json:"key_id"`
 Sequence uint64 `json:"sequence"`
 RevocationEpoch uint64 `json:"revocation_epoch"`
 EffectiveFrom time.Time `json:"effective_from"`
 EffectiveUntil time.Time `json:"effective_until"`
 ReviewExpiresAt time.Time `json:"review_expires_at"`
}
type SignedManifest struct{ Manifest Manifest `json:"manifest"`; Signature []byte `json:"signature"` }
type Approval struct{ Digest string; AuthorID string; ReviewerID string; PublisherID string; IndependentlyVerified bool }
type Key struct{ Public ed25519.PublicKey; Environment string; Revoked bool }
type Trust struct{ Keys map[string]Key; MinimumSequence uint64; MinimumEpoch uint64; Environment string; Audience string; Domain string; Jurisdiction string }
func digestValid(s string)bool{if len(s)!=64{return false};_,err:=hex.DecodeString(s);return err==nil}
func canonical(m Manifest)([]byte,error){return json.Marshal(m)}
// Publish requires independently verified review and separate author/reviewer/publisher.
// Private signing key is injected from an external managed key service, never generated or stored here.
func Publish(m Manifest,a Approval,private ed25519.PrivateKey)(SignedManifest,error){
 if !a.IndependentlyVerified||a.AuthorID==""||a.ReviewerID==""||a.PublisherID==""||a.AuthorID==a.ReviewerID||a.AuthorID==a.PublisherID||a.ReviewerID==a.PublisherID||!digestValid(m.PolicyDigest)||!digestValid(m.ReviewDigest)||subtle.ConstantTimeCompare([]byte(a.Digest),[]byte(m.PolicyDigest))!=1||m.Schema!="420compliance-policy/v1"||m.Sequence==0||m.KeyID==""||len(private)!=ed25519.PrivateKeySize{return SignedManifest{},ErrUnauthorized}
 data,err:=canonical(m);if err!=nil{return SignedManifest{},err};return SignedManifest{m,ed25519.Sign(private,data)},nil
}
// Verify returns no policy authorization if signature, scope, temporal validity, key or epoch fail.
func(t Trust)Verify(s SignedManifest,now time.Time)error{
 m:=s.Manifest;k,ok:=t.Keys[m.KeyID]
 if !ok||k.Revoked||k.Environment!=t.Environment||m.Environment!=t.Environment||m.Audience!=t.Audience||m.Domain!=t.Domain||m.Jurisdiction!=t.Jurisdiction||m.Schema!="420compliance-policy/v1"||!digestValid(m.PolicyDigest)||!digestValid(m.ReviewDigest)||m.Sequence<t.MinimumSequence||m.RevocationEpoch<t.MinimumEpoch||m.Sequence==0||len(k.Public)!=ed25519.PublicKeySize||len(s.Signature)!=ed25519.SignatureSize{return ErrUnauthorized}
 if now.Before(m.EffectiveFrom)||!now.Before(m.EffectiveUntil)||!now.Before(m.ReviewExpiresAt)||!m.EffectiveFrom.Before(m.EffectiveUntil){return ErrUnauthorized}
 data,err:=canonical(m);if err!=nil{return err}
 if !ed25519.Verify(k.Public,data,s.Signature){return ErrUnauthorized}
 return nil
}
type PolicyGate struct{ Trust Trust; Discovery Directory; Enabled bool; LegalApproval bool; PartnerApproval bool; RuntimeAccepted bool }
func(g PolicyGate)Authorize(s SignedManifest,service string,now time.Time)error{
 if !g.Enabled||!g.LegalApproval||!g.PartnerApproval||!g.RuntimeAccepted{return ErrUnauthorized}
 if err:=g.Trust.Verify(s,now);err!=nil{return err}
 if _,err:=g.Discovery.Resolve(service,g.Trust.Audience,now);err!=nil{return err}
 // No automatic ALLOW: downstream evaluated evidence and action-specific gates remain mandatory.
 return fmt.Errorf("%w: no runtime evaluator or stage-bound decision",ErrUnauthorized)
}
func Digest(data []byte)string{d:=sha256.Sum256(data);return hex.EncodeToString(d[:])}
