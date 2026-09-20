package providers

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/geo"
)

type fakeProvider struct {
	name string
	caps []Capability
	candidates []PlaceCandidate
	route geo.Route
	provenance Provenance
	tile Tile
	err error
}

func (f fakeProvider) Name() string { return f.name }
func (f fakeProvider) Capabilities() []Capability { return append([]Capability(nil), f.caps...) }
func (f fakeProvider) Ready(context.Context) error { return f.err }
func (f fakeProvider) Geocode(context.Context, AddressQuery)([]PlaceCandidate,error){ return append([]PlaceCandidate(nil),f.candidates...),f.err }
func (f fakeProvider) ReverseGeocode(context.Context, CoordinateQuery)([]PlaceCandidate,error){ return append([]PlaceCandidate(nil),f.candidates...),f.err }
func (f fakeProvider) Lookup(context.Context, PlaceLookupQuery)([]PlaceCandidate,error){ return append([]PlaceCandidate(nil),f.candidates...),f.err }
func (f fakeProvider) Route(context.Context, RouteRequest)(geo.Route,Provenance,error){ return f.route,f.provenance,f.err }
func (f fakeProvider) Tile(context.Context, TileRequest)(Tile,error){ return f.tile,f.err }

func allCaps() []Capability { return append([]Capability(nil), GenesisCapabilities...) }

func provenance(provider,id string) Provenance {
	return Provenance{
		Provider:provider,
		ProviderRequestID:"req-1",
		ProviderPlaceID:id,
		RetrievedAt:time.Date(2026,9,18,23,45,0,0,time.UTC),
		Confidence:0.9,
	}
}

func TestAdapterRequiresAllGenesisCapabilities(t *testing.T){
	p:=fakeProvider{name:"demo",caps:[]Capability{CapabilityGeocode}}
	if _,err:=NewAdapter(p); err==nil { t.Fatal("expected missing capability rejection") }
}

func TestGeocodePreservesProviderIDOnlyAsProvenance(t *testing.T){
	p:=fakeProvider{
		name:"demo",caps:allCaps(),
		candidates:[]PlaceCandidate{{
			Name:"Example Place",Latitude:50,Longitude:-104,
			Provenance:provenance("demo","vendor-123"),
		}},
	}
	a,err:=NewAdapter(p); if err!=nil { t.Fatal(err) }
	got,err:=a.Geocode(context.Background(),AddressQuery{City:"Regina"})
	if err!=nil { t.Fatal(err) }
	if len(got)!=1 || got[0].Provenance.ProviderPlaceID!="vendor-123" { t.Fatalf("got=%+v",got) }
	if got[0].Name=="vendor-123" { t.Fatal("provider ID leaked into normalized place identity") }
}

func TestMalformedCandidateFailsClosed(t *testing.T){
	p:=fakeProvider{
		name:"demo",caps:allCaps(),
		candidates:[]PlaceCandidate{{Name:"",Provenance:provenance("demo","id")}},
	}
	a,_:=NewAdapter(p)
	if _,err:=a.Geocode(context.Background(),AddressQuery{City:"Regina"}); err==nil { t.Fatal("expected malformed result rejection") }
}

func TestInvalidQueryReturnsTypedProviderError(t *testing.T){
	a,_:=NewAdapter(fakeProvider{name:"demo",caps:allCaps()})
	_,err:=a.Geocode(context.Background(),AddressQuery{})
	var providerErr *ProviderError
	if !errors.As(err,&providerErr) || providerErr.Kind!=ErrorInvalidQuery {
		t.Fatalf("err=%v",err)
	}
}

func TestRouteAndTileValidation(t *testing.T){
	p:=fakeProvider{
		name:"demo",caps:allCaps(),
		route:geo.Route{Points:[]geo.RoutePoint{{Latitude:0,Longitude:0},{Latitude:1,Longitude:1}},Provider:"demo"},
		provenance:provenance("demo",""),
		tile:Tile{ContentType:"image/png",Data:[]byte{1,2,3},Provenance:provenance("demo","")},
	}
	a,_:=NewAdapter(p)
	r,prov,err:=a.Route(context.Background(),RouteRequest{})
	if err!=nil { t.Fatal(err) }
	if len(r.Points)!=2 || prov.Provider!="demo" { t.Fatalf("route=%v prov=%+v",r,prov) }
	tile,err:=a.Tile(context.Background(),TileRequest{Z:1,X:1,Y:1})
	if err!=nil { t.Fatal(err) }
	if tile.ContentType!="image/png" || len(tile.Data)!=3 { t.Fatalf("tile=%+v",tile) }
}
