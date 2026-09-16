package runtime

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

type Config struct {
	ChainID       uint64
	RPCURL        string
	CompilerCache string
	EvidenceStore string
	ListenAddr    string
}

func (c Config) Validate() error {
	if c.ChainID == 0 {
		return errors.New("chain id must be non-zero")
	}
	if err := requireURL("rpc url", c.RPCURL); err != nil {
		return err
	}
	if strings.TrimSpace(c.CompilerCache) == "" {
		return errors.New("compiler cache path is required")
	}
	if strings.TrimSpace(c.EvidenceStore) == "" {
		return errors.New("evidence store path is required")
	}
	if strings.TrimSpace(c.ListenAddr) == "" {
		return errors.New("listen address is required")
	}
	return nil
}

func requireURL(name, raw string) error {
	if strings.TrimSpace(raw) == "" {
		return fmt.Errorf("%s is required", name)
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("%s must be an absolute URL", name)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%s must use http or https", name)
	}
	return nil
}
