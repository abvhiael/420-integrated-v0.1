package indexerclient

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
)

type ServiceVersion struct {
	ServiceID       string `json:"serviceId"`
	Version         uint32 `json:"version"`
	Implementation  string `json:"implementation"`
	CodeHash        string `json:"codeHash"`
	MetadataHash    string `json:"metadataHash"`
	ComponentType   uint8  `json:"componentType"`
	ManifestHash    string `json:"manifestHash"`
	DependencyRoot  string `json:"dependencyRoot"`
	InterfaceHash   string `json:"interfaceHash"`
	ActivatedBlock  uint64 `json:"activatedBlock"`
	ActivatedHash   string `json:"activatedHash"`
	DeprecatedBlock uint64 `json:"deprecatedBlock,omitempty"`
	Active          bool   `json:"active"`
}

type ServiceSummary struct {
	ServiceID      string           `json:"serviceId"`
	LatestVersion  uint32           `json:"latestVersion"`
	ActiveVersion  uint32           `json:"activeVersion,omitempty"`
	Implementation string           `json:"implementation,omitempty"`
	Versions       []ServiceVersion `json:"versions"`
}

func (c *Client) Services(ctx context.Context) ([]ServiceSummary, error) {
	var out []ServiceSummary
	if err := c.getData(ctx, "/v1/services?chainId="+strconv.FormatUint(c.requiredChainID, 10), &out); err != nil { return nil, err }
	return out, nil
}

func (c *Client) Service(ctx context.Context, serviceID string) (ServiceSummary, error) {
	serviceID = strings.TrimSpace(serviceID)
	if serviceID == "" { return ServiceSummary{}, errors.New("service id required") }
	var out ServiceSummary
	path := "/v1/services/" + url.PathEscape(serviceID) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	if err := c.getData(ctx, path, &out); err != nil { return ServiceSummary{}, err }
	if !strings.EqualFold(out.ServiceID, serviceID) { return ServiceSummary{}, errors.New("registry service id mismatch") }
	return out, nil
}

func (c *Client) ServiceVersion(ctx context.Context, serviceID string, version uint32) (ServiceVersion, error) {
	serviceID = strings.TrimSpace(serviceID)
	if serviceID == "" || version == 0 { return ServiceVersion{}, errors.New("service id and non-zero version required") }
	var out ServiceVersion
	path := "/v1/services/" + url.PathEscape(serviceID) + "/versions/" + strconv.FormatUint(uint64(version), 10) + "?chainId=" + strconv.FormatUint(c.requiredChainID, 10)
	if err := c.getData(ctx, path, &out); err != nil { return ServiceVersion{}, err }
	if !strings.EqualFold(out.ServiceID, serviceID) || out.Version != version { return ServiceVersion{}, errors.New("registry service version mismatch") }
	return out, nil
}
