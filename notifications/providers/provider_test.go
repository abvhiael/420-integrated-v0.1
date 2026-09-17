package providers

import (
	"context"
	"errors"
	"testing"

	"github.com/abvhiael/420-integrated-v0.1/notifications/delivery"
)

type fakeSender struct {
	id      string
	err     error
	seenDst string
	seen    []byte
}

func (f *fakeSender) Send(_ context.Context, destination string, payload []byte) (string, error) {
	f.seenDst = destination
	f.seen = append([]byte(nil), payload...)
	if f.err != nil { return "", f.err }
	return f.id, nil
}

func validRequest() Request {
	return Request{
		DeliveryKey: "sub|event|provider|dest",
		EventID: "event-1",
		Destination: "device-1",
		Severity: delivery.SeverityWarning,
		Payload: []byte("hello"),
		Attempt: 0,
	}
}

func TestGenesisAdaptersAreNonAuthoritative(t *testing.T) {
	cases := []struct {
		name string
		build func(Sender) (*Adapter, error)
		kind Kind
	}{
		{"in-app", InAppAdapter, KindInApp},
		{"web", WebAdapter, KindWeb},
		{"push", PushAdapter, KindPush},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := &fakeSender{id: "remote-1"}
			p, err := tc.build(s)
			if err != nil { t.Fatal(err) }
			if p.Kind() != tc.kind { t.Fatalf("kind=%q", p.Kind()) }
			res, err := p.Deliver(context.Background(), validRequest())
			if err != nil { t.Fatal(err) }
			if res.Authoritative { t.Fatal("delivery provider became authoritative") }
			if res.ProviderID != p.ID() || res.ExternalID != "remote-1" { t.Fatalf("unexpected result: %+v", res) }
		})
	}
}

func TestAdapterFailureIsReturnedWithoutAuthority(t *testing.T) {
	p, err := PushAdapter(&fakeSender{err: errors.New("provider unavailable")})
	if err != nil { t.Fatal(err) }
	if _, err := p.Deliver(context.Background(), validRequest()); err == nil { t.Fatal("expected provider failure") }
}

func TestAdapterCopiesPayload(t *testing.T) {
	s := &fakeSender{id: "remote-1"}
	p, _ := WebAdapter(s)
	req := validRequest()
	if _, err := p.Deliver(context.Background(), req); err != nil { t.Fatal(err) }
	req.Payload[0] = 'X'
	if string(s.seen) != "hello" { t.Fatalf("sender payload mutated: %q", s.seen) }
}

func TestRegistryRejectsDuplicateProviders(t *testing.T) {
	p1, _ := InAppAdapter(&fakeSender{id: "a"})
	p2, _ := InAppAdapter(&fakeSender{id: "b"})
	if _, err := NewRegistry(p1, p2); err == nil { t.Fatal("expected duplicate provider rejection") }
}

func TestRegistrySupportsAlternativeProviders(t *testing.T) {
	p1, err := NewAdapter("alt-web", KindWeb, &fakeSender{id: "x"})
	if err != nil { t.Fatal(err) }
	p2, err := PushAdapter(&fakeSender{id: "y"})
	if err != nil { t.Fatal(err) }
	r, err := NewRegistry(p1, p2)
	if err != nil { t.Fatal(err) }
	if _, ok := r.Get("ALT-WEB"); !ok { t.Fatal("alternative provider unavailable") }
	if _, ok := r.Get("genesis-push"); !ok { t.Fatal("genesis push unavailable") }
}

func TestAdapterRejectsInvalidRequest(t *testing.T) {
	p, _ := InAppAdapter(&fakeSender{id: "ok"})
	r := validRequest()
	r.Destination = ""
	if _, err := p.Deliver(context.Background(), r); err == nil { t.Fatal("expected invalid destination") }
}
