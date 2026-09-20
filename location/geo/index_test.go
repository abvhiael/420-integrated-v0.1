package geo

import (
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

func exact(id string, lat, lon float64, category model.Category, city string) model.Place {
	now := time.Date(2026, 9, 18, 23, 30, 0, 0, time.UTC)
	return model.Place{
		ID:id, Name:id, Category:category,
		Visibility:model.VisibilityPublic, Precision:model.PrecisionExactPublic,
		Source:"test", Owner:model.SubjectRef{Type:"ORGANIZATION",ID:"org"},
		Country:"CA", Region:"SK", City:city,
		Latitude:&lat, Longitude:&lon,
		Version:1, CreatedAt:now, UpdatedAt:now,
	}
}

func approximate(id, city string) model.Place {
	now := time.Date(2026, 9, 18, 23, 30, 0, 0, time.UTC)
	lat, lon := 50.45, -104.61
	return model.Place{
		ID:id, Name:id, Category:model.CategoryServiceProvider,
		Visibility:model.VisibilityPublic, Precision:model.PrecisionApproximate,
		Source:"test", Owner:model.SubjectRef{Type:"PROFILE",ID:"user"},
		Country:"CA", Region:"SK", City:city,
		Latitude:&lat, Longitude:&lon,
		Version:1, CreatedAt:now, UpdatedAt:now,
	}
}

func private(id string) model.Place {
	now := time.Date(2026, 9, 18, 23, 30, 0, 0, time.UTC)
	lat, lon := 50.44, -104.62
	return model.Place{
		ID:id, Name:id, Category:model.CategoryOther,
		Visibility:model.VisibilityPrivate, Precision:model.PrecisionPrivate,
		Source:"test", Owner:model.SubjectRef{Type:"PROFILE",ID:"user"},
		Country:"CA", Region:"SK", City:"Regina",
		Latitude:&lat, Longitude:&lon,
		Version:1, CreatedAt:now, UpdatedAt:now,
	}
}

func TestRadiusQueryAndDeterministicOrder(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("b",50.4453,-104.6188,model.CategoryVenue,"Regina"),
		exact("a",50.4452,-104.6189,model.CategoryVenue,"Regina"),
	}); err != nil { t.Fatal(err) }

	got, err := idx.WithinRadius(50.4452,-104.6189,1000,model.CategoryVenue)
	if err != nil { t.Fatal(err) }
	if len(got) != 2 { t.Fatalf("len=%d",len(got)) }
	if got[0].PlaceID != "a" { t.Fatalf("nearest=%s",got[0].PlaceID) }
	if got[0].DistanceMeters > got[1].DistanceMeters { t.Fatal("distance ordering broken") }
}

func TestBoundingBoxSupportsAntimeridian(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("east",0,179.5,model.CategoryVenue,""),
		exact("west",0,-179.5,model.CategoryVenue,""),
		exact("middle",0,0,model.CategoryVenue,""),
	}); err != nil { t.Fatal(err) }
	got, err := idx.WithinBoundingBox(-10,170,10,-170,"")
	if err != nil { t.Fatal(err) }
	if len(got)!=2 || got[0].PlaceID!="east" || got[1].PlaceID!="west" {
		t.Fatalf("got=%+v",got)
	}
}

func TestPrivateExcludedAndApproximateDoesNotExposeCoordinates(t *testing.T) {
	idx:=NewIndex()
	if err:=idx.Rebuild([]model.Place{private("private"),approximate("approx","Regina")}); err!=nil { t.Fatal(err) }
	snap:=idx.Snapshot()
	if len(snap)!=1 || snap[0].PlaceID!="approx" { t.Fatalf("snapshot=%+v",snap) }
	if snap[0].Latitude!=nil || snap[0].Longitude!=nil { t.Fatal("approximate location leaked exact coordinates") }
}

func TestRegionAndCategoryFilters(t *testing.T) {
	idx:=NewIndex()
	if err:=idx.Rebuild([]model.Place{
		exact("venue",50.44,-104.61,model.CategoryVenue,"Regina"),
		exact("hotel",50.45,-104.62,model.CategoryHotel,"Regina"),
		exact("saskatoon",52.13,-106.67,model.CategoryVenue,"Saskatoon"),
	}); err!=nil { t.Fatal(err) }
	got,err:=idx.WithinRegion("ca","sk","regina",model.CategoryVenue)
	if err!=nil { t.Fatal(err) }
	if len(got)!=1 || got[0].PlaceID!="venue" { t.Fatalf("got=%+v",got) }
}

func TestReplaceRemovesNoLongerPublicPlace(t *testing.T) {
	idx:=NewIndex()
	p:=exact("venue",50.44,-104.61,model.CategoryVenue,"Regina")
	if err:=idx.Replace(p); err!=nil { t.Fatal(err) }
	p.Visibility=model.VisibilityPrivate
	p.Precision=model.PrecisionPrivate
	if err:=idx.Replace(p); err!=nil { t.Fatal(err) }
	if len(idx.Snapshot())!=0 { t.Fatal("private place remained indexed") }
}

func TestRebuildEquivalentToIncrementalProjection(t *testing.T) {
	places:=[]model.Place{
		exact("a",50.44,-104.61,model.CategoryVenue,"Regina"),
		approximate("b","Regina"),
		private("c"),
	}
	incremental:=NewIndex()
	for _,p:=range places {
		if err:=incremental.Replace(p); err!=nil { t.Fatal(err) }
	}
	rebuilt:=NewIndex()
	if err:=rebuilt.Rebuild(places); err!=nil { t.Fatal(err) }
	a,b:=incremental.Snapshot(),rebuilt.Snapshot()
	if len(a)!=len(b) { t.Fatalf("len %d != %d",len(a),len(b)) }
	for n:=range a {
		if a[n].PlaceID!=b[n].PlaceID || a[n].Precision!=b[n].Precision {
			t.Fatalf("a=%+v b=%+v",a,b)
		}
	}
}

func TestInvalidCoordinatesAndRadiusFailClosed(t *testing.T) {
	idx:=NewIndex()
	if _,err:=idx.WithinRadius(math.NaN(),0,1000,""); err==nil { t.Fatal("expected coordinate error") }
	if _,err:=idx.WithinRadius(0,0,-1,""); err==nil { t.Fatal("expected radius error") }
	if _,err:=idx.WithinBoundingBox(10,0,-10,1,""); err==nil { t.Fatal("expected bbox error") }
}
