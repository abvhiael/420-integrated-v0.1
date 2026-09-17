package subscriptions

import (
	"errors"
	"sort"
	"strings"
)

type Severity uint8

const (
	SeverityInfo Severity = iota + 1
	SeverityWarning
	SeverityCritical
)

type Channel string

const (
	ChannelInApp Channel = "in_app"
	ChannelWeb   Channel = "web"
	ChannelPush  Channel = "push"
)

type Filters struct {
	Sources []string
	Topics  []string
	Events  []string
}

type Subscription struct {
	ID                   string
	Filters              Filters
	MinimumSeverity      Severity
	Channels             []Channel
	Muted                bool
	Active               bool
	PromotionalConsent   bool
	OperationalConsent   bool
}

func (s Subscription) Validate() error {
	if strings.TrimSpace(s.ID) == "" {
		return errors.New("subscription id is required")
	}
	if !s.Active {
		return errors.New("subscription must be explicitly active")
	}
	if !validSeverity(s.MinimumSeverity) {
		return errors.New("invalid minimum severity")
	}
	if len(s.Channels) == 0 {
		return errors.New("at least one delivery channel is required")
	}
	seen := map[Channel]struct{}{}
	for _, ch := range s.Channels {
		if !validChannel(ch) {
			return errors.New("invalid delivery channel")
		}
		if _, ok := seen[ch]; ok {
			return errors.New("duplicate delivery channel")
		}
		seen[ch] = struct{}{}
	}
	if len(s.Filters.Sources) == 0 && len(s.Filters.Topics) == 0 && len(s.Filters.Events) == 0 {
		return errors.New("subscription requires at least one source, topic, or event filter")
	}
	return nil
}

func (s Subscription) AllowsPromotional() bool {
	return s.Active && !s.Muted && s.PromotionalConsent
}

func (s Subscription) AllowsOperational() bool {
	return s.Active && !s.Muted && s.OperationalConsent
}

func Normalize(s Subscription) Subscription {
	s.ID = strings.TrimSpace(s.ID)
	s.Filters.Sources = normalizeStrings(s.Filters.Sources)
	s.Filters.Topics = normalizeStrings(s.Filters.Topics)
	s.Filters.Events = normalizeStrings(s.Filters.Events)
	s.Channels = normalizeChannels(s.Channels)
	return s
}

func validSeverity(v Severity) bool {
	return v == SeverityInfo || v == SeverityWarning || v == SeverityCritical
}

func validChannel(v Channel) bool {
	switch v {
	case ChannelInApp, ChannelWeb, ChannelPush:
		return true
	default:
		return false
	}
}

func normalizeStrings(in []string) []string {
	set := map[string]struct{}{}
	for _, v := range in {
		v = strings.ToLower(strings.TrimSpace(v))
		if v != "" {
			set[v] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for v := range set {
		out = append(out, v)
	}
	sort.Strings(out)
	return out
}

func normalizeChannels(in []Channel) []Channel {
	set := map[Channel]struct{}{}
	for _, v := range in {
		set[v] = struct{}{}
	}
	out := make([]Channel, 0, len(set))
	for v := range set {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}
