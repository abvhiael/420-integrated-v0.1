package decoder

import (
	"errors"
	"sync"
)

var ErrDecoderNotFound = errors.New("decoder not found")

// Decoder turns public canonical-source records into rebuildable protocol projections.
type Decoder interface {
	Version() string
	Decode(address string, topics []string, data string) (any, error)
}

// Registry stores decoder implementations keyed by protocol service/version identity.
// The authoritative active/historical service version remains 420Registry / ProtocolRegistry.
type Registry struct {
	mu       sync.RWMutex
	decoders map[string]Decoder
}

func NewRegistry() *Registry { return &Registry{decoders: make(map[string]Decoder)} }

func key(serviceID, version string) string { return serviceID + "@" + version }

func (r *Registry) Register(serviceID, version string, d Decoder) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.decoders[key(serviceID, version)] = d
}

func (r *Registry) Resolve(serviceID, version string) (Decoder, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	d, ok := r.decoders[key(serviceID, version)]
	if !ok { return nil, ErrDecoderNotFound }
	return d, nil
}
