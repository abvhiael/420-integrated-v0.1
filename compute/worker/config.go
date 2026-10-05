package worker

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	ErrInvalidConfig = errors.New("invalid compute worker configuration")
)

type Identity struct {
	ChainID    uint64
	ProviderID string
	NodeID     string
	ResourceID string
	WorkerID   string
}

type Config struct {
	Identity        Identity
	StateDir        string
	HeartbeatPeriod time.Duration
	ShutdownTimeout time.Duration
}

func DefaultConfig() Config {
	return Config{
		StateDir:        "./data/node420-compute",
		HeartbeatPeriod: 5 * time.Second,
		ShutdownTimeout: 10 * time.Second,
	}
}

func (c Config) Validate() error {
	if c.Identity.ChainID == 0 {
		return fmt.Errorf("%w: chain id must be non-zero", ErrInvalidConfig)
	}
	for name, value := range map[string]string{
		"provider id": c.Identity.ProviderID,
		"node id":     c.Identity.NodeID,
		"resource id": c.Identity.ResourceID,
		"worker id":   c.Identity.WorkerID,
	} {
		if err := validateBytes32(name, value); err != nil {
			return err
		}
	}
	if strings.TrimSpace(c.StateDir) == "" {
		return fmt.Errorf("%w: state directory is required", ErrInvalidConfig)
	}
	if c.HeartbeatPeriod <= 0 {
		return fmt.Errorf("%w: heartbeat period must be positive", ErrInvalidConfig)
	}
	if c.ShutdownTimeout <= 0 {
		return fmt.Errorf("%w: shutdown timeout must be positive", ErrInvalidConfig)
	}
	return nil
}

func (c Config) PrepareStateDir() (string, error) {
	if err := c.Validate(); err != nil {
		return "", err
	}
	dir, err := filepath.Abs(filepath.Clean(c.StateDir))
	if err != nil {
		return "", fmt.Errorf("%w: state directory: %v", ErrInvalidConfig, err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("prepare worker state directory: %w", err)
	}
	return dir, nil
}

func validateBytes32(name, value string) error {
	if len(value) != 66 || !strings.HasPrefix(value, "0x") {
		return fmt.Errorf("%w: %s must be a 0x-prefixed bytes32 value", ErrInvalidConfig, name)
	}
	for _, r := range value[2:] {
		switch {
		case r >= '0' && r <= '9':
		case r >= 'a' && r <= 'f':
		case r >= 'A' && r <= 'F':
		default:
			return fmt.Errorf("%w: %s contains non-hexadecimal data", ErrInvalidConfig, name)
		}
	}
	return nil
}
