package travelapp

import (
 "context"
 "errors"
 "testing"
 "time"
)

func TestDOOBRAudit3BoundaryMatrix(t *testing.T) {
 v := TravelCompatibilityVersion
 now := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
 start, end := now, now.Add(time.Hour)
 provider := ServiceProvider{SchemaVersion:v, ID:"provider1", PlaceID:"place1", IdentityRef:"identity:provider"}
 area := ServiceArea{SchemaVersion:v, ProviderID:"provider1", Region:"Saskatchewan", Country:"CA"}
 window := DeliveryWindow{SchemaVersion:v, ProviderID:"provider1", From:start, To:end}
 request := ServiceRequest{SchemaVersion:v, ID:"request1", ProviderID:"provider1", RequesterIdentityRef:"identity:requester", Window:window}
 for _, tc := range []struct{name string; validate func()error}{
  {"valid-provider", provider.Validate},
  {"valid-area", area.Validate},
  {"valid-window", window.Validate},
  {"valid-request", request.Validate},
 } {t.Run(tc.name,func(t *testing.T){if err:=tc.validate();err!=nil {t.Fatalf("valid schema: %v",err)}})}
 badProvider := provider;badProvider.SchemaVersion="travel-compat/v0"
 emptyIdentity := provider;emptyIdentity.IdentityRef=""
 controlIdentity := provider;controlIdentity.IdentityRef="identity:\nspoof"
 badArea := area;badArea.Region="Saskatchewan\n123 Private Street"
 blankArea := area;blankArea.Region=" "
 badWindow := window;badWindow.To=start
 reversedWindow := window;reversedWindow.From=end
 excessiveWindow := window;excessiveWindow.To=start.Add(367*24*time.Hour)
 badRequest := request;badRequest.Window.ProviderID="other"
 badNestedVersion := request;badNestedVersion.Window.SchemaVersion="travel-compat/v0"
 missingRequester := request;missingRequester.RequesterIdentityRef=""
 badRequestID := request;badRequestID.ID="../request"
 for _,tc := range []struct{name string;validate func()error}{
  {"provider-version",badProvider.Validate},
  {"provider-empty-identity",emptyIdentity.Validate},
  {"provider-control-character",controlIdentity.Validate},
  {"service-area-privacy-newline",badArea.Validate},
  {"service-area-empty-region",blankArea.Validate},
  {"window-zero-duration",badWindow.Validate},
  {"window-reversed",reversedWindow.Validate},
  {"window-over-366-days",excessiveWindow.Validate},
  {"request-mismatched-provider",badRequest.Validate},
  {"request-nested-version",badNestedVersion.Validate},
  {"request-missing-identity",missingRequester.Validate},
  {"request-invalid-id",badRequestID.Validate},
 }{t.Run(tc.name,func(t *testing.T){if err:=tc.validate();!errors.Is(err,ErrTravelContractInvalid){t.Fatalf("expected invalid contract, got %v",err)}})}
}

func TestDOOBRAudit3GatewayCannotBeEnabledByInput(t *testing.T) {
 tx:=GenesisTravelTransactions{}
 request:=ServiceRequest{SchemaVersion:TravelCompatibilityVersion,ID:"request1",ProviderID:"provider1",RequesterIdentityRef:"identity:requester",Window:DeliveryWindow{SchemaVersion:TravelCompatibilityVersion,ProviderID:"provider1",From:time.Now().UTC().Add(time.Hour),To:time.Now().UTC().Add(2*time.Hour)}}
 if err:=request.Validate();err!=nil{t.Fatalf("fixture invalid: %v",err)}
 for _,ctx:=range []context.Context{context.Background(),context.TODO(),func()context.Context{c,cancel:=context.WithCancel(context.Background());cancel();return c}()} {
  for _,r:=range []ServiceRequest{request,{}} {
   if err:=tx.RequestDelivery(ctx,r);!errors.Is(err,ErrTravelTransactionDisabled){t.Fatalf("gateway must fail closed for %v: %v",r.ID,err)}
  }
 }
}
