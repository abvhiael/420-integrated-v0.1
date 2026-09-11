package service

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/indexer/decoder"
)

type registryIndexerReader interface {
	Services(context.Context) ([]decoder.ServiceSummary, error)
	Service(context.Context, string) (decoder.ServiceSummary, error)
}

type RegistryView struct {
	Services []decoder.ServiceSummary `json:"services"`
	Count    int                      `json:"count"`
}

type ServiceRegistryView struct {
	ServiceID      string                   `json:"serviceId"`
	LatestVersion  uint32                   `json:"latestVersion"`
	ActiveVersion  uint32                   `json:"activeVersion,omitempty"`
	Implementation string                   `json:"implementation,omitempty"`
	Versions       []decoder.ServiceVersion `json:"versions"`
	VersionCount   int                      `json:"versionCount"`
}

func (s *Service) Registry(ctx context.Context) (RegistryView, error) {
	reader, ok := s.indexer.(registryIndexerReader)
	if !ok { return RegistryView{}, errors.New("420Indexer registry query capability unavailable") }
	services, err := reader.Services(ctx)
	if err != nil { return RegistryView{}, err }
	for _, service := range services {
		if strings.TrimSpace(service.ServiceID) == "" || service.LatestVersion == 0 {
			return RegistryView{}, errors.New("420Indexer returned invalid registry service summary")
		}
	}
	return RegistryView{Services: services, Count: len(services)}, nil
}

func (s *Service) RegistryService(ctx context.Context, serviceID string) (ServiceRegistryView, error) {
	id := strings.TrimSpace(serviceID)
	if id == "" { return ServiceRegistryView{}, errors.New("service id required") }
	reader, ok := s.indexer.(registryIndexerReader)
	if !ok { return ServiceRegistryView{}, errors.New("420Indexer registry query capability unavailable") }
	record, err := reader.Service(ctx, id)
	if err != nil { return ServiceRegistryView{}, err }
	if !strings.EqualFold(record.ServiceID, id) || record.LatestVersion == 0 || len(record.Versions) == 0 {
		return ServiceRegistryView{}, errors.New("420Indexer returned inconsistent registry service history")
	}
	var previous uint32
	for _, version := range record.Versions {
		if !strings.EqualFold(version.ServiceID, record.ServiceID) || version.Version <= previous || version.ActivatedHash == "" {
			return ServiceRegistryView{}, errors.New("420Indexer returned invalid registry version provenance")
		}
		previous = version.Version
	}
	if previous != record.LatestVersion { return ServiceRegistryView{}, errors.New("420Indexer latest registry version does not match history") }
	return ServiceRegistryView{ServiceID: record.ServiceID, LatestVersion: record.LatestVersion, ActiveVersion: record.ActiveVersion, Implementation: record.Implementation, Versions: record.Versions, VersionCount: len(record.Versions)}, nil
}
