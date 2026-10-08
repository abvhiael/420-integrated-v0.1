package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	grow "github.com/420integrated/420-integrated/grow/location"
	"github.com/420integrated/420-integrated/location/model"
	"github.com/420integrated/420-integrated/location/uikit"
)

func fixture() grow.View {
	return grow.View{ProvenanceAvailable: true, Items: []grow.Card{
		{ID: "farm-1", Name: "Prairie Farm", Category: model.CategoryFarm, Source: "upstream", Kind: uikit.KindArea, Region: "Saskatchewan"},
		{ID: "business-1", Name: "Main Street Store", Category: model.CategoryBusiness, Source: "upstream", Kind: uikit.KindArea, City: "Kindersley"},
		{ID: "farm-2", Name: "South Farm", Category: model.CategoryFarm, Source: "upstream", Kind: uikit.KindArea, Region: "Alberta"},
	}}
}
func serve(h Handler, path, method string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(method, path, nil))
	return w
}
func TestPaginationFilteringAndEmpty(t *testing.T) {
	h := Handler{reader: ReaderFunc(func(context.Context) (grow.View, error) { return fixture(), nil })}
	w := serve(h, "/v1/grow/places?category=FARM&limit=1", "GET")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var response struct {
		Version string `json:"version"`
		Data    struct {
			Items      []grow.Card `json:"items"`
			NextOffset *int        `json:"nextOffset"`
			Total      int         `json:"total"`
			Empty      bool        `json:"empty"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Version != "v1" || response.Data.Total != 2 || len(response.Data.Items) != 1 || response.Data.NextOffset == nil || *response.Data.NextOffset != 1 {
		t.Fatalf("pagination %+v", response)
	}
	response.Data.NextOffset = nil
	w = serve(h, "/v1/grow/places?category=FARM&limit=1&offset=1", "GET")
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Data.Items) != 1 || response.Data.Items[0].ID != "farm-2" || response.Data.NextOffset != nil {
		t.Fatalf("next page %+v", response)
	}
	w = serve(h, "/v1/grow/places?query=nomatch", "GET")
	if w.Code != 200 || !json.Valid(w.Body.Bytes()) {
		t.Fatal(w.Body.String())
	}
	w = serve(h, "/v1/grow/places?query=KINDERSLEY", "GET")
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
func TestRejectsBadRequestsAndMethods(t *testing.T) {
	h := Handler{reader: ReaderFunc(func(context.Context) (grow.View, error) { return fixture(), nil })}
	tests := []string{"/v1/grow/places?limit=0", "/v1/grow/places?limit=101", "/v1/grow/places?offset=-1", "/v1/grow/places?offset=100001", "/v1/grow/places?limit=nan", "/v1/grow/places?category=PRIVATE", "/v1/grow/places?bad=yes", "/v1/grow/places?limit=1&limit=2"}
	for _, path := range tests {
		if got := serve(h, path, "GET"); got.Code != 400 {
			t.Errorf("%s status %d", path, got.Code)
		}
	}
	if got := serve(h, "/v1/grow/places", "POST"); got.Code != 405 {
		t.Fatal("write accepted")
	}
	if got := serve(h, "/v1/private", "GET"); got.Code != 404 {
		t.Fatal("unknown route accepted")
	}
}
func TestFailClosedAndNoInternalErrorDisclosure(t *testing.T) {
	h := Handler{reader: ReaderFunc(func(context.Context) (grow.View, error) {
		return grow.View{}, errors.New("private db connection string")
	})}
	w := serve(h, "/v1/grow/places", "GET")
	if w.Code != 503 || w.Body.String() == "" {
		t.Fatal(w.Body.String())
	}
	if w.Body.String() == "private db connection string" || contains(w.Body.String(), "private db") {
		t.Fatal("secret leaked")
	}
	h.reader = ReaderFunc(func(context.Context) (grow.View, error) {
		return grow.View{ProvenanceAvailable: false, Items: []grow.Card{{ID: "bad", Category: model.CategoryFarm, Source: "x"}}}, nil
	})
	if got := serve(h, "/v1/grow/places", "GET"); got.Code != 502 {
		t.Fatalf("accepted untrusted provenance %d", got.Code)
	}
}
func contains(s, needle string) bool { return len(s) >= len(needle) && find(s, needle) }
func find(s, needle string) bool {
	for i := 0; i+len(needle) <= len(s); i++ {
		if s[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}

type rawSource struct {
	view uikit.View
	err  error
}

func (s rawSource) Places(context.Context) (uikit.View, error) { return s.view, s.err }
func TestProductionConstructorUsesSafeLocationProjection(t *testing.T) {
	source := rawSource{view: uikit.View{Items: []uikit.Item{
		{ID: "b1", Name: "Store", Source: "origin", Category: model.CategoryBusiness, Kind: uikit.KindArea, Region: "SK"},
		{ID: "v1", Name: "Other", Source: "origin", Category: model.CategoryVenue, Kind: uikit.KindArea, City: "Calgary"},
	}, Empty: false}}
	w := serve(New(source), "/v1/grow/places", "GET")
	if w.Code != 200 {
		t.Fatalf("public adapter: %s", w.Body.String())
	}
	var body struct {
		Data struct {
			Items []grow.Card `json:"items"`
			Total int         `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Data.Total != 1 || len(body.Data.Items) != 1 || body.Data.Items[0].ID != "b1" {
		t.Fatalf("unexpected projection %+v", body)
	}
	source.view.Items[0].Kind = uikit.KindArea
	val := 55.0
	source.view.Items[0].Latitude = &val
	w = serve(New(source), "/v1/grow/places", "GET")
	if w.Code != 503 {
		t.Fatalf("private-coordinate corruption accepted status=%d", w.Code)
	}
}
