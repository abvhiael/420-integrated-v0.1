package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c066SessionProvider struct{session C066OperatorSession; err error}
func(p c066SessionProvider)VerifyOperator(_ context.Context,_ string)(C066OperatorSession,error){return p.session,p.err}
type c066SourceProvider struct{ fail bool }
func(p c066SourceProvider)SourceStatus(_ context.Context,_ C064AuthorScope,_ time.Time)([]SourceHealthDecision,error){
 if p.fail{return nil,ErrUnavailable}
 return []SourceHealthDecision{{SourceID:"official_source",Status:"SOURCE_HEALTHY_REVIEW_CURRENT_AUTHORIZATION_UNPROVEN"}},nil
}
type c066AppProvider struct{}
func(c066AppProvider)AffectedApps(_ context.Context,_ C064AuthorScope)([]C066AffectedApp,error){return []C066AffectedApp{{Name:"Travel",Status:"UNKNOWN",ObservedAt:time.Date(2026,10,12,12,0,0,0,time.UTC)}},nil}
type c066KeyProvider struct{}
func(c066KeyProvider)KeyStatus(_ context.Context,scope C064AuthorScope,now time.Time)([]PublicationKeyState,error){return []PublicationKeyState{{KeyID:"key_1",Domain:scope.Domain,Jurisdiction:scope.Jurisdiction,NotBefore:now.Add(-time.Hour),NotAfter:now.Add(time.Hour)}},nil}
func TestC066OperatorDashboardHaltAndFailClosed(t *testing.T){
 now:=time.Date(2026,10,12,16,0,0,0,time.UTC)
 scope:=C064AuthorScope{Tenant:"tenant1",Domain:"travel",Jurisdiction:"BC"}
 s:=C066OperatorSession{SubjectID:"operator1",SessionID:"session1",Role:"publisher_operator",Scope:scope,ExpiresAt:now.Add(5*time.Minute)}
 o:=C066Operations{Sessions:c066SessionProvider{session:s},Sources:c066SourceProvider{},Apps:c066AppProvider{},Keys:c066KeyProvider{},Control:NewPublicationControl(),Now:func()time.Time{return now}}
 token:="verified-operator-session-opaque"
 out,err:=o.Dashboard(context.Background(),token)
 if err!=nil||out.ReleaseEnabled||len(out.Keys)!=1||len(out.Sources)!=1||len(out.Apps)!=1{t.Fatalf("dashboard fail closed: %+v %v",out,err)}
 if err:=o.Halt(context.Background(),token,"production");err!=nil{t.Fatal(err)}
 if !o.Control.halted[controlScope("production",scope.Domain,scope.Jurisdiction)]{t.Fatal("halt absent")}
 if err:=o.PublishScheduled(context.Background(),token,PublicationFence{},PublicationFence{},SignedManifest{},now);!errors.Is(err,ErrC066Denied){t.Fatal("unreviewed release accepted",err)}
 o.Sources=c066SourceProvider{fail:true}
 if _,err:=o.Dashboard(context.Background(),token);!errors.Is(err,ErrC066Denied){t.Fatal("outage exposed guessed status")}
 o.Sources=c066SourceProvider{}
 s.Role="author";o.Sessions=c066SessionProvider{session:s}
 if err:=o.Halt(context.Background(),token,"production");!errors.Is(err,ErrC066Denied){t.Fatal("author gained operator access")}
 s.Role="publisher_operator";s.Revoked=true;o.Sessions=c066SessionProvider{session:s}
 if _,err:=o.Dashboard(context.Background(),token);!errors.Is(err,ErrC066Denied){t.Fatal("revoked operator gained dashboard")}
 s.Revoked=false;s.ExpiresAt=now;o.Sessions=c066SessionProvider{session:s}
 if err:=o.Halt(context.Background(),token,"production");!errors.Is(err,ErrC066Denied){t.Fatal("expired session authorized halt")}
}
