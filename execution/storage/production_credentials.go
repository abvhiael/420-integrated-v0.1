package storage

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrProductionCredential = errors.New("production credential failure")

type ProductionCredentialState string

const (
	ProductionCredentialActive  ProductionCredentialState = "active"
	ProductionCredentialOverlap ProductionCredentialState = "overlap"
	ProductionCredentialRevoked ProductionCredentialState = "revoked"
)

type ProductionCredentialSnapshot struct {
	ServiceID  string                    `json:"service_id"`
	Generation uint64                    `json:"generation"`
	State      ProductionCredentialState `json:"state"`
	ValidUntil time.Time                 `json:"valid_until,omitempty"`
	Fingerprint string                   `json:"fingerprint"`
}

type productionCredentialRecord struct {
	serviceID   string
	generation  uint64
	state       ProductionCredentialState
	validUntil  time.Time
	digest      [sha256.Size]byte
}

type ProductionCredentialManager struct {
	mu      sync.RWMutex
	records map[string][]productionCredentialRecord
}

func NewProductionCredentialManager() *ProductionCredentialManager {
	return &ProductionCredentialManager{records: make(map[string][]productionCredentialRecord)}
}

func (m *ProductionCredentialManager) Register(serviceID, secret string) error {
	if m == nil {
		return ErrProductionCredential
	}
	serviceID = strings.TrimSpace(serviceID)
	secret = strings.TrimSpace(secret)
	if serviceID == "" || secret == "" {
		return ErrProductionCredential
	}
	key := strings.ToLower(serviceID)
	digest := sha256.Sum256([]byte(secret))
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.records[key]) != 0 {
		return ErrProductionCredential
	}
	m.records[key] = []productionCredentialRecord{{serviceID: serviceID, generation: 1, state: ProductionCredentialActive, digest: digest}}
	return nil
}

// Rotate replaces the active credential and optionally permits the immediately
// preceding credential during a bounded overlap. Credential material is never
// exposed through snapshots or persisted into canonical storage state.
func (m *ProductionCredentialManager) Rotate(serviceID, currentSecret, nextSecret string, now time.Time, overlap time.Duration) error {
	if m == nil || overlap < 0 {
		return ErrProductionCredential
	}
	serviceID = strings.TrimSpace(serviceID)
	currentSecret = strings.TrimSpace(currentSecret)
	nextSecret = strings.TrimSpace(nextSecret)
	if serviceID == "" || currentSecret == "" || nextSecret == "" || currentSecret == nextSecret {
		return ErrProductionCredential
	}
	if now.IsZero() {
		return ErrProductionCredential
	}
	key := strings.ToLower(serviceID)
	currentDigest := sha256.Sum256([]byte(currentSecret))
	nextDigest := sha256.Sum256([]byte(nextSecret))
	m.mu.Lock()
	defer m.mu.Unlock()
	records := m.records[key]
	if len(records) == 0 {
		return ErrProductionCredential
	}
	active := -1
	for i := range records {
		if records[i].state == ProductionCredentialActive {
			active = i
			break
		}
	}
	if active < 0 || subtle.ConstantTimeCompare(records[active].digest[:], currentDigest[:]) != 1 {
		return ErrProductionCredential
	}
	if overlap == 0 {
		records[active].state = ProductionCredentialRevoked
		records[active].validUntil = time.Time{}
	} else {
		records[active].state = ProductionCredentialOverlap
		records[active].validUntil = now.UTC().Add(overlap)
	}
	records = append(records, productionCredentialRecord{
		serviceID: serviceID,
		generation: records[active].generation + 1,
		state: ProductionCredentialActive,
		digest: nextDigest,
	})
	m.records[key] = records
	return nil
}

// Revoke invalidates all credentials for one service immediately. This is the
// compromise/loss recovery path; a replacement must be explicitly registered.
func (m *ProductionCredentialManager) Revoke(serviceID string) error {
	if m == nil {
		return ErrProductionCredential
	}
	key := strings.ToLower(strings.TrimSpace(serviceID))
	if key == "" {
		return ErrProductionCredential
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	records := m.records[key]
	if len(records) == 0 {
		return ErrProductionCredential
	}
	for i := range records {
		records[i].state = ProductionCredentialRevoked
		records[i].validUntil = time.Time{}
	}
	m.records[key] = records
	return nil
}

func (m *ProductionCredentialManager) Recover(serviceID, replacementSecret string) error {
	if m == nil {
		return ErrProductionCredential
	}
	serviceID = strings.TrimSpace(serviceID)
	replacementSecret = strings.TrimSpace(replacementSecret)
	if serviceID == "" || replacementSecret == "" {
		return ErrProductionCredential
	}
	key := strings.ToLower(serviceID)
	digest := sha256.Sum256([]byte(replacementSecret))
	m.mu.Lock()
	defer m.mu.Unlock()
	records := m.records[key]
	if len(records) == 0 {
		return ErrProductionCredential
	}
	for _, record := range records {
		if record.state != ProductionCredentialRevoked {
			return ErrProductionCredential
		}
	}
	generation := records[len(records)-1].generation + 1
	m.records[key] = append(records, productionCredentialRecord{serviceID: serviceID, generation: generation, state: ProductionCredentialActive, digest: digest})
	return nil
}

func (m *ProductionCredentialManager) Validate(serviceID, secret string, now time.Time) bool {
	if m == nil || now.IsZero() {
		return false
	}
	key := strings.ToLower(strings.TrimSpace(serviceID))
	secret = strings.TrimSpace(secret)
	if key == "" || secret == "" {
		return false
	}
	digest := sha256.Sum256([]byte(secret))
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, record := range m.records[key] {
		switch record.state {
		case ProductionCredentialActive:
			if subtle.ConstantTimeCompare(record.digest[:], digest[:]) == 1 {
				return true
			}
		case ProductionCredentialOverlap:
			if !record.validUntil.IsZero() && now.UTC().Before(record.validUntil) && subtle.ConstantTimeCompare(record.digest[:], digest[:]) == 1 {
				return true
			}
		}
	}
	return false
}

func (m *ProductionCredentialManager) Snapshot() []ProductionCredentialSnapshot {
	if m == nil {
		return nil
	}
	m.mu.RLock()
	out := make([]ProductionCredentialSnapshot, 0)
	for _, records := range m.records {
		for _, record := range records {
			out = append(out, ProductionCredentialSnapshot{
				ServiceID: record.serviceID,
				Generation: record.generation,
				State: record.state,
				ValidUntil: record.validUntil,
				Fingerprint: hex.EncodeToString(record.digest[:8]),
			})
		}
	}
	m.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		if !strings.EqualFold(out[i].ServiceID, out[j].ServiceID) {
			return strings.ToLower(out[i].ServiceID) < strings.ToLower(out[j].ServiceID)
		}
		return out[i].Generation < out[j].Generation
	})
	return out
}
