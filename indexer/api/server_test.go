package api

import (
	"net/http/httptest"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeBackend struct{}
func (fakeBackend) Health() (model.Health, error) { return model.Health{ChainID: 420, IndexedHeight: 12, State: "HEALTHY"}, nil }
func (fakeBackend) Block(n uint64) (model.BlockRecord, bool, error) { return model.BlockRecord{ChainID: 420, Number: n, Hash: "0xblock"}, true, nil }
func (fakeBackend) Blocks(cur *Cursor, limit uint32) (BlockPage, error) {
	return BlockPage{Meta: PageMeta{ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0xblock", SchemaVersion: "v1"}, Blocks: []model.BlockRecord{{ChainID: 420, Number: 12, Hash: "0xblock"}}}, nil
}

func TestHealthEndpointNeverClaimsCanonicalAuthority(t *testing.T) {
	r := httptest.NewRequest("GET", "/v1/health", nil)
	w := httptest.NewRecorder()
	NewServer(fakeBackend{}).Handler().ServeHTTP(w, r)
	if w.Code != 200 { t.Fatalf("unexpected status %d", w.Code) }
	body := w.Body.String()
	if body == "" || body == "null\n" { t.Fatal("empty response") }
	if !contains(body, `"canonicalAuthority":false`) { t.Fatalf("authority boundary missing: %s", body) }
}

func TestBlocksRejectsOversizedPage(t *testing.T) {
	r := httptest.NewRequest("GET", "/v1/blocks?limit=251", nil)
	w := httptest.NewRecorder()
	NewServer(fakeBackend{}).Handler().ServeHTTP(w, r)
	if w.Code != 400 { t.Fatalf("expected 400, got %d", w.Code) }
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ { if s[i:i+len(sub)] == sub { return true } }
	return false
}
