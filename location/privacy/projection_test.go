package privacy

import (
	"fmt"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/location/geo"
	"github.com/420integrated/420-integrated/location/model"
)

func TestGeoIndexAndPublicProjectionAgreeOnApproximatePrivacy(t *testing.T){
	p:=place("approx",model.VisibilityPublic,model.PrecisionApproximate)
	idx:=geo.NewIndex()
	if err:=idx.Rebuild([]model.Place{p}); err!=nil { t.Fatal(err) }
	snap:=idx.Snapshot()
	if len(snap)!=1 { t.Fatalf("snapshot=%+v",snap) }
	if snap[0].Latitude!=nil || snap[0].Longitude!=nil { t.Fatal("geo index leaked exact approximate coordinates") }

	public,err:=New().PublicProjection(p)
	if err!=nil { t.Fatal(err) }
	if public.Latitude!=nil || public.Longitude!=nil { t.Fatal("public projection sharpened approximate place") }

	text:=fmt.Sprintf("%+v %+v",snap[0],public)
	if strings.Contains(text,"123 Secret Street") { t.Fatal("downstream projection leaked private address") }
}

func TestPrivatePlaceCannotReachGeoOrPublicProjection(t *testing.T){
	p:=place("private",model.VisibilityPrivate,model.PrecisionPrivate)
	idx:=geo.NewIndex()
	if err:=idx.Rebuild([]model.Place{p}); err!=nil { t.Fatal(err) }
	if len(idx.Snapshot())!=0 { t.Fatal("private place entered geo index") }
	if _,err:=New().PublicProjection(p); err==nil { t.Fatal("private place received public projection") }
}
