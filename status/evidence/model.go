package evidence

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/status/components"
)

type Reference struct {
	Kind  string
	Value string
}

type Observation struct {
	ComponentID string
	SourceID    string
	Network     string
	Environment string
	State       components.HealthState
	Live        bool
	Ready       bool
	Summary     string
	ObservedAt  time.Time
	ExpiresAt   time.Time
	References  []Reference
	Canonical   bool
}

func (o Observation) Validate(now time.Time) error {
	if strings.TrimSpace(o.ComponentID) == "" || strings.TrimSpace(o.SourceID) == "" {
		return errors.New("observation requires component and source identity")
	}
	if strings.TrimSpace(o.Network) == "" || strings.TrimSpace(o.Environment) == "" {
		return errors.New("observation requires network and environment")
	}
	if !components.ValidHealthState(o.State) {
		return fmt.Errorf("invalid health state %q", o.State)
	}
	if o.ObservedAt.IsZero() || o.ExpiresAt.IsZero() {
		return errors.New("observation requires observed-at and expiry timestamps")
	}
	if !o.ExpiresAt.After(o.ObservedAt) {
		return errors.New("observation expiry must be after observation time")
	}
	if o.ObservedAt.After(now.Add(30 * time.Second)) {
		return errors.New("future-dated observation rejected")
	}
	if o.Canonical {
		return errors.New("status observations cannot claim canonical authority")
	}
	for _, ref := range o.References {
		if strings.TrimSpace(ref.Kind) == "" || strings.TrimSpace(ref.Value) == "" {
			return errors.New("canonical/protocol references require kind and value")
		}
	}
	return nil
}

func (o Observation) Fresh(now time.Time) bool {
	return !o.ExpiresAt.IsZero() && now.Before(o.ExpiresAt)
}
