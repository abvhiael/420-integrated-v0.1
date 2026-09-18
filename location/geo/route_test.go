package geo

import (
	"math"
	"testing"

	"github.com/420integrated/420-integrated/location/model"
)

func TestNearRouteFindsPlaceInsideCorridor(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("near", 50.4500, -104.6000, model.CategoryDispensary, "Regina"),
		exact("far", 50.5000, -104.6000, model.CategoryDispensary, "Regina"),
	}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:50.4400, Longitude:-104.6000},
		{Latitude:50.4600, Longitude:-104.6000},
	}}

	got, err := idx.NearRoute(route, 500, model.CategoryDispensary)
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].PlaceID != "near" {
		t.Fatalf("got=%+v", got)
	}
}

func TestNearRouteIncludesBoundary(t *testing.T) {
	idx := NewIndex()
	p := exact("boundary", 0, 0.01, model.CategoryVenue, "")
	if err := idx.Rebuild([]model.Place{p}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:-1, Longitude:0},
		{Latitude:1, Longitude:0},
	}}
	d := distanceToRouteMeters(0, 0.01, route.Points)

	got, err := idx.NearRoute(route, d, "")
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].PlaceID != "boundary" {
		t.Fatalf("got=%+v d=%f", got, d)
	}
}

func TestNearRouteCategoryFilter(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("hotel", 50.45, -104.60, model.CategoryHotel, "Regina"),
		exact("venue", 50.45, -104.60, model.CategoryVenue, "Regina"),
	}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:50.44, Longitude:-104.60},
		{Latitude:50.46, Longitude:-104.60},
	}}
	got, err := idx.NearRoute(route, 1000, model.CategoryHotel)
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].PlaceID != "hotel" {
		t.Fatalf("got=%+v", got)
	}
}

func TestNearRouteExcludesApproximateAndPrivateCoordinates(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		approximate("approx", "Regina"),
		private("private"),
	}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:50.40, Longitude:-104.70},
		{Latitude:50.50, Longitude:-104.50},
	}}
	got, err := idx.NearRoute(route, 100000, "")
	if err != nil { t.Fatal(err) }
	if len(got) != 0 {
		t.Fatalf("privacy-sensitive places entered route discovery: %+v", got)
	}
}

func TestNearRouteMultiSegmentChoosesNearestSegment(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("corner", 50.46, -104.58, model.CategoryVenue, "Regina"),
	}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:50.44, Longitude:-104.62},
		{Latitude:50.44, Longitude:-104.58},
		{Latitude:50.48, Longitude:-104.58},
	}}
	got, err := idx.NearRoute(route, 100, "")
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].PlaceID != "corner" {
		t.Fatalf("got=%+v", got)
	}
}

func TestNearRouteSupportsAntimeridian(t *testing.T) {
	idx := NewIndex()
	if err := idx.Rebuild([]model.Place{
		exact("near-date-line", 0, 179.9, model.CategoryVenue, ""),
	}); err != nil { t.Fatal(err) }

	route := Route{Points: []RoutePoint{
		{Latitude:-1, Longitude:179.8},
		{Latitude:1, Longitude:-179.8},
	}}
	got, err := idx.NearRoute(route, 20000, "")
	if err != nil { t.Fatal(err) }
	if len(got) != 1 {
		t.Fatalf("got=%+v", got)
	}
}

func TestNearRouteRejectsInvalidRouteAndCorridor(t *testing.T) {
	idx := NewIndex()
	if _, err := idx.NearRoute(Route{Points: []RoutePoint{{Latitude:0,Longitude:0}}}, 100, ""); err == nil {
		t.Fatal("expected short route rejection")
	}
	route := Route{Points: []RoutePoint{{Latitude:0,Longitude:0},{Latitude:1,Longitude:1}}}
	if _, err := idx.NearRoute(route, -1, ""); err == nil {
		t.Fatal("expected negative corridor rejection")
	}
	if _, err := idx.NearRoute(route, math.NaN(), ""); err == nil {
		t.Fatal("expected NaN corridor rejection")
	}
}
