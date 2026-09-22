package publisher

import (
 "context"
 "errors"
 "strings"
 "time"
)

// PrincipalResolver authenticates the operator from deployment-controlled
// context (for example an authenticated CLI/session); a Decision.OperatorID is
// never trusted as an identity assertion. No HTTP handler is provided here.
type PrincipalResolver interface { AuthenticatedOperator(context.Context)(string,error) }

type OperatorGrant struct { ID string; Enabled bool; Actions []Action; Kinds []Kind }
type SourceGrant struct { Namespace string; Enabled bool; Kinds []Kind; ManifestID,TermsRef,AttributionRef string; NotBefore,NotAfter time.Time }

// TrustPolicy must be loaded from operator-controlled configuration separately
// from incoming import payloads and the decision journal. Never parse it from
// SourceEvidence or let an import replace this policy.
type TrustPolicy struct {
 Operators []OperatorGrant
 Sources []SourceGrant
 Resolver PrincipalResolver
 Clock func()time.Time
}
func containsAction(all []Action,v Action)bool{for _,x:=range all{if x==v{return true}};return false}
func containsKind(all []Kind,v Kind)bool{for _,x:=range all{if x==v{return true}};return false}
func (p TrustPolicy) Authorize(ctx context.Context,claimed string,action Action,kind Kind)error{
 if p.Resolver==nil||p.Clock==nil||strings.TrimSpace(claimed)==""{return ErrUnauthorized}
 actual,err:=p.Resolver.AuthenticatedOperator(ctx)
 if err!=nil||actual==""||actual!=claimed{return ErrUnauthorized}
 for _,grant:=range p.Operators{
  if grant.ID==actual&&grant.Enabled&&containsAction(grant.Actions,action)&&containsKind(grant.Kinds,kind){return nil}
 }
 return ErrUnauthorized
}
func(p TrustPolicy) VerifySource(_ context.Context,e SourceEvidence,kind Kind)error{
 if p.Clock==nil||strings.TrimSpace(e.Namespace)==""||strings.TrimSpace(e.RecordID)==""||strings.TrimSpace(e.ManifestID)==""{return ErrUntrustedSource}
 now:=p.Clock().UTC();if now.IsZero(){return ErrUntrustedSource}
 for _,grant:=range p.Sources{
  if grant.Namespace==e.Namespace&&grant.Enabled&&containsKind(grant.Kinds,kind)&&grant.ManifestID==e.ManifestID&&grant.TermsRef==e.TermsRef&&grant.AttributionRef==e.AttributionRef&&!grant.NotBefore.IsZero()&&!grant.NotAfter.IsZero()&&!now.Before(grant.NotBefore)&&now.Before(grant.NotAfter)&&!e.RetrievedAt.After(now.Add(5*time.Minute)) {return nil}
 }
 return ErrUntrustedSource
}
func NewTrustedDurableLedger(path string,key []byte,p TrustPolicy)(*DurableLedger,error){
 if p.Resolver==nil||p.Clock==nil||len(p.Operators)==0||len(p.Sources)==0{return nil,errors.New("deployment trust policy, resolver and clock required")}
 return OpenDurableLedger(path,key,p,p,p.Clock)
}
