package proxy

import (
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/evidence"
)

const Phase = "VERIFY-7"

// EIP-1967 implementation/admin/beacon slots.
const (
	ImplementationSlot  = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
	AdminSlot           = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
	BeaconSlot          = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
)

type Kind string

const (
	KindNone        Kind = "NONE"
	KindEIP1967     Kind = "EIP1967"
	KindMinimal1167 Kind = "EIP1167_MINIMAL"
)

type Relationship struct {
	ChainID              uint64 `json:"chainId"`
	ProxyAddress          string `json:"proxyAddress"`
	ProxyRuntimeCodeHash  string `json:"proxyRuntimeCodeHash"`
	Kind                  Kind   `json:"kind"`
	ImplementationAddress string `json:"implementationAddress,omitempty"`
	AdminAddress          string `json:"adminAddress,omitempty"`
	BeaconAddress         string `json:"beaconAddress,omitempty"`
	ObservedBlock         uint64 `json:"observedBlock"`
	ObservedBlockHash     string `json:"observedBlockHash"`
}

func (r Relationship) Validate() error {
	if r.ChainID == 0 || !validAddress(r.ProxyAddress) || !validHash(r.ProxyRuntimeCodeHash) { return errors.New("proxy binding is incomplete") }
	if r.Kind == KindNone { return nil }
	if r.Kind != KindEIP1967 && r.Kind != KindMinimal1167 { return errors.New("unsupported proxy kind") }
	if !validAddress(r.ImplementationAddress) { return errors.New("proxy implementation address is required") }
	if !validHash(r.ObservedBlockHash) { return errors.New("canonical observation block hash is required") }
	return nil
}

type StorageReader interface {
	StorageAt(address, slot, block string) (string, error)
}

func Detect(deployment evidence.DeploymentEvidence, reader StorageReader) (Relationship, error) {
	if err := deployment.Validate(); err != nil { return Relationship{}, err }
	r := Relationship{ChainID: deployment.ChainID, ProxyAddress: strings.ToLower(deployment.Address), ProxyRuntimeCodeHash: strings.ToLower(deployment.RuntimeCodeHash), Kind: KindNone, ObservedBlock: deployment.ObservedAt.Number, ObservedBlockHash: strings.ToLower(deployment.ObservedAt.Hash)}
	if impl, ok := minimal1167Implementation(deployment.RuntimeBytecode); ok {
		r.Kind = KindMinimal1167
		r.ImplementationAddress = impl
		return r, r.Validate()
	}
	if reader == nil { return r, nil }
	block := fmt.Sprintf("0x%x", deployment.ObservedAt.Number)
	implWord, err := reader.StorageAt(deployment.Address, ImplementationSlot, block)
	if err != nil { return Relationship{}, fmt.Errorf("read implementation slot: %w", err) }
	if impl := addressFromStorageWord(implWord); impl != "" {
		r.Kind = KindEIP1967
		r.ImplementationAddress = impl
		if adminWord, err := reader.StorageAt(deployment.Address, AdminSlot, block); err == nil { r.AdminAddress = addressFromStorageWord(adminWord) }
		if beaconWord, err := reader.StorageAt(deployment.Address, BeaconSlot, block); err == nil { r.BeaconAddress = addressFromStorageWord(beaconWord) }
		return r, r.Validate()
	}
	return r, nil
}

func minimal1167Implementation(bytecode string) (string, bool) {
	h := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(bytecode)), "0x")
	const prefix = "363d3d373d3d3d363d73"
	const suffix = "5af43d82803e903d91602b57fd5bf3"
	if len(h) != len(prefix)+40+len(suffix) || !strings.HasPrefix(h, prefix) || !strings.HasSuffix(h, suffix) { return "", false }
	return "0x" + h[len(prefix):len(prefix)+40], true
}

func addressFromStorageWord(word string) string {
	h := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(word)), "0x")
	if len(h) != 64 { return "" }
	addr := "0x" + h[24:]
	if addr == "0x0000000000000000000000000000000000000000" || !validAddress(addr) { return "" }
	return addr
}

// VerificationPair intentionally keeps proxy-shell and implementation status independent.
type VerificationPair struct {
	ProxyBinding          string                   `json:"proxyBinding"`
	ProxyClass            architecture.ResultClass `json:"proxyClass"`
	ImplementationAddress string                   `json:"implementationAddress,omitempty"`
	ImplementationBinding string                   `json:"implementationBinding,omitempty"`
	ImplementationClass   architecture.ResultClass `json:"implementationClass,omitempty"`
	ImplementationCurrent bool                     `json:"implementationCurrent"`
	Generation            uint64                   `json:"generation"`
}

type UpgradeEvent struct {
	Generation         uint64 `json:"generation"`
	FromImplementation string `json:"fromImplementation,omitempty"`
	ToImplementation   string `json:"toImplementation,omitempty"`
	ObservedBlock      uint64 `json:"observedBlock"`
	ObservedBlockHash  string `json:"observedBlockHash"`
}

type Tracker struct {
	current map[string]Relationship
	history map[string][]UpgradeEvent
}

func NewTracker() *Tracker { return &Tracker{current: map[string]Relationship{}, history: map[string][]UpgradeEvent{}} }

func (t *Tracker) Observe(r Relationship) (changed bool, generation uint64, err error) {
	if err := r.Validate(); err != nil { return false, 0, err }
	key := fmt.Sprintf("%d:%s", r.ChainID, strings.ToLower(r.ProxyAddress))
	previous, exists := t.current[key]
	if !exists {
		t.current[key] = r
		if r.Kind != KindNone {
			t.history[key] = append(t.history[key], UpgradeEvent{Generation: 1, ToImplementation: r.ImplementationAddress, ObservedBlock: r.ObservedBlock, ObservedBlockHash: r.ObservedBlockHash})
			return true, 1, nil
		}
		return false, 0, nil
	}
	generation = uint64(len(t.history[key]))
	if previous.Kind == r.Kind && strings.EqualFold(previous.ImplementationAddress, r.ImplementationAddress) {
		t.current[key] = r
		return false, generation, nil
	}
	generation++
	t.history[key] = append(t.history[key], UpgradeEvent{Generation: generation, FromImplementation: previous.ImplementationAddress, ToImplementation: r.ImplementationAddress, ObservedBlock: r.ObservedBlock, ObservedBlockHash: r.ObservedBlockHash})
	t.current[key] = r
	return true, generation, nil
}

func (t *Tracker) History(chainID uint64, proxyAddress string) []UpgradeEvent {
	key := fmt.Sprintf("%d:%s", chainID, strings.ToLower(proxyAddress))
	return append([]UpgradeEvent(nil), t.history[key]...)
}

func ApplyRelationship(pair VerificationPair, relationship Relationship, changed bool, generation uint64) VerificationPair {
	pair.ImplementationAddress = relationship.ImplementationAddress
	pair.Generation = generation
	if changed {
		pair.ImplementationBinding = ""
		pair.ImplementationClass = ""
		pair.ImplementationCurrent = false
	}
	return pair
}

func BindImplementation(pair VerificationPair, relationship Relationship, implementation evidence.DeploymentEvidence, class architecture.ResultClass) (VerificationPair, error) {
	if relationship.Kind == KindNone { return pair, errors.New("address is not a proxy") }
	if !strings.EqualFold(relationship.ImplementationAddress, implementation.Address) { return pair, errors.New("implementation evidence does not match canonical proxy relationship") }
	pair.ImplementationAddress = strings.ToLower(implementation.Address)
	pair.ImplementationBinding = implementation.BindingKey()
	pair.ImplementationClass = class
	pair.ImplementationCurrent = true
	return pair, nil
}

func validAddress(v string) bool { return len(v) == 42 && strings.HasPrefix(v, "0x") }
func validHash(v string) bool { return len(v) == 66 && strings.HasPrefix(v, "0x") }
