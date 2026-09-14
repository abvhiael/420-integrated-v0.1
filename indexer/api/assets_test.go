package api

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

type assetStore struct {
	memoryReadStore
	transfers []model.AssetTransferRecord
}
func (a assetStore) AssetTransfers(assetKey, address string) ([]model.AssetTransferRecord, error) { return a.transfers, nil }

func TestAssetTransfersPinsCheckpointAndBoundsRows(t *testing.T) {
	store := assetStore{
		memoryReadStore: memoryReadStore{cp:model.ChainCheckpoint{ChainID:420, IndexedHeight:10, IndexedHash:"0x10", SafeHeight:9, FinalizedHeight:8, SchemaVersion:"v1", UpdatedAt:time.Now()}, blocks:map[uint64]model.BlockRecord{}},
		transfers: []model.AssetTransferRecord{
			{ChainID:420, BlockNumber:10, BlockHash:"0x10", TransactionHash:"0xa", AssetKey:"native:420", AssetKind:"native", From:"0x1", To:"0x2", Amount:"1", LogIndex:-1},
			{ChainID:420, BlockNumber:11, BlockHash:"0x11", TransactionHash:"0xb", AssetKey:"native:420", AssetKind:"native", From:"0x1", To:"0x2", Amount:"2", LogIndex:-1},
		},
	}
	page, err := NewStoreBackend(store,nil).AssetTransfers("native:420","",10)
	if err != nil { t.Fatal(err) }
	if page.Meta.SnapshotHeight != 10 || page.Meta.SnapshotHash != "0x10" { t.Fatalf("unexpected snapshot: %+v", page.Meta) }
	if len(page.Transfers) != 1 || page.Transfers[0].TransactionHash != "0xa" { t.Fatalf("unexpected page: %+v", page) }
	if page.CanonicalAuthority { t.Fatal("asset page claimed canonical authority") }
}

type assetHTTPBackend struct{ fakeBackend }
func (assetHTTPBackend) AssetTransfers(assetKey, address string, limit uint32) (AssetTransferPage,error) {
	return AssetTransferPage{Meta:PageMeta{ChainID:420,SnapshotHeight:12,SnapshotHash:"0x12"},AssetKey:assetKey,Address:address,Transfers:[]model.AssetTransferRecord{{ChainID:420,BlockNumber:12,BlockHash:"0x12",TransactionHash:"0xtx",LogIndex:-1,AssetKey:"native:420",AssetKind:"native",From:"0x1",To:"0x2",Amount:"420"}},CanonicalAuthority:false},nil
}

func TestAssetTransfersHTTPRoute(t *testing.T) {
	r := httptest.NewRequest("GET","/v1/asset-transfers?assetKey=native%3A420&limit=25",nil)
	w := httptest.NewRecorder()
	NewServer(assetHTTPBackend{}).Handler().ServeHTTP(w,r)
	if w.Code != 200 { t.Fatalf("unexpected status %d: %s",w.Code,w.Body.String()) }
	if !contains(w.Body.String(),`"assetKey":"native:420"`) || !contains(w.Body.String(),`"canonicalAuthority":false`) { t.Fatalf("unexpected body: %s",w.Body.String()) }
}
