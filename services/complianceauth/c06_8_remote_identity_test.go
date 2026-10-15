package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c068RemoteProvider struct{session C068DeviceSession;err error}
func(p *c068RemoteProvider)IntrospectDevice(context.Context,string)(C068DeviceSession,error){return p.session,p.err}
func TestC068ExternalRevocationAndConsumption(t *testing.T){
 now:=time.Now().UTC()
 p:=&c068RemoteProvider{session:C068DeviceSession{SubjectID:"user1",DeviceID:"phone1",SessionID:"session1",Audience:"420Travel",Scope:C064AuthorScope{Tenant:"tenant1",Domain:"travel",Jurisdiction:"BC"},ExpiresAt:now.Add(time.Hour)}}
 g:=C068DeviceGate{Authority:C068ExternalDeviceAuthority{Provider:p},Now:func()time.Time{return now}}
 token:="remote-introspection-token"
 pinned,err:=g.Verify(context.Background(),token,"phone1","420Travel")
 if err!=nil{t.Fatal(err)}
 if _,err=g.Verify(context.Background(),token,"phone1","DOOBr");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("Travel device token consumed by DOOBr")}
 p.session.Revoked=true
 if err=g.RevalidateSession(context.Background(),token,pinned);!errors.Is(err,ErrC068DeviceDenied){t.Fatal("independent issuer revocation ignored")}
 p.session.Revoked=false;p.err=ErrUnavailable
 if err=g.RevalidateSession(context.Background(),token,pinned);!errors.Is(err,ErrC068DeviceDenied){t.Fatal("identity outage admitted stale session")}
}
