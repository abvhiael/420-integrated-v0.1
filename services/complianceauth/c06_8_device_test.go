package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c068Provider struct{session C068DeviceSession; err error}
func(p *c068Provider)VerifyDeviceSession(context.Context,string)(C068DeviceSession,error){return p.session,p.err}
func TestC068MobileDeviceSessionRevocationAndBoundary(t *testing.T){
 now:=time.Date(2026,10,12,18,0,0,0,time.UTC)
 p:=&c068Provider{session:C068DeviceSession{SubjectID:"user1",DeviceID:"phone1",SessionID:"sess1",Audience:"420Travel",Scope:C064AuthorScope{Tenant:"tenant1",Domain:"travel",Jurisdiction:"BC"},ExpiresAt:now.Add(time.Hour)}}
 g:=C068DeviceGate{Authority:p,Now:func()time.Time{return now}}
 token:="opaque-mobile-token"
 pinned,err:=g.Verify(context.Background(),token,"phone1","420Travel")
 if err!=nil{t.Fatal(err)}
 if err:=g.RevalidateSession(context.Background(),token,pinned);err!=nil{t.Fatal(err)}
 if _,err:=g.Verify(context.Background(),token,"otherphone","420Travel");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("cross-device replay accepted")}
 if _,err:=g.Verify(context.Background(),token,"phone1","DOOBr");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("cross-app replay accepted")}
 p.session.Revoked=true
 if err:=g.RevalidateSession(context.Background(),token,pinned);!errors.Is(err,ErrC068DeviceDenied){t.Fatal("revoked device retained cached authorization")}
 p.session.Revoked=false;p.session.SessionID="rotated"
 if err:=g.RevalidateSession(context.Background(),token,pinned);!errors.Is(err,ErrC068DeviceDenied){t.Fatal("rotated session accepted")}
 p.session.SessionID="sess1";p.session.ExpiresAt=now
 if _,err:=g.Verify(context.Background(),token,"phone1","420Travel");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("expired device accepted")}
 p.session.ExpiresAt=now.Add(time.Hour)
 cancelled,cancel:=context.WithCancel(context.Background());cancel()
 if _,err:=g.Verify(cancelled,token,"phone1","420Travel");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("cancelled request accepted")}
 p.err=ErrUnavailable
 if _,err:=g.Verify(context.Background(),token,"phone1","420Travel");!errors.Is(err,ErrC068DeviceDenied){t.Fatal("identity outage accepted")}
}
