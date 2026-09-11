package service

import (
	"context"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestBlockPagePreservesSnapshotAndFinality(t *testing.T) {
	idx := &fakeIndexer{blocks: indexerapi.BlockPage{
		Meta: indexerapi.PageMeta{
			ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0x12",
			SafeHeight: 11, FinalizedHeight: 10, SchemaVersion: "v1", NextCursor: "next",
		},
		Blocks: []model.BlockRecord{
			{ChainID: 420, Number: 12, Hash: "0x12", ParentHash: "0x11", Finality: model.FinalityHead, SchemaVersion: "v1"},
			{ChainID: 420, Number: 11, Hash: "0x11", ParentHash: "0x10", Finality: model.FinalitySafe, SchemaVersion: "v1"},
			{ChainID: 420, Number: 10, Hash: "0x10", ParentHash: "0x09", Finality: model.FinalityFinalized, SchemaVersion: "v1"},
		},
	}}
	svc, _ := New(idx, 420, time.Minute)
	page, err := svc.BlockPage(context.Background(), 3, "")
	if err != nil { t.Fatal(err) }
	if page.Meta.SnapshotHeight != 12 || page.Meta.NextCursor != "next" { t.Fatalf("snapshot metadata changed: %+v", page.Meta) }
	if len(page.Blocks) != 3 { t.Fatalf("unexpected block count: %d", len(page.Blocks)) }
	if page.Blocks[0].Finality != model.FinalityHead || page.Blocks[1].Finality != model.FinalitySafe || page.Blocks[2].Finality != model.FinalityFinalized {
		t.Fatalf("finality labels changed: %+v", page.Blocks)
	}
}

func TestBlockPageRejectsBlockBeyondSnapshot(t *testing.T) {
	idx := &fakeIndexer{blocks: indexerapi.BlockPage{
		Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 10},
		Blocks: []model.BlockRecord{{ChainID: 420, Number: 11, Hash: "0x11"}},
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.BlockPage(context.Background(), 10, ""); err == nil {
		t.Fatal("expected block beyond snapshot to fail closed")
	}
}

func TestBlockDetailNavigationUsesIndexedHeight(t *testing.T) {
	idx := &fakeIndexer{
		health: indexerapi.HealthResponse{Health: model.Health{ChainID: 420, IndexedHeight: 20}},
		block: model.BlockRecord{ChainID: 420, Number: 12, Hash: "0x12", ParentHash: "0x11", Finality: model.FinalityFinalized},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 12, BlockHash: "0x12", TransactionHash: "0xtx"}},
	}
	svc, _ := New(idx, 420, time.Minute)
	view, err := svc.BlockDetail(context.Background(), 12)
	if err != nil { t.Fatal(err) }
	if view.LogCount != 1 { t.Fatalf("unexpected log count: %d", view.LogCount) }
	if view.Navigation.Previous == nil || *view.Navigation.Previous != 11 { t.Fatalf("bad previous nav: %+v", view.Navigation) }
	if view.Navigation.Next == nil || *view.Navigation.Next != 13 { t.Fatalf("bad next nav: %+v", view.Navigation) }
}

func TestBlockDetailDoesNotAdvertiseNextPastIndexedHeight(t *testing.T) {
	idx := &fakeIndexer{
		health: indexerapi.HealthResponse{Health: model.Health{ChainID: 420, IndexedHeight: 12}},
		block: model.BlockRecord{ChainID: 420, Number: 12, Hash: "0x12"},
	}
	svc, _ := New(idx, 420, time.Minute)
	view, err := svc.BlockDetail(context.Background(), 12)
	if err != nil { t.Fatal(err) }
	if view.Navigation.Next != nil { t.Fatalf("unexpected next nav: %+v", view.Navigation) }
}
