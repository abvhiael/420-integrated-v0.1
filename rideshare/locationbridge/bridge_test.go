package locationbridge

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/geo"
	"github.com/420integrated/420-integrated/location/providers"
)

type fixtureProvider struct { name string; bad bool }
func (p fixtureProvider) Name() string { return p.name }
func (p fixtureProvider) Capabilities() []providers.Capability { return providers.GenesisCapabilities }
func (p fixtureProvider) Ready(context.Context) error { return nil }
func (p fixtureProvider) Geocode(context.Context, providers.AddressQuery) ([]providers.PlaceCandidate,error) { return nil,nil }
func (p fixtureProvider) ReverseGeocode(context.Context, providers.CoordinateQuery) ([]providers.PlaceCandidate,error) { return nil,nil }
func (p fixtureProvider) Lookup(context.Context, providers.PlaceLookupQuery) ([]providers.PlaceCandidate,error) { return nil,nil }
func (p fixtureProvider) Tile(context.Context, providers.TileRequest) (providers.Tile,error) { return providers.Tile{},nil }
func (p fixtureProvider) Route(_ context.Context, request providers.RouteRequest) (geo.Route,providers.Provenance,error) {
	if p.bad { return geo.Route{},providers.Provenance{},errors.New("offline") }
	return geo.Route{Points:[]geo.RoutePoint{request.Origin,request.Destination},DistanceMeters:1800,DurationSeconds:500,Provider:p.name},
		providers.Provenance{Provider:p.name,RetrievedAt:time.Now(),Confidence:1},nil
}

type scopeFixture struct { cross bool }
func (s scopeFixture) Resolve(context.Context,geo.Route) (Scope,error) { return Scope{Ref:"scope_1",Revision:1,Country:"CA",Region:"BC",Municipality:"Vancouver",CrossBoundary:s.cross},nil }
func requestFixture() Request { return Request{Nonce:"nonce",RouteRef:"route_1",RiderID:"rider_1",PointsDigest:strings.Repeat("a",64),PassengerCount:2,
	Origin:Endpoint{Latitude:49.282731,Longitude:-123.120739,Precision:"exact"},Destination:Endpoint{Latitude:49.29,Longitude:-123.13,Precision:"exact"}} }
func TestCanonicalLocationAdapterAndProviderSwap(t *testing.T) {
	for _,name:=range []string{"provider_1","provider_2"} {
		adapter,err:=providers.NewAdapter(fixtureProvider{name:name});if err!=nil { t.Fatal(err) }
		bridge,err:=New(adapter,scopeFixture{});if err!=nil { t.Fatal(err) }
		projection,err:=bridge.Project(context.Background(),requestFixture());if err!=nil { t.Fatal(err) }
		if projection.RouteRef!="route_1" || projection.ProvenanceRef!="scope_1" || projection.Provider!=name { t.Fatal("provider swap changed canonical reference") }
		encoded,_:=json.Marshal(projection);if strings.Contains(string(encoded),"49.282731") { t.Fatal("private geometry leaked into projection") }
	}
}
func TestScopeAndPrecisionFailClosed(t *testing.T) {
	adapter,_:=providers.NewAdapter(fixtureProvider{name:"provider_1"});bridge,_:=New(adapter,scopeFixture{cross:true})
	if _,err:=bridge.Project(context.Background(),requestFixture());err==nil { t.Fatal("cross-boundary route accepted") }
	bridge,_=New(adapter,scopeFixture{});request:=requestFixture();request.Origin.Precision="approximate"
	if _,err:=bridge.Project(context.Background(),request);err==nil { t.Fatal("approximate source precision increased") }
	request.Origin.Latitude=49.28;request.Origin.Longitude=-123.12
	if _,err:=bridge.Project(context.Background(),request);err!=nil { t.Fatal(err) }
}
func TestUnavailableCanonicalProvider(t *testing.T) {
	adapter,_:=providers.NewAdapter(fixtureProvider{name:"provider_1",bad:true});bridge,_:=New(adapter,scopeFixture{})
	if _,err:=bridge.Project(context.Background(),requestFixture());err==nil { t.Fatal("unavailable provider accepted") }
}
