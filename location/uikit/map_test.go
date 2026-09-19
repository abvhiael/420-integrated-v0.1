package uikit

import (
 "testing"
 "time"
 "github.com/420integrated/420-integrated/location/model"
)

func place(id string,visibility model.Visibility,precision model.PlacePrecision) model.Place {
 lat,lon:=50.0,-105.0
 now:=time.Date(2026,9,19,0,0,0,0,time.UTC)
 return model.Place{ID:id,Name:id,Category:model.CategoryVenue,Visibility:visibility,Precision:precision,Source:"test",Owner:model.SubjectRef{Type:"account",ID:"organizer"},Latitude:&lat,Longitude:&lon,City:"Regina",Region:"SK",Country:"CA",Address:"private address",Version:1,CreatedAt:now,UpdatedAt:now}
}

func TestPublicExactAndApproximate(t *testing.T){
 exact:=place("exact",model.VisibilityPublic,model.PrecisionExactPublic)
 approximate:=place("area",model.VisibilityPublic,model.PrecisionApproximate)
 hidden:=place("private",model.VisibilityPrivate,model.PrecisionPrivate)
 unlisted:=place("unlisted",model.VisibilityUnlisted,model.PrecisionApproximate)
 v,err:=Build([]model.Place{hidden,exact,unlisted,approximate});if err!=nil{t.Fatal(err)}
 if len(v.Items)!=2 || v.Items[0].ID!="area" || v.Items[1].ID!="exact" {t.Fatalf("unexpected public map projection: %+v",v.Items)}
 if v.Items[0].Kind!=KindArea||v.Items[0].Latitude!=nil||v.Items[0].Longitude!=nil {t.Fatal("approximate entry leaked an exact location")}
 if v.Items[1].Kind!=KindPin||v.Items[1].Latitude==nil||v.Items[1].Longitude==nil {t.Fatal("exact public pin missing")}
}

func TestEmptyInvalidAndDuplicate(t *testing.T){
 v,err:=Build([]model.Place{place("hidden",model.VisibilityPrivate,model.PrecisionPrivate)});if err!=nil||!v.Empty {t.Fatalf("expected private-only empty view: %+v %v",v,err)}
 p:=place("same",model.VisibilityPublic,model.PrecisionExactPublic)
 if _,err:=Build([]model.Place{p,p});err==nil{t.Fatal("duplicate place must fail")}
 p.Latitude=nil
 if _,err:=Build([]model.Place{p});err==nil{t.Fatal("invalid public place must fail closed")}
 many:=make([]model.Place,MaxMapItems+1)
 if _,err:=Build(many);err==nil{t.Fatal("unbounded view accepted")}
}

func TestCoarseWithoutRegionIsHidden(t *testing.T){
 p:=place("coarse",model.VisibilityPublic,model.PrecisionApproximate)
 p.City="";p.Region="";p.Country=""
 v,err:=Build([]model.Place{p});if err!=nil||!v.Empty{t.Fatalf("expected withheld unlocatable area: %+v %v",v,err)}
}
