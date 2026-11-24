package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/indexerclient"
)

func TestCompensationHandlerPreservesIntegersAndPeriod(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/protocols/development-compensation/report" ||
			r.URL.Query().Get("chainId") != "420" || r.URL.Query().Get("from") != "1" || r.URL.Query().Get("to") != "2" {
			t.Errorf("unexpected Indexer request: %s", r.URL)
		}
		_, _ = w.Write([]byte(`{"apiVersion":"v1","data":{"eligibleRevenue":"9007199254740993"}}`))
	}))
	defer upstream.Close()
	client, err := indexerclient.New(upstream.URL, 420, time.Second, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	handler := compensationHandler(client)
	out := httptest.NewRecorder()
	handler.ServeHTTP(out, httptest.NewRequest(http.MethodGet, "/v1/development-compensation?from=1&to=2", nil))
	if out.Code != 200 || out.Header().Get("Cache-Control") != "no-store" ||
		!strings.Contains(out.Body.String(), `"9007199254740993"`) {
		t.Fatalf("unexpected report: %d %s", out.Code, out.Body)
	}
}
