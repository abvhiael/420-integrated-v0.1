package travelapp

import (
 "context"
 "errors"
 "strings"
 "testing"
 "time"
)

// AUDIT-7: an untrusted caller, broken upstream dependency, or cancelled
// request must never turn a compatibility placeholder into a transaction.
func TestDOOBRAudit7FailClosedSecurityMatrix(t *testing.T) {
 tx := GenesisTravelTransactions{}
 now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
 good := ServiceRequest{
  SchemaVersion: TravelCompatibilityVersion, ID:"request-1",
  ProviderID:"provider-1", RequesterIdentityRef:"identity:requester",
  Window: DeliveryWindow{SchemaVersion:TravelCompatibilityVersion,ProviderID:"provider-1",From:now,To:now.Add(time.Hour)},
 }
 ctxCancelled,cancel:=context.WithCancel(context.Background());cancel()
 ctxExpired,stop:=context.WithDeadline(context.Background(),time.Now().Add(-time.Second));defer stop()
 for _, c :=range []struct{name string;ctx context.Context}{
  {"anonymous",context.Background()},
  {"nil",nil},
  {"cancelled",ctxCancelled},
  {"deadline-exceeded",ctxExpired},
 } {
  t.Run(c.name,func(t *testing.T){
   calls:=[]struct{name string;call func()error}{
    {"delivery-valid",func()error{return tx.RequestDelivery(c.ctx,good)}},
    {"delivery-malformed",func()error{return tx.RequestDelivery(c.ctx,ServiceRequest{})}},
    {"reserve",func()error{return tx.Reserve(c.ctx,Reservation{})}},
    {"quote",func()error{return tx.Quote(c.ctx,NightlyPrice{})}},
    {"pay-replay",func()error{return tx.Pay(c.ctx,"replayed-order")}},
    {"escrow",func()error{return tx.Escrow(c.ctx,"untrusted-provider")}},
    {"settle",func()error{return tx.CancelAndSettle(c.ctx,"replayed-order")}},
    {"dynamic-price",func()error{return tx.DynamicPrice(c.ctx,"untrusted-provider")}},
   }
   for _,call:=range calls {
    t.Run(call.name,func(t *testing.T){
     for i:=0;i<3;i++ {if err:=call.call();!errors.Is(err,ErrTravelTransactionDisabled){t.Fatalf("repeat %d escaped fail-closed security boundary: %v",i,err)}}
    })
   }
  })
 }
}

func TestDOOBRAudit7ExternalIdentityAndPrivacyInputs(t *testing.T) {
 now:=time.Date(2026,10,9,0,0,0,0,time.UTC)
 provider:=ServiceProvider{SchemaVersion:TravelCompatibilityVersion,ID:"provider-1",PlaceID:"place-1",IdentityRef:"external:id-1"}
 req:=ServiceRequest{SchemaVersion:TravelCompatibilityVersion,ID:"request-1",ProviderID:"provider-1",RequesterIdentityRef:"external:requester",Window:DeliveryWindow{SchemaVersion:TravelCompatibilityVersion,ProviderID:"provider-1",From:now,To:now.Add(time.Hour)}}
 if err:=provider.Validate();err!=nil {t.Fatalf("opaque external identity rejected: %v",err)}
 if err:=req.Validate();err!=nil {t.Fatalf("opaque requester identity rejected: %v",err)}
 for _,ref:=range []string{"", " identity:provider", "identity:provider ", "id:\nforged","id:\rforged","id:\tforged",strings.Repeat("x",257)} {
  p:=provider;p.IdentityRef=ref
  if err:=p.Validate();!errors.Is(err,ErrTravelContractInvalid){t.Errorf("provider ref %q was accepted: %v",ref,err)}
  r:=req;r.RequesterIdentityRef=ref
  if err:=r.Validate();!errors.Is(err,ErrTravelContractInvalid){t.Errorf("requester ref %q was accepted: %v",ref,err)}
 }
 for _,region:=range []string{"", "  ","province\nprivate-address","province\raddress","province\x00address",strings.Repeat("x",81)} {
  area:=ServiceArea{SchemaVersion:TravelCompatibilityVersion,ProviderID:"provider-1",Region:region,Country:"CA"}
  if err:=area.Validate();!errors.Is(err,ErrTravelContractInvalid){t.Errorf("region %q accepted: %v",region,err)}
 }
 for _,country:=range []string{""," ","CA\nprivate","CA\x00"," "+strings.Repeat("X",80)} {
  area:=ServiceArea{SchemaVersion:TravelCompatibilityVersion,ProviderID:"provider-1",Region:"Saskatchewan",Country:country}
  if err:=area.Validate();!errors.Is(err,ErrTravelContractInvalid){t.Errorf("country %q accepted: %v",country,err)}
 }
}
