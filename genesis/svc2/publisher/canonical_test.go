package publisher

import (
 "context"
 "errors"
 "path/filepath"
 "strings"
 "testing"
 "time"
 placemodel "github.com/420integrated/420-integrated/location/model"
 placerepo "github.com/420integrated/420-integrated/location/repository"
 placeservice "github.com/420integrated/420-integrated/location/service"
)

type allowPlace struct{allow bool}
func(a allowPlace)AuthorizePlacePublication(_ context.Context,operator,id string)error{if !a.allow||operator!="reviewer"||id==""{return ErrUnauthorized};return nil}
func TestCanonicalBridgeApprovalWithdrawalAndDigestGate(t *testing.T){
 ctx:=context.Background();now:=stableClock();p:=trustedPolicy()
 repo,err:=placerepo.OpenFileStore(filepath.Join(t.TempDir(),"places.json"));if err!=nil{t.Fatal(err)}
 writer,err:=placeservice.NewPublicationWriter(repo,allowPlace{true},func()time.Time{return now.Add(time.Minute)});if err!=nil{t.Fatal(err)}
 private:=placemodel.Place{ID:"internal-place-1",Name:"A venue",Category:placemodel.CategoryVenue,Visibility:placemodel.VisibilityPrivate,Precision:placemodel.PrecisionPrivate,Source:"provider-A",Owner:placemodel.SubjectRef{Type:"operator",ID:"existing-owner"},Version:1,CreatedAt:now,UpdatedAt:now}
 if _,err=writer.Create(ctx,"reviewer",private);err!=nil{t.Fatal(err)}
 public:=private;public.Visibility=placemodel.VisibilityPublic;public.Precision=placemodel.PrecisionApproximate;public.Version=2;public.UpdatedAt=now.Add(time.Minute)
 hash,err:=canonicalDigest(public);if err!=nil{t.Fatal(err)}
 c:=candidate();c.ExpectedVersion=1;c.NormalizedSHA256=hash
 d,err:=NewTrustedDurableLedger(filepath.Join(t.TempDir(),"audit.json"),[]byte(strings.Repeat("k",32)),p);if err!=nil{t.Fatal(err)}
 bridge:=CanonicalBridge{Decisions:d,Operators:p,Places:writer}
 if err=d.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 if _,err=bridge.ApplyApprovedPlace(ctx,c.ID,public);!errors.Is(err,ErrConflict){t.Fatalf("pending record applied: %v",err)}
 if _,err=d.Decide(ctx,decision(c,Approve,0));err!=nil{t.Fatal(err)}
 tampered:=public;tampered.Name="unapproved name"
 if _,err=bridge.ApplyApprovedPlace(ctx,c.ID,tampered);!errors.Is(err,ErrConflict){t.Fatalf("unapproved payload applied: %v",err)}
 applied,err:=bridge.ApplyApprovedPlace(ctx,c.ID,public);if err!=nil||applied.Visibility!=placemodel.VisibilityPublic{t.Fatalf("approved mutation: %v",err)}
 if _,err=bridge.ApplyApprovedPlace(ctx,c.ID,public);err==nil{t.Fatal("stale canonical version accepted")}
 if _,err=d.Decide(ctx,decision(c,Withdraw,1));err!=nil{t.Fatal(err)}
 if _,err=bridge.ApplyApprovedPlace(ctx,c.ID,public);!errors.Is(err,ErrConflict){t.Fatalf("withdrawn approval reused: %v",err)}
 gone,err:=bridge.WithdrawPlace(ctx,c.ID,2);if err!=nil||gone.Visibility!=placemodel.VisibilityPrivate{t.Fatalf("canonical withdrawal failed: %v",err)}
 if _,err=bridge.WithdrawPlace(ctx,c.ID,2);err==nil{t.Fatal("replayed withdrawal accepted")}
}
