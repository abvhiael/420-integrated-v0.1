package reeferreview

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestRR11NewsOnlyServerRequiresNoTestnetAndExposesNoEditorialRoutes(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sources.json")
	registry := testNewsRegistry()
	if err := persistNewsRegistry(path, registry); err != nil {
		t.Fatal(err)
	}
	store, err := OpenFileNewsStore(filepath.Join(dir, "news.json"))
	if err != nil {
		t.Fatal(err)
	}
	secret := strings.Repeat("k", 40)
	h := HTTP{News: &NewsService{Store: store, Sources: registry, SourcesPath: path}, NewsAdminKey: []byte(secret)}.NewsOnlyHandler()
	for _, path := range []string{"/readyz", "/v1/news", "/v1/news/sources", "/v1/news/topics"} {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusOK {
			t.Fatalf("%s returned %d %s", path, rr.Code, rr.Body.String())
		}
	}
	for _, path := range []string{"/v1/publications", "/v1/editorial/publications", "/v1/publications/x/publish"} {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, path, nil))
		if rr.Code != http.StatusNotFound {
			t.Fatalf("news-only leaked editorial route %s: %d", path, rr.Code)
		}
	}
	for _, auth := range []string{"", "Bearer bad", "Bearer " + strings.Repeat("k", 39)} {
		req := httptest.NewRequest(http.MethodGet, "/v1/admin/news/sources", nil)
		req.Header.Set("Authorization", auth)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("admin accepted wrong secret: %d", rr.Code)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/admin/news/sources", nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("authenticated admin GET failed: %d %s", rr.Code, rr.Body.String())
	}
	healthServer:=HTTP{News:&NewsService{Store:store,Sources:registry,SourcesPath:path},NewsAdminKey:[]byte(secret),NewsFeedCheckpointPath:filepath.Join(dir,"checkpoint.json")}.NewsOnlyHandler()
 healthReq:=httptest.NewRequest(http.MethodGet,"/v1/admin/news/health",nil)
 healthReq.Header.Set("Authorization","Bearer "+secret)
 healthRec:=httptest.NewRecorder()
 healthServer.ServeHTTP(healthRec,healthReq)
 if healthRec.Code!=http.StatusOK || !strings.Contains(healthRec.Body.String(),"source-a") {t.Fatalf("admin health failed: %d %s",healthRec.Code,healthRec.Body.String())}
 healthReq.Header.Set("Authorization","Bearer wrong")
 healthRec=httptest.NewRecorder();healthServer.ServeHTTP(healthRec,healthReq)
 if healthRec.Code!=http.StatusUnauthorized {t.Fatalf("health route leaked without admin key: %d",healthRec.Code)}
 wrong := HTTP{News: &NewsService{Store: store, Sources: registry, SourcesPath: path}}.NewsOnlyHandler()
	rr = httptest.NewRecorder()
	wrong.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("disabled admin key did not fail closed: %d", rr.Code)
	}
	_ = bytes.Compare
}
