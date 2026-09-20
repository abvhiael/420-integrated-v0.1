package travelapp

import (
 "context"
 "errors"
 "testing"
 "time"
)

func TestGenesisCompatibilitySchemas(t *testing.T) {
 v:=TravelCompatibilityVersion
 from:=time.Now().UTC().Add(24*time.Hour)
 to:=from.Add(2*24*time.Hour)
 valid:=[]struct{name string; check func()error}{
  {"property",func()error{return (Property{SchemaVersion:v,ID:"p-1",PlaceID:"place-1",HostID:"host-1"}).Validate()}},
  {"host",func()error{return (Host{SchemaVersion:v,ID:"host-1",IdentityRef:"identity:host"}).Validate()}},
  {"guest",func()error{return (Guest{SchemaVersion:v,ID:"guest-1",IdentityRef:"identity:guest"}).Validate()}},
  {"availability",func()error{return (Availability{SchemaVersion:v,PropertyID:"p-1",From:from,To:to}).Validate()}},
  {"nightly-price",func()error{return (NightlyPrice{SchemaVersion:v,PropertyID:"p-1",Currency:"CAD",AmountMinor:10000,ProviderRef:"pricing:external"}).Validate()}},
  {"reservation",func()error{return (Reservation{SchemaVersion:v,ID:"r-1",PropertyID:"p-1",GuestID:"guest-1",From:from,To:to}).Validate()}},
  {"service-provider",func()error{return (ServiceProvider{SchemaVersion:v,ID:"provider-1",PlaceID:"place-1",IdentityRef:"identity:provider"}).Validate()}},
  {"service-area",func()error{return (ServiceArea{SchemaVersion:v,ProviderID:"provider-1",Region:"Saskatchewan",Country:"CA"}).Validate()}},
  {"delivery-window",func()error{return (DeliveryWindow{SchemaVersion:v,ProviderID:"provider-1",From:from,To:to}).Validate()}},
  {"service-request",func()error{return (ServiceRequest{SchemaVersion:v,ID:"request-1",ProviderID:"provider-1",RequesterIdentityRef:"identity:requester",Window:DeliveryWindow{SchemaVersion:v,ProviderID:"provider-1",From:from,To:to}}).Validate()}},
 }
 for _,tc:=range valid {t.Run(tc.name,func(t *testing.T){if err:=tc.check();err!=nil{t.Fatalf("valid contract rejected: %v",err)}})}
 invalid:=[]struct{name string; check func()error}{
  {"missing-version",func()error{return (Property{ID:"p",PlaceID:"place",HostID:"host"}).Validate()}},
  {"bad-id",func()error{return (Property{SchemaVersion:v,ID:"../p",PlaceID:"place",HostID:"host"}).Validate()}},
  {"missing-identity",func()error{return (Host{SchemaVersion:v,ID:"h"}).Validate()}},
  {"zero-window",func()error{return (Availability{SchemaVersion:v,PropertyID:"p",From:from,To:from}).Validate()}},
  {"backwards-reservation",func()error{return (Reservation{SchemaVersion:v,ID:"r",PropertyID:"p",GuestID:"g",From:to,To:from}).Validate()}},
  {"invalid-currency",func()error{return (NightlyPrice{SchemaVersion:v,PropertyID:"p",Currency:"cad",ProviderRef:"provider"}).Validate()}},
  {"private-address-in-area",func()error{return (ServiceArea{SchemaVersion:v,ProviderID:"p",Region:"Saskatchewan\n123 Private Street",Country:"CA"}).Validate()}},
  {"mismatched-delivery-provider",func()error{return (ServiceRequest{SchemaVersion:v,ID:"r",ProviderID:"p1",RequesterIdentityRef:"identity:requester",Window:DeliveryWindow{SchemaVersion:v,ProviderID:"p2",From:from,To:to}}).Validate()}},
 }
 for _,tc:=range invalid {t.Run(tc.name,func(t *testing.T){if err:=tc.check();!errors.Is(err,ErrTravelContractInvalid){t.Fatalf("expected invalid contract, got %v",err)}})}
}

func TestGenesisTransactionMethodsAlwaysDisabled(t *testing.T) {
 tx:=GenesisTravelTransactions{}
 ctx:=context.Background()
 checks:=[]struct{name string; run func()error}{
  {"reserve",func()error{return tx.Reserve(ctx,Reservation{})}},
  {"quote",func()error{return tx.Quote(ctx,NightlyPrice{})}},
  {"payment",func()error{return tx.Pay(ctx,"anything")}},
  {"escrow",func()error{return tx.Escrow(ctx,"anything")}},
  {"cancellation-settlement",func()error{return tx.CancelAndSettle(ctx,"anything")}},
  {"delivery",func()error{return tx.RequestDelivery(ctx,ServiceRequest{})}},
  {"dynamic-price",func()error{return tx.DynamicPrice(ctx,"anything")}},
 }
 for _,tc:=range checks {t.Run(tc.name,func(t *testing.T){if err:=tc.run();!errors.Is(err,ErrTravelTransactionDisabled){t.Fatalf("transaction path unexpectedly enabled: %v",err)}})}
}
