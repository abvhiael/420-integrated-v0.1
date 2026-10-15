package complianceauth

import (
 "context"
 "errors"
)

// The integration adapter queries an independent identity provider on EVERY
// verification. No local positive-cache fallback on outage/revocation.
type C068RemoteIdentityProvider interface {
 IntrospectDevice(context.Context,string)(C068DeviceSession,error)
}
type C068ExternalDeviceAuthority struct{ Provider C068RemoteIdentityProvider }
func(a C068ExternalDeviceAuthority)VerifyDeviceSession(ctx context.Context,token string)(C068DeviceSession,error){
 if ctx==nil||ctx.Err()!=nil||a.Provider==nil{return C068DeviceSession{},ErrC068DeviceDenied}
 s,err:=a.Provider.IntrospectDevice(ctx,token)
 if err!=nil||s.Revoked{return C068DeviceSession{},errors.Join(ErrC068DeviceDenied,err)}
 return s,nil
}
var _ C068DeviceAuthority=C068ExternalDeviceAuthority{}
