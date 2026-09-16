package registry

import (
	"context"
	"errors"
	"testing"
)

const (
	registryAddr = "0x0000000000000000000000000000000000000420"
	impl1 = "0x0000000000000000000000000000000000001001"
	impl2 = "0x0000000000000000000000000000000000001002"
	h1 = "0x1111111111111111111111111111111111111111111111111111111111111111"
	h2 = "0x2222222222222222222222222222222222222222222222222222222222222222"
	h3 = "0x3333333333333333333333333333333333333333333333333333333333333333"
	h4 = "0x4444444444444444444444444444444444444444444444444444444444444444"
)

type sourceFunc func(context.Context) (Snapshot, error)
func (f sourceFunc) Snapshot(ctx context.Context) (Snapshot, error) { return f(ctx) }

func record(version uint32, impl, blockHash string, block uint64) VersionRecord {
	return VersionRecord{ServiceID:"420/service/example/v1", Version:version, Implementation:impl, CodeHash:h1, MetadataHash:h2, ComponentType:2, ManifestHash:h3, DependencyRoot:h4, InterfaceHash:h1, Active:true, BlockNumber:block, BlockHash:blockHash}
}

func TestApplyPreservesSequentialCanonicalHistory(t *testing.T) {
	p, err := NewProjection(420, registryAddr); if err != nil { t.Fatal(err) }
	s := Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:12, Versions:[]VersionRecord{record(2, impl2, h4, 12), record(1, impl1, h3, 10)}}
	if err := p.Apply(s); err != nil { t.Fatal(err) }
	versions := p.Service("420/service/example/v1")
	if len(versions) != 2 || versions[0].Version != 1 || versions[1].Version != 2 { t.Fatalf("unexpected history: %#v", versions) }
	if p.FinalizedBlock() != 12 { t.Fatalf("finalized block=%d", p.FinalizedBlock()) }
}

func TestApplyIsReplaySafe(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	s := Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:10, Versions:[]VersionRecord{record(1, impl1, h3, 10)}}
	if err := p.Apply(s); err != nil { t.Fatal(err) }
	if err := p.Apply(s); err != nil { t.Fatal(err) }
	if got := len(p.Service("420/service/example/v1")); got != 1 { t.Fatalf("versions=%d", got) }
}

func TestApplyRejectsVersionGap(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	err := p.Apply(Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:12, Versions:[]VersionRecord{record(2, impl2, h4, 12)}})
	if !errors.Is(err, ErrVersionGap) { t.Fatalf("err=%v", err) }
}

func TestApplyRejectsConflictingCanonicalReplay(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	base := Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:10, Versions:[]VersionRecord{record(1, impl1, h3, 10)}}
	if err := p.Apply(base); err != nil { t.Fatal(err) }
	conflict := record(1, impl2, h3, 10)
	err := p.Apply(Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:11, Versions:[]VersionRecord{conflict}})
	if !errors.Is(err, ErrConflictingCanonical) { t.Fatalf("err=%v", err) }
}

func TestApplyRejectsWrongChainRegistryAndFinalityRegression(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	if err := p.Apply(Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:10, Versions:[]VersionRecord{record(1, impl1, h3, 10)}}); err != nil { t.Fatal(err) }
	for _, s := range []Snapshot{
		{ChainID:421, RegistryAddress:registryAddr, FinalizedBlock:11},
		{ChainID:420, RegistryAddress:impl1, FinalizedBlock:11},
		{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:9},
	} {
		if !errors.Is(p.Apply(s), ErrInvalidCanonicalRecord) { t.Fatalf("expected invalid snapshot: %#v", s) }
	}
}

func TestRebuildProducesSameCanonicalProjection(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	one := record(1, impl1, h3, 10); two := record(2, impl2, h4, 12)
	if err := p.Apply(Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:10, Versions:[]VersionRecord{one}}); err != nil { t.Fatal(err) }
	if err := p.Rebuild(Snapshot{ChainID:420, RegistryAddress:registryAddr, FinalizedBlock:12, Versions:[]VersionRecord{one,two}}); err != nil { t.Fatal(err) }
	if got := p.Service("420/service/example/v1"); len(got) != 2 || got[1].Implementation != impl2 { t.Fatalf("unexpected rebuild: %#v", got) }
}

func TestSyncPropagatesCanonicalSourceFailure(t *testing.T) {
	p, _ := NewProjection(420, registryAddr)
	boom := errors.New("rpc unavailable")
	err := Sync(context.Background(), sourceFunc(func(context.Context)(Snapshot,error){ return Snapshot{}, boom }), p)
	if !errors.Is(err, boom) { t.Fatalf("err=%v", err) }
}
