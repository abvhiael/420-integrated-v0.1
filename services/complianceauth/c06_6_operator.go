package complianceauth

import (
 "context"
 "errors"
 "time"
)

// C06.6 is an operator orchestration boundary, not independent legal approval.
// Status reports never grant permission; all release decisions require the
// pre-existing independently verified publication authority and durable fence.
var ErrC066Denied=errors.New("publisher/operator action denied")
type C066OperatorSession struct {
 SubjectID string
 Role string
 Scope C064AuthorScope
 SessionID string
 ExpiresAt time.Time
 Revoked bool
}
type C066OperatorAuthority interface {
 VerifyOperator(context.Context,string)(C066OperatorSession,error)
}
type C066SourceStatus interface {
 SourceStatus(context.Context,C064AuthorScope,time.Time)([]SourceHealthDecision,error)
}
type C066AffectedApp struct {
 Name string `json:"name"`
 Status string `json:"status"`
 ObservedAt time.Time `json:"observed_at"`
}
type C066AppStatus interface {
 AffectedApps(context.Context,C064AuthorScope)([]C066AffectedApp,error)
}
type C066KeyStatus interface {
 KeyStatus(context.Context,C064AuthorScope,time.Time)([]PublicationKeyState,error)
}
type C066OperatorDashboard struct {
 Scope C064AuthorScope `json:"scope"`
 Sources []SourceHealthDecision `json:"sources"`
 Apps []C066AffectedApp `json:"apps"`
 Keys []C066KeySummary `json:"keys"`
 ReleaseEnabled bool `json:"release_enabled"`
}
type C066KeySummary struct {
 KeyID string `json:"key_id"`
 Compromised bool `json:"compromised"`
 Active bool `json:"active"`
}
type C066Operations struct {
 Sessions C066OperatorAuthority
 Sources C066SourceStatus
 Apps C066AppStatus
 Keys C066KeyStatus
 Control *PublicationControl
 Runtime *ProductionPublicationRuntime
 Now func()time.Time
}
func(o C066Operations)now()time.Time{if o.Now!=nil{return o.Now().UTC()};return time.Now().UTC()}
func(o C066Operations)authorize(ctx context.Context,token string)(C066OperatorSession,error){
 if ctx==nil||ctx.Err()!=nil||o.Sessions==nil||len(token)<16||len(token)>4096{return C066OperatorSession{},ErrC066Denied}
 s,err:=o.Sessions.VerifyOperator(ctx,token)
 if err!=nil||s.Revoked||s.Role!="publisher_operator"||!c064ID.MatchString(s.SubjectID)||
 !c064ID.MatchString(s.SessionID)||!c051Scope(s.Scope.Tenant)||!c051Scope(s.Scope.Domain)||
 !c051Scope(s.Scope.Jurisdiction)||!o.now().Before(s.ExpiresAt){return C066OperatorSession{},ErrC066Denied}
 return s,nil
}
func(o C066Operations)Dashboard(ctx context.Context,token string)(C066OperatorDashboard,error){
 s,err:=o.authorize(ctx,token)
 if err!=nil||o.Sources==nil||o.Apps==nil||o.Keys==nil||o.Control==nil{return C066OperatorDashboard{},ErrC066Denied}
 now:=o.now()
 sources,e1:=o.Sources.SourceStatus(ctx,s.Scope,now)
 apps,e2:=o.Apps.AffectedApps(ctx,s.Scope)
 keys,e3:=o.Keys.KeyStatus(ctx,s.Scope,now)
 if e1!=nil||e2!=nil||e3!=nil||len(sources)>1024||len(apps)>1024||len(keys)>1024{return C066OperatorDashboard{},ErrC066Denied}
 out:=C066OperatorDashboard{Scope:s.Scope,Sources:sources,Apps:apps,ReleaseEnabled:false}
 for _,a:=range apps {if a.Name==""||a.Status==""||a.ObservedAt.IsZero()||a.ObservedAt.After(now){return C066OperatorDashboard{},ErrC066Denied}}
 for _,k:=range keys{
  if !c064ID.MatchString(k.KeyID)||k.Domain!=s.Scope.Domain||k.Jurisdiction!=s.Scope.Jurisdiction{return C066OperatorDashboard{},ErrC066Denied}
  out.Keys=append(out.Keys,C066KeySummary{KeyID:k.KeyID,Compromised:k.Compromised,Active:!k.Compromised&&!now.Before(k.NotBefore)&&now.Before(k.NotAfter)})
 }
 // Source status is informative, not renewed legal review.
 for _,src:=range sources{if src.MayAuthorize||src.ReviewRenewed{return C066OperatorDashboard{},ErrC066Denied}}
 fresh,err:=o.authorize(ctx,token)
 if err!=nil||fresh!=s{return C066OperatorDashboard{},ErrC066Denied}
 return out,nil
}
// Halt is restrictive-only. It never clears a halt or renews legal approval.
func(o C066Operations)Halt(ctx context.Context,token,environment string)error{
 s,err:=o.authorize(ctx,token)
 if err!=nil||o.Control==nil||environment==""{return ErrC066Denied}
 fresh,e:=o.authorize(ctx,token)
 if e!=nil||fresh!=s{return ErrC066Denied}
 return o.Control.EmergencyHalt(environment,s.Scope.Domain,s.Scope.Jurisdiction)
}
// PublishScheduled delegates actual authority to the preexisting independent
// publisher. It cannot mint a review signature or bypass CAS/fencing.
func(o C066Operations)PublishScheduled(ctx context.Context,token string,old,next PublicationFence,signed SignedManifest,scheduledAt time.Time)error{
 s,e:=o.authorize(ctx,token)
 if e!=nil||o.Runtime==nil||o.Control==nil||scheduledAt.IsZero()||o.now().Before(scheduledAt){return ErrC066Denied}
 if old.Scope!=next.Scope||old.Scope!=controlScope("production",s.Scope.Domain,s.Scope.Jurisdiction)||
 !ValidPublicationFence(old,o.now())||!ValidPublicationFence(next,o.now()){return ErrC066Denied}
 m:=signed.Manifest
 if m.Environment!="production"||m.Domain!=s.Scope.Domain||m.Jurisdiction!=s.Scope.Jurisdiction||
 m.Sequence!=next.Sequence||m.PolicyDigest!=next.PolicyDigest||
 m.RevocationEpoch!=next.RevocationEpoch||o.Control.VerifyScheduledManifest(signed,o.now())!=nil{return ErrC066Denied}
 // Independently owned publication authorization remains mandatory in Runtime.Publish.
 fresh,e:=o.authorize(ctx,token)
 if e!=nil||fresh!=s{return ErrC066Denied}
 if err:=o.Runtime.Publish(ctx,old,next,o.now());err!=nil{return errors.Join(ErrC066Denied,err)}
 return nil
}
