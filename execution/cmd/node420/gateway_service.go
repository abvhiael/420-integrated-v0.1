package main

import (
	"errors"
	"flag"
	"net/http"
	"strings"
	"time"

	storage "github.com/420integrated/420-integrated/execution/storage"
)

var (
	gatewayEnabled       = flag.Bool("gateway", false, "enable 420Gateway HTTP service")
	gatewayListen        = flag.String("gateway.listen", "127.0.0.1:8422", "420Gateway HTTP listen address")
	gatewayCacheURL      = flag.String("gateway.cache-url", "", "optional upstream 420Cache base URL")
	gatewayCacheToken    = flag.String("gateway.cache-token", "", "optional bearer token for upstream 420Cache")
	gatewayStoreURL      = flag.String("gateway.store-url", "", "optional upstream 420Store base URL")
	gatewayStoreToken    = flag.String("gateway.store-token", "", "optional bearer token for upstream 420Store")
	gatewayTimeout       = flag.Duration("gateway.upstream-timeout", 10*time.Second, "420Gateway upstream request timeout")
	gatewayMaxConcurrent = flag.Uint("gateway.max-concurrent-requests", 128, "maximum concurrent 420Gateway requests")
	gatewayRateRequests  = flag.Uint("gateway.rate-limit-requests", 240, "maximum requests per client in each rate-limit window")
	gatewayRateWindow    = flag.Duration("gateway.rate-limit-window", time.Minute, "per-client 420Gateway rate-limit window")
	gatewayTLSCert       = flag.String("gateway.tls-cert", "", "TLS certificate file for 420Gateway HTTPS")
	gatewayTLSKey        = flag.String("gateway.tls-key", "", "TLS private key file for 420Gateway HTTPS")
	gatewayAllowedHosts  = flag.String("gateway.allowed-hosts", "", "comma-separated allowed Host values; required for non-loopback gateway exposure")
)

func newNodeGatewayService() (serviceRunner, error) {
	if strings.TrimSpace(*gatewayListen) == "" || *gatewayTimeout <= 0 || *gatewayRateWindow <= 0 {
		return nil, storage.ErrGatewayRoute
	}
	if *gatewayMaxConcurrent == 0 || *gatewayRateRequests == 0 || uint64(*gatewayMaxConcurrent) > uint64(^uint32(0)) || uint64(*gatewayRateRequests) > uint64(^uint32(0)) {
		return nil, storage.ErrGatewayRoute
	}
	client := &http.Client{Timeout: *gatewayTimeout}
	router := storage.GatewayRouter{}
	if strings.TrimSpace(*gatewayCacheURL) != "" {
		router.Cache = append(router.Cache, storage.HTTPGatewayCacheSource{
			BaseURL: *gatewayCacheURL,
			Client: client,
			Token: *gatewayCacheToken,
		})
	}
	if strings.TrimSpace(*gatewayStoreURL) != "" {
		router.Store = append(router.Store, storage.HTTPGatewayStoreSource{
			BaseURL: *gatewayStoreURL,
			Client: client,
			Token: *gatewayStoreToken,
		})
	}
	if len(router.Cache) == 0 && len(router.Store) == 0 {
		return nil, errors.New("gateway requires at least one cache or store upstream")
	}
	var hosts []string
	for _, host := range strings.Split(*gatewayAllowedHosts, ",") {
		if host = strings.TrimSpace(host); host != "" { hosts = append(hosts, host) }
	}
	return storage.NewGatewayHTTPServiceWithTransport(*gatewayListen, storage.GatewayHTTPHandler{Router: router}, storage.GatewayHTTPPolicy{
		MaxConcurrentRequests: uint32(*gatewayMaxConcurrent),
		RateLimitRequests: uint32(*gatewayRateRequests),
		RateLimitWindow: *gatewayRateWindow,
	}, storage.GatewayHTTPTransportPolicy{
		TLSCertFile: *gatewayTLSCert,
		TLSKeyFile: *gatewayTLSKey,
		AllowedHosts: hosts,
	})
}
