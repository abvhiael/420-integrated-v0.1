package api

import (
	"net/http/httptest"
	"testing"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeBackend struct{}
func (fakeBackend) Health() (model.Health, error) { return model.Health{ChainID: 420, IndexedHeight: 12, State: "HEALTHY"}, nil }
func (fakeBackend) Block(n uint64) (model.BlockRecord, bool, error) { return model.BlockRecord{ChainID: 420, Number: n, Hash: "0xblock"}, true, nil }
func (fakeBackend) Blocks(cur *Cursor, limit uint32) (BlockPage, error) {
	return BlockPage{Meta: PageMeta{ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0xblock", SchemaVersion: "v1"}, Blocks: []model.BlockRecord{{ChainID: 420, Number: 12, Hash: "0xblock"}}}, nil
}
func (fakeBackend) Transaction(hash string) (model.TransactionRecord, bool, error) {
	return model.TransactionRecord{ChainID: 420, BlockNumber: 12, BlockHash: "0xblock", Hash: hash, Index: 0}, true, nil
}
func (fakeBackend) Receipt(hash string) (model.ReceiptRecord, bool, error) {
	return model.ReceiptRecord{ChainID: 420, BlockNumber: 12, BlockHash: "0xblock", TransactionHash: hash, Status: 1}, true, nil
}
func (fakeBackend) LogsByBlock(number uint64) ([]model.LogRecord, error) {
	return []model.LogRecord{{ChainID: 420, BlockNumber: number, BlockHash: "0xblock", TransactionHash: "0xtx", LogIndex: 0}}, nil
}
func (fakeBackend) ServiceVersion(serviceID string, version uint32) (decoder.ServiceVersion, error) {
	return decoder.ServiceVersion{ServiceID: serviceID, Version: version, Implementation: "0x420", ActivatedBlock: 7, ActivatedHash: "0x07"}, nil
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

func TestExtendedReadEndpoints(t *testing.T) {
	h := NewServer(fakeBackend{}).Handler()
	for _, path := range []string{"/v1/transactions/0xtx", "/v1/receipts/0xtx", "/v1/blocks/12/logs", "/v1/services/registry/versions/1"} {
		r := httptest.NewRequest("GET", path, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 200 { t.Fatalf("%s: unexpected status %d", path, w.Code) }
		if !contains(w.Body.String(), `"canonicalAuthority":false`) { t.Fatalf("%s missing authority boundary: %s", path, w.Body.String()) }
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ { if s[i:i+len(sub)] == sub { return true } }
	return false
}
