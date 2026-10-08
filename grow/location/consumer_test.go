package grow

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/genesis/svc2/sdk"
	"github.com/420integrated/420-integrated/location/model"
	"github.com/420integrated/420-integrated/location/uikit"
)

type fake struct {
	v   uikit.View
	err error
}

func (f fake) Places(context.Context) (uikit.View, error) { return f.v, f.err }
func str(s string) *string                                { return &s }
func ptr(v float64) *float64                              { return &v }
func TestGrowFiltersRealPublicSDKPlaces(t *testing.T) {
	farm := uikit.Item{ID: "stable-farm", Name: "Example Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindArea, Region: "SK"}
	business := uikit.Item{ID: "stable-business", Name: "Example Business", Source: "registry-source", RegistryRecordID: "registry-1", Category: model.CategoryBusiness, Kind: uikit.KindPin, Latitude: ptr(52), Longitude: ptr(-108)}
	venue := uikit.Item{ID: "venue", Name: "Not in Grow", Source: "upstream", Category: model.CategoryVenue, Kind: uikit.KindArea, City: "Calgary"}
	original := uikit.View{Items: []uikit.Item{farm, business, venue}, Empty: false}
	view, err := Read(context.Background(), fake{v: original})
	if err != nil {
		t.Fatal(err)
	}
	if view.Empty || len(view.Items) != 2 || !view.ProvenanceAvailable || view.Items[0].ID != "stable-farm" || view.Items[1].ID != "stable-business" {
		t.Fatalf("unexpected Grow view: %+v", view)
	}
	if view.Items[0].Latitude != nil || view.Items[0].Longitude != nil || view.Items[1].Latitude == nil {
		t.Fatal("coordinate precision increased")
	}
	if view.Items[1].Source != "registry-source" || view.Items[1].RegistryRecordID != "registry-1" {t.Fatal("source provenance not preserved")}
	if view.Items[0].ID != original.Items[0].ID {
		t.Fatal("canonical place ID mutated")
	}
	raw, _ := json.Marshal(view)
	if strings.Contains(string(raw), "verified") || strings.Contains(string(raw), `"verified":true`) {
		t.Fatal("invented verification")
	}
}
func TestGrowFailClosedInvalidViews(t *testing.T) {
	base := uikit.Item{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindArea, Region: "SK"}
	tests := map[string]uikit.View{
		"area-leak":              {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindArea, Region: "SK", Latitude: ptr(53)}}},
		"area-no-region":         {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindArea}}},
		"pin-missing-coord":      {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindPin, Latitude: ptr(53)}}},
		"pin-range":              {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindPin, Latitude: ptr(91), Longitude: ptr(0)}}},
		"pin-nan":                {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindPin, Latitude: ptr(math.NaN()), Longitude: ptr(0)}}},
		"unknown-kind":           {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: "private", Region: "SK"}}},
		"unknown-category":       {Items: []uikit.Item{{ID: "farm", Name: "Farm", Source: "upstream", Category: "UNTRUSTED", Kind: uikit.KindArea, Region: "SK"}}},
		"duplicates":             {Items: []uikit.Item{base, base}},
		"empty-mismatch":         {Items: []uikit.Item{base}, Empty: true},
		"blank-id":               {Items: []uikit.Item{{ID: "", Name: "Farm", Source: "upstream", Category: model.CategoryFarm, Kind: uikit.KindArea, Region: "SK"}}},
		"unknown-record-in-feed": {Items: []uikit.Item{base, {ID: "hidden", Name: "Hidden", Source: "upstream", Category: model.CategoryVenue, Kind: uikit.KindArea, Latitude: ptr(52)}}},
	}
	for name, v := range tests {
		t.Run(name, func(t *testing.T) {
			result, err := Read(context.Background(), fake{v: v})
			if !errors.Is(err, ErrInvalidProjection) || len(result.Items) != 0 {
				t.Fatalf("accepted invalid projection: %+v %v", result, err)
			}
		})
	}
}
func TestGrowEmptyAndServiceFailure(t *testing.T) {
	v, err := Read(context.Background(), fake{v: uikit.View{Empty: true}})
	if err != nil || !v.Empty || len(v.Items) != 0 {
		t.Fatalf("empty: %+v %v", v, err)
	}
	if _, err := Read(context.Background(), nil); !errors.Is(err, ErrUnavailable) {
		t.Fatal("nil reader did not fail closed")
	}
	if _, err := Read(context.Background(), fake{err: errors.New("secret internal upstream details")}); !errors.Is(err, ErrUnavailable) || strings.Contains(err.Error(), "secret") {
		t.Fatal("error disclosure")
	}
}
func TestGrowUsesActualVersionedLocationSDK(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.URL.Path != "/v1/places" {
			t.Errorf("wrong SDK endpoint %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"version":"v1","data":{"items":[{"id":"farm-1","name":"Real API Farm","category":"FARM","source":"upstream","kind":"area","region":"Saskatchewan"}],"empty":false}}`))
	}))
	defer server.Close()
	v, err := Read(context.Background(), sdk.Client{BaseURL: server.URL, HTTP: server.Client()})
	if err != nil || len(v.Items) != 1 || v.Items[0].ID != "farm-1" {
		t.Fatalf("sdk integration: %+v %v", v, err)
	}
}
func TestGrowWrongVersion(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"version":"v2","data":{"items":[],"empty":true}}`))
	}))
	defer server.Close()
	_, err := Read(context.Background(), sdk.Client{BaseURL: server.URL, HTTP: server.Client()})
	if !errors.Is(err, ErrUnavailable) {
		t.Fatalf("wrong version accepted: %v", err)
	}
}
