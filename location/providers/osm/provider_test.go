package osm

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/geo"
	"github.com/420integrated/420-integrated/location/providers"
)

func testProvider(t *testing.T, handler http.Handler) (*Provider, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	p, err := New(Config{
		NominatimBaseURL: server.URL,
		OSRMBaseURL: server.URL,
		TileBaseURL: server.URL,
		UserAgent: "420Integrated-Test/1.0 (+https://420integrated.org)",
		HTTPClient: server.Client(),
		NominatimMinInterval: -1,
		Now: func() time.Time { return time.Date(2026,9,19,0,0,0,0,time.UTC) },
	})
	if err != nil { t.Fatal(err) }
	return p, server
}

func TestGeocodeUsesIdentifyingUserAgentAndNormalizesProvenance(t *testing.T) {
	p,_:=testProvider(t,http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if r.URL.Path!="/search" { t.Fatalf("path=%s",r.URL.Path) }
		if !strings.Contains(r.Header.Get("User-Agent"),"420Integrated-Test") { t.Fatalf("ua=%q",r.Header.Get("User-Agent")) }
		w.Header().Set("X-Request-ID","req-geo")
		w.Header().Set("Content-Type","application/json")
		w.Write([]byte(`[{"place_id":10,"osm_type":"node","osm_id":99,"lat":"50.445","lon":"-104.618","display_name":"Venue, Regina, Canada","name":"Venue","importance":0.7,"address":{"city":"Regina","state":"Saskatchewan","country":"Canada","postcode":"S4P"},"licence":"Data © OpenStreetMap contributors"}]`))
	}))
	got,err:=p.Geocode(context.Background(),providers.AddressQuery{Address:"Venue",City:"Regina"})
	if err!=nil { t.Fatal(err) }
	if len(got)!=1 { t.Fatalf("len=%d",len(got)) }
	if got[0].Provenance.ProviderPlaceID!="N99" || got[0].Provenance.ProviderRequestID!="req-geo" {
		t.Fatalf("provenance=%+v",got[0].Provenance)
	}
	if got[0].City!="Regina" || got[0].Region!="Saskatchewan" { t.Fatalf("candidate=%+v",got[0]) }
}

func TestReverseGeocodeRejectsInvalidCoordinate(t *testing.T){
	p,_:=testProvider(t,http.NotFoundHandler())
	_,err:=p.ReverseGeocode(context.Background(),providers.CoordinateQuery{Latitude:91,Longitude:0})
	var pe *providers.ProviderError
	if !errors.As(err,&pe) || pe.Kind!=providers.ErrorInvalidQuery { t.Fatalf("err=%v",err) }
}

func TestLookupUsesOfficialOSMObjectIDForm(t *testing.T){
	p,_:=testProvider(t,http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if r.URL.Path!="/lookup" { t.Fatalf("path=%s",r.URL.Path) }
		if r.URL.Query().Get("osm_ids")!="W123" { t.Fatalf("osm_ids=%q",r.URL.Query().Get("osm_ids")) }
		w.Write([]byte(`[{"place_id":10,"osm_type":"way","osm_id":123,"lat":"50","lon":"-104","display_name":"Example","importance":0.5,"address":{"country":"Canada"}}]`))
	}))
	got,err:=p.Lookup(context.Background(),providers.PlaceLookupQuery{ExternalID:"w123"})
	if err!=nil { t.Fatal(err) }
	if got[0].Provenance.ProviderPlaceID!="W123" { t.Fatalf("id=%s",got[0].Provenance.ProviderPlaceID) }
}

func TestRouteParsesOSRMGeoJSON(t *testing.T){
	p,_:=testProvider(t,http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		if !strings.HasPrefix(r.URL.Path,"/route/v1/driving/") { t.Fatalf("path=%s",r.URL.Path) }
		if r.URL.Query().Get("geometries")!="geojson" || r.URL.Query().Get("overview")!="full" { t.Fatalf("query=%s",r.URL.RawQuery) }
		w.Write([]byte(`{"code":"Ok","routes":[{"distance":1234.5,"duration":65.2,"geometry":{"type":"LineString","coordinates":[[-104.62,50.44],[-104.60,50.46]]}}]}`))
	}))
	route,prov,err:=p.Route(context.Background(),providers.RouteRequest{
		Origin:geo.RoutePoint{Latitude:50.44,Longitude:-104.62},
		Destination:geo.RoutePoint{Latitude:50.46,Longitude:-104.60},
	})
	if err!=nil { t.Fatal(err) }
	if len(route.Points)!=2 || route.DistanceMeters!=1234.5 || route.DurationSeconds!=65 { t.Fatalf("route=%+v",route) }
	if prov.Provider!="openstreetmap" { t.Fatalf("prov=%+v",prov) }
}

func TestTileCachesAndCarriesRequiredAttribution(t *testing.T){
	var calls atomic.Int32
	p,_:=testProvider(t,http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
		calls.Add(1)
		if r.URL.Path!="/1/1/1.png" { t.Fatalf("path=%s",r.URL.Path) }
		w.Header().Set("Content-Type","image/png")
		w.Header().Set("Cache-Control","public, max-age=3600")
		w.Write([]byte{1,2,3})
	}))
	first,err:=p.Tile(context.Background(),providers.TileRequest{Z:1,X:1,Y:1})
	if err!=nil { t.Fatal(err) }
	second,err:=p.Tile(context.Background(),providers.TileRequest{Z:1,X:1,Y:1})
	if err!=nil { t.Fatal(err) }
	if calls.Load()!=1 { t.Fatalf("upstream calls=%d",calls.Load()) }
	if len(first.Data)!=3 || len(second.Data)!=3 || !strings.Contains(first.Provenance.Attribution,"OpenStreetMap") {
		t.Fatalf("first=%+v second=%+v",first,second)
	}
}

func TestPublicDefaultsAndGenesisCapabilities(t *testing.T){
	p,err:=New(Config{})
	if err!=nil { t.Fatal(err) }
	if p.nominatim!=defaultNominatim || p.osrm!=defaultOSRM || p.tiles!=defaultTiles { t.Fatalf("defaults=%+v",p) }
	for _,capability:=range providers.GenesisCapabilities {
		if !providers.HasCapability(p.Capabilities(),capability) { t.Fatalf("missing %s",capability) }
	}
	if p.interval!=time.Second { t.Fatalf("interval=%s",p.interval) }
}

func TestRejectsInsecureNonLoopbackEndpoint(t *testing.T){
	_,err:=New(Config{NominatimBaseURL:"http://example.com"})
	if err==nil { t.Fatal("expected http endpoint rejection") }
}

func TestHTTP429MapsToQuotaError(t *testing.T){
	p,_:=testProvider(t,http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){ w.WriteHeader(http.StatusTooManyRequests) }))
	_,err:=p.Geocode(context.Background(),providers.AddressQuery{City:"Regina"})
	var pe *providers.ProviderError
	if !errors.As(err,&pe) || pe.Kind!=providers.ErrorQuotaExceeded { t.Fatalf("err=%v",err) }
}
