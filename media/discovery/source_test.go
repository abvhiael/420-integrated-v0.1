package discovery

import (
	"context"
	"errors"
	"testing"
)

type fakeIndex struct {
	ids [][32]byte
	err error
}
func (f fakeIndex) OperatorIDs(context.Context, [32]byte) ([][32]byte, error) { return f.ids, f.err }

type fakeRegistry struct {
	providers map[[32]byte]Provider
	err       error
}
func (f fakeRegistry) CanonicalProvider(_ context.Context, operatorID, _ [32]byte) (Provider, error) {
	if f.err != nil { return Provider{}, f.err }
	return f.providers[operatorID], nil
}

type fakeProfiles struct {
	profiles map[[32]byte]ServiceProfile
	bad      map[[32]byte]bool
}
func (f fakeProfiles) ResolveProfile(_ context.Context, operatorID, _ [32]byte, _ uint32) (ServiceProfile, error) {
	if f.bad[operatorID] { return ServiceProfile{}, errors.New("bad profile") }
	return f.profiles[operatorID], nil
}

func canonical(id byte, cap [32]byte, active bool) Provider {
	return Provider{OperatorID: did(id), MetadataHash: did(id + 20), Revision: 2, Active: active, Capabilities: map[[32]byte]struct{}{cap: {}}}
}

func TestIndexedSourceRevalidatesCanonicalState(t *testing.T) {
	cap := did(1)
	ids := [][32]byte{did(2), did(2), did(3), did(4), {}}
	reg := fakeRegistry{providers: map[[32]byte]Provider{
		did(2): canonical(2, cap, true),
		did(3): canonical(3, cap, false),
		did(4): canonical(4, cap, true),
	}}
	profiles := fakeProfiles{
		profiles: map[[32]byte]ServiceProfile{did(2): {PricePerUnit: 10, LatencyMS: 20, Geography: "ca-central", AvailableSlots: 4, ReliabilityBPS: 9990}},
		bad: map[[32]byte]bool{did(4): true},
	}
	s := IndexedSource{Index: fakeIndex{ids: ids}, Registry: reg, Profiles: profiles}
	got, err := s.Candidates(context.Background(), cap)
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].OperatorID != did(2) {
		t.Fatalf("expected one canonical provider, got %+v", got)
	}
	if got[0].PricePerUnit != 10 || got[0].ReliabilityBPS != 9990 {
		t.Fatalf("profile was not applied: %+v", got[0])
	}
}

func TestIndexedSourceFailsClosedOnCanonicalReadError(t *testing.T) {
	cap := did(1)
	s := IndexedSource{
		Index: fakeIndex{ids: [][32]byte{did(2)}},
		Registry: fakeRegistry{err: errors.New("rpc unavailable")},
		Profiles: fakeProfiles{},
	}
	if _, err := s.Candidates(context.Background(), cap); err == nil {
		t.Fatal("expected canonical read error")
	}
}

func TestIndexedSourceRejectsInvalidReliabilityProfile(t *testing.T) {
	cap := did(1)
	s := IndexedSource{
		Index: fakeIndex{ids: [][32]byte{did(2)}},
		Registry: fakeRegistry{providers: map[[32]byte]Provider{did(2): canonical(2, cap, true)}},
		Profiles: fakeProfiles{profiles: map[[32]byte]ServiceProfile{did(2): {ReliabilityBPS: 10001}}},
	}
	got, err := s.Candidates(context.Background(), cap)
	if err != nil { t.Fatal(err) }
	if len(got) != 0 { t.Fatalf("invalid profile must be excluded: %+v", got) }
}
