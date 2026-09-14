package decoder

import (
	"fmt"

	"github.com/420integrated/420-integrated/indexer/model"
)

// DecodedLog binds a decoded projection back to the exact registry service/version metadata
// and original canonical log provenance that produced it.
type DecodedLog struct {
	Service   ServiceVersion `json:"service"`
	Log       model.LogRecord `json:"log"`
	Decoder   string         `json:"decoderVersion"`
	Projection any           `json:"projection"`
}

// Dispatcher resolves the historical ProtocolRegistry service/version first, then selects
// the decoder registered for that exact service/version. It never falls forward to a newer decoder.
type Dispatcher struct {
	catalog  *Catalog
	registry *Registry
}

func NewDispatcher(catalog *Catalog, registry *Registry) *Dispatcher {
	return &Dispatcher{catalog: catalog, registry: registry}
}

func (d *Dispatcher) Decode(log model.LogRecord) (DecodedLog, error) {
	service, err := d.catalog.ResolveImplementationAt(log.Address, log.BlockNumber)
	if err != nil { return DecodedLog{}, err }
	decoder, err := d.registry.Resolve(service.ServiceID, fmt.Sprintf("%d", service.Version))
	if err != nil { return DecodedLog{}, err }
	projection, err := decoder.Decode(log.Address, log.Topics, log.Data)
	if err != nil { return DecodedLog{}, err }
	return DecodedLog{Service: service, Log: log, Decoder: decoder.Version(), Projection: projection}, nil
}
