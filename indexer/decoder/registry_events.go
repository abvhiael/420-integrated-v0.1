package decoder

import "errors"

var ErrUnknownRegistryEvent = errors.New("unknown protocol registry event")

type RegistryEventKind string

const (
	RegistryEventVersionPublished RegistryEventKind = "SERVICE_VERSION_PUBLISHED"
	RegistryEventProfilePublished RegistryEventKind = "SERVICE_REGISTRATION_PROFILE_PUBLISHED"
	RegistryEventDeprecated       RegistryEventKind = "SERVICE_DEPRECATED"
)

// RegistryEvent is the normalized event surface produced by the ProtocolRegistry event decoder.
// Raw ABI/log decoding stays separate from catalogue state mutation so replay remains deterministic.
type RegistryEvent struct {
	Kind            RegistryEventKind
	ServiceID       string
	Version         uint32
	Implementation  string
	CodeHash        string
	MetadataHash    string
	Active          bool
	ComponentType   uint8
	ManifestHash    string
	DependencyRoot  string
	InterfaceHash   string
	BlockNumber     uint64
	BlockHash       string
}

func (c *Catalog) ApplyRegistryEvent(ev RegistryEvent) error {
	switch ev.Kind {
	case RegistryEventVersionPublished:
		return c.ApplyVersion(VersionPublished{
			ServiceID: ev.ServiceID, Version: ev.Version, Implementation: ev.Implementation,
			CodeHash: ev.CodeHash, MetadataHash: ev.MetadataHash, Active: ev.Active,
			BlockNumber: ev.BlockNumber, BlockHash: ev.BlockHash,
		})
	case RegistryEventProfilePublished:
		return c.ApplyProfile(ProfilePublished{
			ServiceID: ev.ServiceID, Version: ev.Version, ComponentType: ev.ComponentType,
			ManifestHash: ev.ManifestHash, DependencyRoot: ev.DependencyRoot, InterfaceHash: ev.InterfaceHash,
		})
	case RegistryEventDeprecated:
		return c.ApplyDeprecated(ev.ServiceID, ev.Version, ev.BlockNumber)
	default:
		return ErrUnknownRegistryEvent
	}
}
