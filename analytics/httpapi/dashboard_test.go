package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDashboardHandlerUsesCatalogStatus(t *testing.T) {
	s, err := New(fakeCatalog{ready: true})
	if err != nil { t.Fatal(err) }
	h, err := s.DashboardHandler()
	if err != nil { t.Fatal(err) }
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/dashboard", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	body := rr.Body.String()
	for _, want := range []string{"420Analytics", ">420<", ">100<", ">90<", ">10<", "/v1/methodologies"} {
		if !strings.Contains(body, want) { t.Fatalf("dashboard missing %q", want) }
	}
}
