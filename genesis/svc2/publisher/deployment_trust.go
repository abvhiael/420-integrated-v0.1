package publisher

import (
 "context"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "strings"
 "time"
)

// OperatorCredential is a deployment-provisioned verifier, not a plaintext
// credential. Rotate by overlapping two enabled key IDs, then revoke the old.
// The source data and decision journal never provide this configuration.
type OperatorCredential struct {
 OperatorID string `json:"operator_id"`
 KeyID string `json:"key_id"`
 SHA256 string `json:"sha256"`
 Enabled bool `json:"enabled"`
 NotBefore time.Time `json:"not_before"`
 NotAfter time.Time `json:"not_after"`
}

type DeploymentTrustConfig struct {
 Schema string `json:"schema"`
 Operators []OperatorGrant `json:"operators"`
 Sources []SourceGrant `json:"sources"`
 Credentials []OperatorCredential `json:"credentials"`
}

const trustSchema = "420-svc2-operator-trust-v1"

type credentialContextKey struct{}
type credentialClaim struct { keyID string; token []byte }

// WithOperatorCredential is ONLY for an authenticated, restricted local operator
// transport; no public HTTP service may accept or construct this context.
func WithOperatorCredential(ctx context.Context,keyID string,secret []byte) context.Context {
 return context.WithValue(ctx,credentialContextKey{},credentialClaim{keyID:keyID,token:append([]byte(nil),secret...)})
}

type DeploymentPrincipal struct { credentials []OperatorCredential; clock func()time.Time }
func (p DeploymentPrincipal) AuthenticatedOperator(ctx context.Context)(string,error) {
 if p.clock==nil{return "",ErrUnauthorized}
 claim,ok:=ctx.Value(credentialContextKey{}).(credentialClaim)
 if !ok||claim.keyID==""||len(claim.token)<32{return "",ErrUnauthorized}
 now:=p.clock().UTC()
 sum:=sha256.Sum256(claim.token)
 for _,c:=range p.credentials {
  if c.Enabled&&c.KeyID==claim.keyID&&!now.Before(c.NotBefore)&&now.Before(c.NotAfter) {
   expected,err:=hex.DecodeString(c.SHA256)
   if err==nil&&len(expected)==sha256.Size&&subtle.ConstantTimeCompare(sum[:],expected)==1{return c.OperatorID,nil}
  }
 }
 return "",ErrUnauthorized
}

// LoadDeploymentTrust rejects absent, symlinked, writable-by-others, invalid or
// unpinned trust config. The expected digest must come from an independent
// deployment secret/configuration channel, never the config file itself.
func LoadDeploymentTrust(path,expectedSHA256 string,clock func()time.Time)(TrustPolicy,error){
 if strings.TrimSpace(path)==""||clock==nil||!validDigest(expectedSHA256){return TrustPolicy{},errors.New("deployment trust configuration, pinned digest and clock required")}
 info,err:=os.Lstat(path);if err!=nil{return TrustPolicy{},err}
 if !info.Mode().IsRegular()||info.Mode().Perm()&0077!=0||info.Size()<2||info.Size()>1<<20{return TrustPolicy{},errors.New("unsafe trust config permissions, size or type")}
 data,err:=os.ReadFile(path);if err!=nil{return TrustPolicy{},err}
 sum:=sha256.Sum256(data)
 if subtle.ConstantTimeCompare(sum[:],mustDecodeDigest(expectedSHA256))!=1{return TrustPolicy{},errors.New("trust config digest differs from deployment pin")}
 var cfg DeploymentTrustConfig
 if err=json.Unmarshal(data,&cfg);err!=nil{return TrustPolicy{},fmt.Errorf("invalid trust config: %w",err)}
 if cfg.Schema!=trustSchema||len(cfg.Operators)==0||len(cfg.Sources)==0||len(cfg.Credentials)==0{return TrustPolicy{},errors.New("incomplete deployment trust config")}
 seen:=map[string]bool{}
 for _,c:=range cfg.Credentials {
  if c.OperatorID==""||c.KeyID==""||seen[c.KeyID]||!validDigest(c.SHA256)||!c.NotBefore.Before(c.NotAfter){return TrustPolicy{},errors.New("invalid or duplicate operator credential")}
  seen[c.KeyID]=true
 }
 // Copy the values to avoid callers mutating the trust configuration after load.
 return TrustPolicy{Operators:cfg.Operators,Sources:cfg.Sources,Resolver:DeploymentPrincipal{credentials:cfg.Credentials,clock:clock},Clock:clock},nil
}
func mustDecodeDigest(s string)[]byte{b,_:=hex.DecodeString(s);return b}
