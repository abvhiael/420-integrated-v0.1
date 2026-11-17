package slashing

import (
	"errors"
	"fmt"
	"sync"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

var (
	ErrDoubleProposal    = errors.New("double proposal")
	ErrDoubleAttestation = errors.New("double attestation")
	ErrDoubleRecovery    = errors.New("double recovery signature")
	ErrSurroundVote      = errors.New("surround vote")
	ErrInvalidDuty       = errors.New("invalid protected signing duty")
)

type messageKey struct {
	ValidatorID uint64
	Type        string
	Slot        uint64
	Incident    ctypes.Root
}

type Protector struct {
	mu     sync.Mutex
	signed map[messageKey]ctypes.Root
	votes  []voteRecord
	disk   *durableHistory
	failed error
}

func NewProtector() *Protector {
	return &Protector{signed: make(map[messageKey]ctypes.Root)}
}

func (p *Protector) CheckAndRecordProposal(validatorID, slot uint64, root ctypes.Root) error {
	return p.check(messageKey{ValidatorID: validatorID, Type: "proposal", Slot: slot}, root, ErrDoubleProposal)
}

func (p *Protector) CheckAndRecordAttestation(validatorID, slot uint64, root ctypes.Root) error {
	return p.check(messageKey{ValidatorID: validatorID, Type: "attestation", Slot: slot}, root, ErrDoubleAttestation)
}

func (p *Protector) CheckAndRecordRecovery(validatorID uint64, incident, recoveryRoot ctypes.Root) error {
	return p.check(messageKey{ValidatorID: validatorID, Type: "recovery", Incident: incident}, recoveryRoot, ErrDoubleRecovery)
}

func (p *Protector) check(key messageKey, root ctypes.Root, conflict error) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.checkHistoryLocked(); err != nil {
		return err
	}
	if root == (ctypes.Root{}) {
		return ErrInvalidDuty
	}
	if key.Type == "recovery" && key.Incident == (ctypes.Root{}) {
		return ErrInvalidDuty
	}
	if p.disk != nil {
		if key.Type == "attestation" {
			return ErrInvalidDuty
		}
		if err := p.disk.checkIdentity(key.ValidatorID); err != nil {
			return err
		}
	}
	if old, ok := p.signed[key]; ok {
		if old != root {
			return fmt.Errorf("%w: validator=%d type=%s slot=%d", conflict, key.ValidatorID, key.Type, key.Slot)
		}
		return nil // idempotent same-root request
	}
	p.signed[key] = root
	return p.persistLocked()
}
