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

func TestTrackedPlaceApprovalRequiresAppliedReadback(t *testing.T){
 ctx:=context.Background();now:=stableClock();p:=trustedPolicy()
 repo,err:=placerepo.OpenFileStore(filepath.Join(t.TempDir(),"places.json"));if err!=nil{t.Fatal(err)}
 writer,err:=placeservice.NewPublicationWriter(repo,allowPlace{true},func()time.Time{return now.Add(time.Minute)});if err!=nil{t.Fatal(err)}
 private:=placemodel.Place{ID:"internal-place-1",Name:"A venue",Category:placemodel.CategoryVenue,Visibility:placemodel.VisibilityPrivate,Precision:placemodel.PrecisionPrivate,Source:"provider-A",Owner:placemodel.SubjectRef{Type:"operator",ID:"existing-owner"},Version:1,CreatedAt:now,UpdatedAt:now}
 if _,err=writer.Create(ctx,"reviewer",private);err!=nil{t.Fatal(err)}
 public:=private;public.Visibility=placemodel.VisibilityPublic;public.Precision=placemodel.PrecisionApproximate;public.Version=2;public.UpdatedAt=now.Add(time.Minute)
 hash,err:=canonicalDigest(public);if err!=nil{t.Fatal(err)}
 c:=candidate();c.ExpectedVersion=1;c.NormalizedSHA256=hash
 decisions,err:=NewTrustedDurableLedger(filepath.Join(t.TempDir(),"audit.json"),[]byte(strings.Repeat("k",32)),p);if err!=nil{t.Fatal(err)}
 if err=decisions.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 if _,err=decisions.Decide(ctx,decision(c,Approve,0));err!=nil{t.Fatal(err)}
 bridge:=CanonicalBridge{Decisions:decisions,Operators:p,Places:writer}
 path:=filepath.Join(t.TempDir(),"operations.json");key:=[]byte(strings.Repeat("z",32))
 ops,err:=OpenOperationLog(path,key);if err!=nil{t.Fatal(err)}
 if _,err=bridge.ApplyApprovedPlaceTracked(ctx,c.ID,public,ops);err!=nil{t.Fatal(err)}
 if err=ops.AllApplied();err!=nil{t.Fatalf("canonical postimage not confirmed: %v",err)}
 restarted,err:=OpenOperationLog(path,key);if err!=nil{t.Fatal(err)}
 id:="place-approve:"+c.ID+":1"
 r,err:=ReconcilePlace(ctx,restarted,id,writer);if err!=nil||r.State!="applied"{t.Fatalf("restart failed to verify applied operation: %v",err)}
 if _,err=bridge.ApplyApprovedPlaceTracked(ctx,c.ID,public,restarted);!errors.Is(err,ErrConflict){t.Fatalf("replayed canonical intent accepted: %v",err)}
}
