package providers

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/abvhiael/420-integrated-v0.1/notifications/delivery"
)

type Kind string

const (
	KindInApp Kind = "in_app"
	KindWeb   Kind = "web"
	KindPush  Kind = "push"
)

type Request struct {
	DeliveryKey  string
	EventID      string
	Destination  string
	Severity     delivery.Severity
	Payload      []byte
	Attempt      int
}

type Result struct {
	ProviderID    string
	ExternalID    string
	DeliveredAt   time.Time
	Authoritative bool
}

type Provider interface {
	ID() string
	Kind() Kind
	Deliver(context.Context, Request) (Result, error)
}

type Sender interface {
	Send(context.Context, string, []byte) (string, error)
}

type Adapter struct {
	id     string
	kind   Kind
	sender Sender
}

func NewAdapter(id string, kind Kind, sender Sender) (*Adapter, error) {
	id = strings.TrimSpace(strings.ToLower(id))
	if id == "" { return nil, errors.New("provider id is required") }
	if kind != KindInApp && kind != KindWeb && kind != KindPush { return nil, errors.New("invalid provider kind") }
	if sender == nil { return nil, errors.New("provider sender is required") }
	return &Adapter{id: id, kind: kind, sender: sender}, nil
}

func (a *Adapter) ID() string { return a.id }
func (a *Adapter) Kind() Kind { return a.kind }

func (a *Adapter) Deliver(ctx context.Context, req Request) (Result, error) {
	if strings.TrimSpace(req.DeliveryKey) == "" { return Result{}, errors.New("delivery key is required") }
	if strings.TrimSpace(req.EventID) == "" { return Result{}, errors.New("event id is required") }
	if strings.TrimSpace(req.Destination) == "" { return Result{}, errors.New("destination is required") }
	if req.Severity < delivery.SeverityInfo || req.Severity > delivery.SeverityCritical { return Result{}, errors.New("invalid severity") }
	if req.Attempt < 0 { return Result{}, errors.New("invalid delivery attempt") }

	externalID, err := a.sender.Send(ctx, req.Destination, append([]byte(nil), req.Payload...))
	if err != nil { return Result{}, err }
	return Result{
		ProviderID: a.id,
		ExternalID: strings.TrimSpace(externalID),
		DeliveredAt: time.Now().UTC(),
		Authoritative: false,
	}, nil
}

type Registry struct {
	providers map[string]Provider
}

func NewRegistry(items ...Provider) (*Registry, error) {
	r := &Registry{providers: map[string]Provider{}}
	for _, p := range items {
		if p == nil { return nil, errors.New("nil provider") }
		id := strings.TrimSpace(strings.ToLower(p.ID()))
		if id == "" { return nil, errors.New("provider id is required") }
		if _, exists := r.providers[id]; exists { return nil, errors.New("duplicate provider id") }
		r.providers[id] = p
	}
	return r, nil
}

func (r *Registry) Get(id string) (Provider, bool) {
	p, ok := r.providers[strings.TrimSpace(strings.ToLower(id))]
	return p, ok
}

func InAppAdapter(sender Sender) (*Adapter, error) { return NewAdapter("genesis-in-app", KindInApp, sender) }
func WebAdapter(sender Sender) (*Adapter, error)   { return NewAdapter("genesis-web", KindWeb, sender) }
func PushAdapter(sender Sender) (*Adapter, error)  { return NewAdapter("genesis-push", KindPush, sender) }
