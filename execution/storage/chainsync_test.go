package storage

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

type fakeBackend struct {
	latest BlockRef
	blocks map[uint64]BlockRef
	logs   map[[2]uint64][]ChainLog
}

func (f fakeBackend) LatestBlock(context.Context) (BlockRef, error) { return f.latest, nil }
func (f fakeBackend) BlockByNumber(_ context.Context, number uint64) (BlockRef, error) {
	b, ok := f.blocks[number]
	if !ok { return BlockRef{}, ErrInvalidChainState }
	return b, nil
}
func (f fakeBackend) Logs(_ context.Context, fromBlock, toBlock uint64, _ LogFilter) ([]ChainLog, error) {
	return append([]ChainLog(nil), f.logs[[2]uint64{fromBlock, toBlock}]...), nil
}

type fakeProjection struct {
	filter  LogFilter
	applied []ChainLog
	resets  []uint64
}
func (f *fakeProjection) Filter() LogFilter { return f.filter }
func (f *fakeProjection) Apply(_ context.Context, log ChainLog) error {
	f.applied = append(f.applied, log)
	return nil
}
func (f *fakeProjection) Reset(_ context.Context, from uint64) error {
	f.resets = append(f.resets, from)
	f.applied = nil
	return nil
}

func TestSyncerBatchesPersistsAndResumes(t *testing.T) {
	ctx := context.Background()
	cursor, err := NewFileCursorStore(filepath.Join(t.TempDir(), "chain", "cursor.json"))
	if err != nil { t.Fatal(err) }
	backend := fakeBackend{
		latest: BlockRef{Number: 15, Hash: "0xf"},
		blocks: map[uint64]BlockRef{
			12: {Number: 12, Hash: "0xc"},
			14: {Number: 14, Hash: "0xe"},
			15: {Number: 15, Hash: "0xf"},
		},
		logs: map[[2]uint64][]ChainLog{
			{10, 12}: {{Address:"0xa", BlockNumber:11, BlockHash:"0xb", TxHash:"0x1", LogIndex:0}},
			{13, 14}: {{Address:"0xa", BlockNumber:14, BlockHash:"0xe", TxHash:"0x2", LogIndex:1}},
		},
	}
	projection := &fakeProjection{filter: LogFilter{Addresses: []string{"0xa"}}}
	syncer := Syncer{Backend: backend, Cursor: cursor, Projection: projection, StartBlock:10, Confirmations:1, BatchSize:3}
	got, err := syncer.Sync(ctx)
	if err != nil { t.Fatal(err) }
	if got.BlockNumber != 14 || got.BlockHash != "0xe" { t.Fatalf("cursor=%+v", got) }
	if len(projection.applied) != 2 { t.Fatalf("applied=%d", len(projection.applied)) }

	projection.applied = nil
	got, err = syncer.Sync(ctx)
	if err != nil { t.Fatal(err) }
	if got.BlockNumber != 14 || len(projection.applied) != 0 { t.Fatalf("resume cursor=%+v applied=%d", got, len(projection.applied)) }
}

func TestSyncerDetectsReorgAndResetsProjection(t *testing.T) {
	ctx := context.Background()
	cursor, err := NewFileCursorStore(filepath.Join(t.TempDir(), "cursor.json"))
	if err != nil { t.Fatal(err) }
	if err := cursor.Save(ctx, SyncCursor{BlockNumber:20, BlockHash:"0xold"}); err != nil { t.Fatal(err) }
	projection := &fakeProjection{}
	backend := fakeBackend{latest:BlockRef{Number:25, Hash:"0x19"}, blocks:map[uint64]BlockRef{20:{Number:20, Hash:"0xnew"}}}
	_, err = (Syncer{Backend:backend, Cursor:cursor, Projection:projection, StartBlock:7, Confirmations:2}).Sync(ctx)
	if !errors.Is(err, ErrChainReorganization) { t.Fatalf("got %v", err) }
	if !reflect.DeepEqual(projection.resets, []uint64{7}) { t.Fatalf("resets=%v", projection.resets) }
	loaded, err := cursor.Load(ctx)
	if err != nil { t.Fatal(err) }
	if loaded.BlockNumber != 0 || loaded.BlockHash != "" { t.Fatalf("cursor not cleared: %+v", loaded) }
}

func TestSyncerRejectsRemovedOrOutOfRangeLogs(t *testing.T) {
	ctx := context.Background()
	cursor, err := NewFileCursorStore(filepath.Join(t.TempDir(), "cursor.json"))
	if err != nil { t.Fatal(err) }
	projection := &fakeProjection{}
	backend := fakeBackend{
		latest: BlockRef{Number:8, Hash:"0x8"},
		blocks: map[uint64]BlockRef{8:{Number:8, Hash:"0x8"}},
		logs: map[[2]uint64][]ChainLog{{5,8}:{{BlockNumber:7, BlockHash:"0x7", Removed:true}}},
	}
	_, err = (Syncer{Backend:backend, Cursor:cursor, Projection:projection, StartBlock:5, BatchSize:10}).Sync(ctx)
	if !errors.Is(err, ErrInvalidChainState) { t.Fatalf("got %v", err) }
}

func TestFileCursorStoreIsRestartSafe(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "cursor.json")
	first, err := NewFileCursorStore(path)
	if err != nil { t.Fatal(err) }
	want := SyncCursor{BlockNumber:42, BlockHash:"0xabc"}
	if err := first.Save(context.Background(), want); err != nil { t.Fatal(err) }
	second, err := NewFileCursorStore(path)
	if err != nil { t.Fatal(err) }
	got, err := second.Load(context.Background())
	if err != nil { t.Fatal(err) }
	if got != want { t.Fatalf("got=%+v want=%+v", got, want) }
	if _, err := os.Stat(path+".tmp"); !errors.Is(err, os.ErrNotExist) { t.Fatalf("temporary cursor remains: %v", err) }
}

func TestRPCBackendDecodesCanonicalEthereumResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Method string `json:"method"` }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil { t.Fatal(err) }
		w.Header().Set("Content-Type", "application/json")
		switch req.Method {
		case "eth_blockNumber":
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x10"}`))
		case "eth_getBlockByNumber":
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"number":"0x10","hash":"0xfeed"}}`))
		case "eth_getLogs":
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":[{"address":"0xabc","topics":["0xtopic"],"data":"0x","blockNumber":"0x10","blockHash":"0xfeed","transactionHash":"0xbeef","logIndex":"0x2","removed":false}]}`))
		default:
			w.WriteHeader(http.StatusBadRequest)
		}
	}))
	defer server.Close()
	backend := RPCBackend{URL:server.URL, Client:server.Client()}
	block, err := backend.LatestBlock(context.Background())
	if err != nil { t.Fatal(err) }
	if block.Number != 16 || block.Hash != "0xfeed" { t.Fatalf("block=%+v", block) }
	logs, err := backend.Logs(context.Background(), 16, 16, LogFilter{Addresses:[]string{"0xabc"}, Topics:[][]string{{"0xtopic"}}})
	if err != nil { t.Fatal(err) }
	if len(logs) != 1 || logs[0].LogIndex != 2 || logs[0].BlockNumber != 16 { t.Fatalf("logs=%+v", logs) }
}
