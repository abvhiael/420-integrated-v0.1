package complianceauth

import (
 "context"
 "errors"
 "time"
)

// C06.8 native/mobile clients must verify an independently issued device
// session for every decision request; a local cached ALLOW is never authority.
var ErrC068DeviceDenied=errors.New("mobile Compliance device session denied")
type C068DeviceSession struct{
 SubjectID string
 DeviceID string
 SessionID string
 Audience string
 Scope C064AuthorScope
 ExpiresAt time.Time
 Revoked bool
}
type C068DeviceAuthority interface{
 VerifyDeviceSession(context.Context,string)(C068DeviceSession,error)
}
type C068DeviceGate struct{
 Authority C068DeviceAuthority
 Now func()time.Time
}
func(g C068DeviceGate)Verify(ctx context.Context,token,deviceID,audience string)(C068DeviceSession,error){
 if ctx==nil||ctx.Err()!=nil||g.Authority==nil||len(token)<16||len(token)>4096||
 !c064ID.MatchString(deviceID)||audience==""{return C068DeviceSession{},ErrC068DeviceDenied}
 s,err:=g.Authority.VerifyDeviceSession(ctx,token)
 now:=time.Now().UTC();if g.Now!=nil{now=g.Now().UTC()}
 if err!=nil||s.Revoked||s.DeviceID!=deviceID||s.Audience!=audience||
 !c064ID.MatchString(s.SubjectID)||!c064ID.MatchString(s.SessionID)||
 !c051Scope(s.Scope.Tenant)||!c051Scope(s.Scope.Domain)||!c051Scope(s.Scope.Jurisdiction)||
 !now.Before(s.ExpiresAt){return C068DeviceSession{},ErrC068DeviceDenied}
 return s,nil
}
// RevalidateSession must be called immediately before returning protected
// data or committing a request, including after slow database/provider calls.
func(g C068DeviceGate)RevalidateSession(ctx context.Context,token string,pinned C068DeviceSession)error{
 fresh,err:=g.Verify(ctx,token,pinned.DeviceID,pinned.Audience)
 if err!=nil||fresh!=pinned{return ErrC068DeviceDenied}
 return nil
}
