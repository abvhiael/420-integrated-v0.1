package media420

import (
	"context"
	"errors"
	"strings"
	"time"

	mediaapi "github.com/420integrated/420-integrated/media/api"
)

type ServiceEndpoint struct {
	ServiceID string
	BaseURL   string
	ChainID   uint64
	Network   string
}

type ServiceDiscovery interface {
	Resolve(context.Context, string) (ServiceEndpoint, error)
}

func Discover(
	ctx context.Context,
	discovery ServiceDiscovery,
	httpTimeout time.Duration,
) (*Client, error) {
	if discovery == nil {
		return nil, invalid("service discovery is required")
	}
	endpoint, err := discovery.Resolve(ctx, mediaapi.ServiceID)
	if err != nil {
		return nil, &Error{Kind: ErrorUnavailable, Detail: "resolve Media service", Err: err}
	}
	if endpoint.ServiceID != mediaapi.ServiceID || strings.TrimSpace(endpoint.BaseURL) == "" ||
		endpoint.ChainID == 0 || strings.TrimSpace(endpoint.Network) == "" {
		return nil, errors.New("420Media SDK: invalid discovered service endpoint")
	}
	return New(Config{
		BaseURL: endpoint.BaseURL, Timeout: httpTimeout,
		ExpectedChainID: endpoint.ChainID, ExpectedNetwork: endpoint.Network,
	})
}
