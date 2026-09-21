package travelapp

import (
 "context"
 "errors"
 "testing"
)

func TestTripPrivacyAndOwnerIsolation(t *testing.T){
 ctx:=context.Background();store:=NewTripStore()
 private,err:=store.Create(ctx,"alice",Trip{ID:"trip-private",Title:"Private holiday",PlaceIDs:[]string{"public-1"},EventIDs:[]string{"event-1"}})
 if err!=nil||private.Visibility!=TripPrivate||private.OwnerID!="alice" {t.Fatalf("default private: %+v %v",private,err)}
 unlisted,err:=store.Create(ctx,"alice",Trip{ID:"trip-unlisted",Title:"Shared by explicit capability only",Visibility:TripUnlisted})
 if err!=nil||unlisted.Visibility!=TripUnlisted{t.Fatalf("unlisted: %+v %v",unlisted,err)}
 published,err:=store.Create(ctx,"bob",Trip{ID:"trip-public",Title:"Public journey",Visibility:TripPublic})
 if err!=nil{t.Fatal(err)}
 if got:=store.ListPublic(ctx);len(got)!=1||got[0].ID!=published.ID{t.Fatalf("private or unlisted indexed: %+v",got)}
 if _,err:=store.GetOwned(ctx,"bob",private.ID);!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner read: %v",err)}
 if _,err:=store.GetOwned(ctx,"",private.ID);!errors.Is(err,ErrTripUnauthorized){t.Fatalf("missing principal: %v",err)}
 if got,err:=store.ListOwned(ctx,"alice");err!=nil||len(got)!=2{t.Fatalf("owner list: %+v %v",got,err)}
 if got,err:=store.ListOwned(ctx,"bob");err!=nil||len(got)!=1||got[0].ID!=published.ID{t.Fatalf("other owner list: %+v %v",got,err)}
 if _,err:=store.Replace(ctx,"bob",Trip{ID:private.ID,Title:"stolen",Visibility:TripPublic});!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner edit: %v",err)}
 if err:=store.Delete(ctx,"bob",private.ID);!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner delete: %v",err)}
 if got,_:=store.GetOwned(ctx,"alice",private.ID);got.Title!="Private holiday"{t.Fatalf("unauthorized write: %+v",got)}
 if err:=store.Delete(ctx,"alice",private.ID);err!=nil{t.Fatal(err)}
 if _,err:=store.GetOwned(ctx,"alice",private.ID);!errors.Is(err,ErrTripNotFound){t.Fatalf("deleted trip still visible: %v",err)}
}

func TestTripVisibilityTransitionsAndDeepCopies(t *testing.T){
 ctx:=context.Background();store:=NewTripStore()
 original,err:=store.Create(ctx,"alice",Trip{ID:"trip-a",OwnerID:"spoofed",Title:"Planning",PlaceIDs:[]string{"place-a"},EventIDs:[]string{"event-a"}})
 if err!=nil{t.Fatal(err)}
 original.PlaceIDs[0]="changed"
 owned,_:=store.GetOwned(ctx,"alice","trip-a")
 if owned.OwnerID!="alice"||owned.PlaceIDs[0]!="place-a"{t.Fatalf("mutable storage or caller owner injection: %+v",owned)}
 changed,err:=store.Replace(ctx,"alice",Trip{ID:"trip-a",OwnerID:"another",Title:"Published",Visibility:TripPublic,PlaceIDs:[]string{"place-b"}})
 if err!=nil||changed.OwnerID!="alice"||changed.CreatedAt!=owned.CreatedAt{t.Fatalf("replace ownership/timestamp: %+v %v",changed,err)}
 if got:=store.ListPublic(ctx);len(got)!=1||got[0].PlaceIDs[0]!="place-b"{t.Fatalf("publication: %+v",got)}
 changed.PlaceIDs[0]="external-change"
 if got:=store.ListPublic(ctx);got[0].PlaceIDs[0]!="place-b"{t.Fatalf("public list alias: %+v",got)}
 if _,err:=store.Replace(ctx,"alice",Trip{ID:"trip-a",Title:"Unlisted",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 if got:=store.ListPublic(ctx);len(got)!=0{t.Fatalf("revoked public listing: %+v",got)}
 if _,err:=store.Replace(ctx,"alice",Trip{ID:"trip-a",Title:"Private",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 if got:=store.ListPublic(ctx);len(got)!=0{t.Fatalf("private indexed: %+v",got)}
}

func TestTripValidationAndDuplicateID(t *testing.T){
 ctx:=context.Background();store:=NewTripStore()
 invalid:=[]Trip{
  {ID:"invalid!",Title:"Title"},
  {ID:"valid",Title:""},
  {ID:"valid",Title:"Title",Visibility:"OPEN"},
  {ID:"valid",Title:"Title",PlaceIDs:[]string{"a","a"}},
  {ID:"valid",Title:"Title",EventIDs:[]string{"invalid!"}},
 }
 for _,trip:=range invalid {if _,err:=store.Create(ctx,"alice",trip);!errors.Is(err,ErrTripInvalid){t.Fatalf("invalid trip %+v accepted: %v",trip,err)}}
 if _,err:=store.Create(ctx,"",Trip{ID:"valid",Title:"Title"});!errors.Is(err,ErrTripUnauthorized){t.Fatalf("anonymous create: %v",err)}
 if _,err:=store.Create(ctx,"alice",Trip{ID:"valid",Title:"Title"});err!=nil{t.Fatal(err)}
 if _,err:=store.Create(ctx,"bob",Trip{ID:"valid",Title:"Other"});!errors.Is(err,ErrTripConflict){t.Fatalf("duplicate ID across tenants: %v",err)}
 if _,err:=store.Replace(ctx,"alice",Trip{ID:"valid",Title:"Title",Visibility:"OPEN"});!errors.Is(err,ErrTripInvalid){t.Fatalf("invalid replacement: %v",err)}
}
