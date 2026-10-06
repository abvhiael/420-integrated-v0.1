package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

const (
	MaxTrustEntries        = 250
	MaxTrustValueBytes     = 256
)

type TrustKind string
type TrustDisposition string

const (
	TrustIdentity    TrustKind = "IDENTITY"
	TrustPhrase      TrustKind = "PHRASE"
	TrustApplication TrustKind = "APPLICATION"

	TrustBlock TrustDisposition = "BLOCK"
	TrustAllow TrustDisposition = "ALLOW"
	TrustMute  TrustDisposition = "MUTE"
)

var ErrTrustRejected = errors.New("mail: recipient policy rejected message")

type TrustEntry struct {
	ID          string           `json:"id"`
	Owner       string           `json:"owner"`
	Kind        TrustKind        `json:"kind"`
	Value       string           `json:"value"`
	Disposition TrustDisposition `json:"disposition"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

type TrustSettings struct {
	Owner          string    `json:"owner"`
	RequireTrusted bool      `json:"require_trusted"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type TrustDecision struct {
	Trusted bool
	Muted   bool
}

func (s *Service) ListTrustEntries(ctx context.Context, actor string) ([]TrustEntry, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return nil, ErrUnauthorized
	}
	var out []TrustEntry
	err := s.Store.View(ctx, func(data *storeData) error {
		for _, entry := range data.TrustEntries {
			if entry.Owner == actor {
				out = append(out, entry)
			}
		}
		return nil
	})
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind < out[j].Kind
		}
		if out[i].Value != out[j].Value {
			return out[i].Value < out[j].Value
		}
		return out[i].ID < out[j].ID
	})
	return out, err
}

func (s *Service) PutTrustEntry(ctx context.Context, actor string, kind TrustKind, value string, disposition TrustDisposition) (TrustEntry, error) {
	actor = strings.TrimSpace(actor)
	value = normalizeTrustValue(kind, value)
	if actor == "" {
		return TrustEntry{}, ErrUnauthorized
	}
	if !validTrustKind(kind) || !validTrustDisposition(disposition) || value == "" || len([]byte(value)) > MaxTrustValueBytes {
		return TrustEntry{}, ErrInvalidInput
	}
	var out TrustEntry
	err := s.Store.Update(ctx, func(data *storeData) error {
		key := trustEntryKey(actor, kind, value)
		current, exists := data.TrustEntries[key]
		if !exists && countTrustEntries(data, actor) >= MaxTrustEntries {
			return ErrInvalidInput
		}
		now := s.Now().UTC()
		if exists {
			current.Disposition = disposition
			current.UpdatedAt = now
			data.TrustEntries[key] = current
			out = current
			return nil
		}
		out = TrustEntry{
			ID: deterministicTrustEntryID(actor, kind, value), Owner: actor, Kind: kind, Value: value,
			Disposition: disposition, CreatedAt: now, UpdatedAt: now,
		}
		data.TrustEntries[key] = out
		return nil
	})
	return out, err
}

func (s *Service) DeleteTrustEntry(ctx context.Context, actor, id string) error {
	actor = strings.TrimSpace(actor)
	id = strings.TrimSpace(id)
	if actor == "" {
		return ErrUnauthorized
	}
	return s.Store.Update(ctx, func(data *storeData) error {
		for key, entry := range data.TrustEntries {
			if entry.Owner == actor && entry.ID == id {
				delete(data.TrustEntries, key)
				return nil
			}
		}
		return ErrNotFound
	})
}

func (s *Service) GetTrustSettings(ctx context.Context, actor string) (TrustSettings, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return TrustSettings{}, ErrUnauthorized
	}
	out := TrustSettings{Owner: actor}
	err := s.Store.View(ctx, func(data *storeData) error {
		if settings, ok := data.TrustSettings[actor]; ok {
			out = settings
		}
		return nil
	})
	return out, err
}

func (s *Service) UpdateTrustSettings(ctx context.Context, actor string, requireTrusted bool) (TrustSettings, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return TrustSettings{}, ErrUnauthorized
	}
	out := TrustSettings{Owner: actor, RequireTrusted: requireTrusted, UpdatedAt: s.Now().UTC()}
	err := s.Store.Update(ctx, func(data *storeData) error {
		data.TrustSettings[actor] = out
		return nil
	})
	return out, err
}

func evaluateTrustPolicy(data *storeData, owner string, msg Message, body string) (TrustDecision, error) {
	settings := data.TrustSettings[owner]
	identityDisposition := trustDispositionFor(data, owner, TrustIdentity, msg.Sender)
	applicationDisposition := trustDispositionFor(data, owner, TrustApplication, msg.Source)
	phraseDispositions := phraseTrustDispositions(data, owner, msg.Subject+"\n"+body)

	if identityDisposition == TrustBlock || applicationDisposition == TrustBlock {
		return TrustDecision{}, ErrTrustRejected
	}

	trusted := identityDisposition == TrustAllow || applicationDisposition == TrustAllow
	muted := identityDisposition == TrustMute || applicationDisposition == TrustMute

	if !trusted {
		for _, disposition := range phraseDispositions {
			if disposition == TrustBlock {
				return TrustDecision{}, ErrTrustRejected
			}
		}
	}
	for _, disposition := range phraseDispositions {
		if disposition == TrustAllow {
			trusted = true
		}
		if disposition == TrustMute {
			muted = true
		}
	}
	if settings.RequireTrusted && !trusted {
		return TrustDecision{}, ErrTrustRejected
	}
	return TrustDecision{Trusted: trusted, Muted: muted}, nil
}

func trustDispositionFor(data *storeData, owner string, kind TrustKind, value string) TrustDisposition {
	value = normalizeTrustValue(kind, value)
	if value == "" {
		return ""
	}
	if entry, ok := data.TrustEntries[trustEntryKey(owner, kind, value)]; ok {
		return entry.Disposition
	}
	return ""
}

func phraseTrustDispositions(data *storeData, owner, content string) []TrustDisposition {
	content = strings.ToLower(content)
	out := make([]TrustDisposition, 0)
	for _, entry := range data.TrustEntries {
		if entry.Owner != owner || entry.Kind != TrustPhrase || entry.Value == "" {
			continue
		}
		if strings.Contains(content, strings.ToLower(entry.Value)) {
			out = append(out, entry.Disposition)
		}
	}
	return out
}

func normalizeTrustValue(kind TrustKind, value string) string {
	value = strings.TrimSpace(value)
	switch kind {
	case TrustIdentity, TrustApplication:
		return strings.ToLower(value)
	case TrustPhrase:
		return strings.Join(strings.Fields(value), " ")
	default:
		return value
	}
}

func validTrustKind(kind TrustKind) bool {
	return kind == TrustIdentity || kind == TrustPhrase || kind == TrustApplication
}

func validTrustDisposition(disposition TrustDisposition) bool {
	return disposition == TrustBlock || disposition == TrustAllow || disposition == TrustMute
}

func countTrustEntries(data *storeData, owner string) int {
	n := 0
	for _, entry := range data.TrustEntries {
		if entry.Owner == owner {
			n++
		}
	}
	return n
}

func trustEntryKey(owner string, kind TrustKind, value string) string {
	return owner + "\x00" + string(kind) + "\x00" + normalizeTrustValue(kind, value)
}

func deterministicTrustEntryID(owner string, kind TrustKind, value string) string {
	sum := sha256.Sum256([]byte("420/MAIL/TRUST/V1\x00" + owner + "\x00" + string(kind) + "\x00" + normalizeTrustValue(kind, value)))
	return "trust_" + hex.EncodeToString(sum[:8])
}

func validateTrustData(data *storeData) error {
	for key, entry := range data.TrustEntries {
		if key != trustEntryKey(entry.Owner, entry.Kind, entry.Value) || entry.Owner == "" || entry.ID == "" || entry.Value == "" || !validTrustKind(entry.Kind) || !validTrustDisposition(entry.Disposition) {
			return ErrInvalidInput
		}
	}
	for owner, settings := range data.TrustSettings {
		if owner == "" || settings.Owner != owner {
			return ErrInvalidInput
		}
	}
	return nil
}
