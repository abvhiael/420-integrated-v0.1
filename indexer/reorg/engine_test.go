package reorg

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
)

type fakeSource struct{ blocks map[uint64]model.BlockRecord }
func (f *fakeSource) BundleByNumber(_ context.Context, _ uint64, n uint64, _ model.Finality, _ string) (indexerrpc.Bundle, error) {
	b, ok := f.blocks[n]
	if !ok { return indexerrpc.Bundle{}, errors.New("missing remote block") }
	return indexerrpc.Bundle{Block: b}, nil
}

type fakeStore struct {
	cp model.ChainCheckpoint
	has bool
	blocks map[uint64]model.BlockRecord
}
func (s *fakeStore) Checkpoint() (model.ChainCheckpoint, bool, error) { return s.cp, s.has, nil }
func (s *fakeStore) SaveCheckpoint(cp model.ChainCheckpoint) error { s.cp, s.has = cp, true; return nil }
func (s *fakeStore) Block(n uint64) (model.BlockRecord, bool, error) { b, ok := s.blocks[n]; return b, ok, nil }
func (s *fakeStore) PutBundle(b model.BlockRecord, _ []model.TransactionRecord, _ []model.ReceiptRecord, _ []model.LogRecord) error { s.blocks[b.Number] = b; return nil }
func (s *fakeStore) DeleteBlocksAbove(n uint64) error { for h := range s.blocks { if h > n { delete(s.blocks, h) } }; return nil }

func block(n uint64, hash, parent string) model.BlockRecord { return model.BlockRecord{ChainID: 420, Number: n, Hash: hash, ParentHash: parent, SchemaVersion: "v1"} }

func TestRepairNonFinalizedFork(t *testing.T) {
	s := &fakeStore{
		has: true,
		cp: model.ChainCheckpoint{ChainID:420, IndexedHeight:4, IndexedHash:"old4", FinalizedHeight:2, FinalizedHash:"h2", SafeHeight:3, SafeHash:"old3", SchemaVersion:"v1"},
		blocks: map[uint64]model.BlockRecord{
			0:block(0,"h0",""), 1:block(1,"h1","h0"), 2:block(2,"h2","h1"), 3:block(3,"old3","h2"), 4:block(4,"old4","old3"),
		},
	}
	src := &fakeSource{blocks: map[uint64]model.BlockRecord{
		0:block(0,"h0",""), 1:block(1,"h1","h0"), 2:block(2,"h2","h1"), 3:block(3,"new3","h2"), 4:block(4,"new4","new3"), 5:block(5,"new5","new4"),
	}}
	e := New(420, "v1", src, s)
	if err := e.Repair(context.Background(), 5); err != nil { t.Fatal(err) }
	if s.cp.IndexedHeight != 5 || s.cp.IndexedHash != "new5" { t.Fatalf("unexpected checkpoint: %+v", s.cp) }
	if s.cp.FinalizedHeight != 2 || s.cp.FinalizedHash != "h2" { t.Fatalf("finalized boundary changed: %+v", s.cp) }
	if b, ok, _ := s.Block(3); !ok || b.Hash != "new3" { t.Fatalf("block 3 not replayed: %+v", b) }
}

func TestRepairFailsClosedOnFinalizedConflict(t *testing.T) {
	s := &fakeStore{
		has: true,
		cp: model.ChainCheckpoint{ChainID:420, IndexedHeight:3, IndexedHash:"old3", FinalizedHeight:2, FinalizedHash:"h2", SchemaVersion:"v1"},
		blocks: map[uint64]model.BlockRecord{0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"h2","h1"),3:block(3,"old3","h2")},
	}
	src := &fakeSource{blocks: map[uint64]model.BlockRecord{0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"evil2","h1"),3:block(3,"evil3","evil2")}}
	e := New(420, "v1", src, s)
	err := e.Repair(context.Background(), 3)
	if !errors.Is(err, ErrRemoteFinalizedConflict) { t.Fatalf("expected finalized conflict, got %v", err) }
	if s.cp.IndexedHash != "old3" { t.Fatal("store mutated despite finalized conflict") }
}


type producerAttributor map[string]model.BlockProducer
func (m producerAttributor) ProducerForBlock(hash string) (model.BlockProducer, bool, error) {
	p, ok := m[hash]
	return p, ok, nil
}

func TestRepairReplacesProducerAttributionWithCanonicalFork(t *testing.T) {
	s := &fakeStore{
		has:true,
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:4,IndexedHash:"old4",FinalizedHeight:2,FinalizedHash:"h2",SafeHeight:3,SafeHash:"old3",SchemaVersion:"v1"},
		blocks:map[uint64]model.BlockRecord{
			0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"h2","h1"),
			3:{ChainID:420,Number:3,Hash:"old3",ParentHash:"h2",Producer:&model.BlockProducer{ConsensusSlot:3,ProducerSeat:8}},
			4:{ChainID:420,Number:4,Hash:"old4",ParentHash:"old3",Producer:&model.BlockProducer{ConsensusSlot:4,ProducerSeat:9}},
		},
	}
	src := &fakeSource{blocks:map[uint64]model.BlockRecord{
		0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"h2","h1"),
		3:block(3,"new3","h2"),4:block(4,"new4","new3"),5:block(5,"new5","new4"),
	}}
	attr := producerAttributor{
		"new3":{ConsensusSlot:30,ProducerSeat:1,ConsensusBlockRoot:"r3"},
		"new4":{ConsensusSlot:31,ProducerSeat:2,ConsensusBlockRoot:"r4"},
		"new5":{ConsensusSlot:32,ProducerSeat:3,ConsensusBlockRoot:"r5",Certified:true},
	}
	e := New(420,"v1",src,s).WithProducerAttributor(attr)
	if err := e.Repair(context.Background(),5); err != nil { t.Fatal(err) }
	b, ok, _ := s.Block(3)
	if !ok || b.Hash!="new3" || b.Producer==nil || b.Producer.ProducerSeat!=1 || b.Producer.ConsensusSlot!=30 {
		t.Fatalf("canonical fork producer attribution not replaced: %+v", b)
	}
	if b.Producer.ProducerSeat==8 { t.Fatal("orphaned producer attribution survived reorg") }
}

func TestRepairFailsClosedWhenCanonicalForkProducerMissing(t *testing.T) {
	s := &fakeStore{
		has:true,
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:3,IndexedHash:"old3",FinalizedHeight:2,FinalizedHash:"h2",SchemaVersion:"v1"},
		blocks:map[uint64]model.BlockRecord{0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"h2","h1"),3:block(3,"old3","h2")},
	}
	src := &fakeSource{blocks:map[uint64]model.BlockRecord{0:block(0,"h0",""),1:block(1,"h1","h0"),2:block(2,"h2","h1"),3:block(3,"new3","h2")}}
	e := New(420,"v1",src,s).WithProducerAttributor(producerAttributor{})
	if err := e.Repair(context.Background(),3); err == nil { t.Fatal("expected missing replay attribution failure") }
	if b, ok, _ := s.Block(3); !ok || b.Hash != "old3" { t.Fatalf("store mutated before producer preflight completed: %+v", b) }
}
