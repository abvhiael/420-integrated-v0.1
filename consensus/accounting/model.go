// Package accounting is a read-only operational reconciliation observer. Its
// reports cannot authorize settlement, issuance, slashes or canonical selection.
package accounting

import (
	"context"
	"fmt"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/indexer/model"
	"math/big"
	"sort"
	"strings"
)

const Reward = "0x0000000000000000000000000000000000000420"
const Registry = "0x0000000000000000000000000000000000000423"
const ProtocolReserve = "0x0000000000000000000000000000000000000424"
const CreditReserve = "0x0000000000000000000000000000000000000425"
const ZeroAddress = "0x0000000000000000000000000000000000000000"

var Addresses = []string{Reward, Registry, ProtocolReserve, CreditReserve}

type State map[string]string
type Discrepancy struct {
	Code     string `json:"code"`
	Block    uint64 `json:"block"`
	Path     string `json:"path"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
}
type Issuance struct {
	GrossScheduled string `json:"grossScheduled"`
	Realized       string `json:"realized"`
	NonIssued      string `json:"nonIssued"`
	Security       string `json:"security"`
	Attention      string `json:"attention"`
	Development    string `json:"development"`
	Basis          string `json:"basis"`
}
type Report struct {
	Schema             string        `json:"schema"`
	ChainID            uint64        `json:"chainId"`
	Block              uint64        `json:"block"`
	BlockHash          string        `json:"blockHash"`
	ConsensusRoot      string        `json:"consensusRoot"`
	FinalizedRoot      string        `json:"finalizedRoot"`
	CanonicalAuthority bool          `json:"canonicalAuthority"`
	Status             string        `json:"status"`
	Issuance           Issuance      `json:"issuance"`
	State              State         `json:"expectedState"`
	Discrepancies      []Discrepancy `json:"discrepancies"`
}
type Source interface {
	Anchor(context.Context, sys.SequenceAnchor) error
	Logs(context.Context, rec.Record) ([]model.LogRecord, error)
	State(context.Context, sys.SequenceAnchor, []string, []string) (State, error)
}
type Index struct {
	ChainID         uint64
	Height          uint64
	Hash            string
	FinalizedHeight uint64
	FinalizedHash   string
	Logs            []model.LogRecord
	Blocks          map[uint64]string
}

func hex32(b [32]byte) string      { return fmt.Sprintf("0x%x", b) }
func address(a sys.Address) string { return fmt.Sprintf("0x%x", a) }
func money(v string) *big.Int {
	n, ok := new(big.Int).SetString(v, 10)
	if !ok || n.Sign() < 0 || n.BitLen() > 256 {
		panic("invalid accounting number: " + v)
	}
	return n
}
func sum(a, b string) string { return new(big.Int).Add(money(a), money(b)).String() }
func (s State) get(k string) string {
	if v, ok := s[k]; ok {
		return v
	}
	return "0"
}
func (s State) add(k, v string) { s[k] = sum(s.get(k), v) }
func (s State) sub(k, v string) error {
	n := new(big.Int).Sub(money(s.get(k)), money(v))
	if n.Sign() < 0 {
		return fmt.Errorf("accounting underflow %s", k)
	}
	s[k] = n.String()
	return nil
}
func vk(id, key string) string { return "validator/" + strings.ToLower(id) + "/" + key }
func ck(id, key string) string { return "credit/" + strings.ToLower(id) + "/" + key }
func accrued(a string) string  { return "accrued/" + strings.ToLower(a) }
func balance(a string) string  { return "balance/" + strings.ToLower(a) }
func sortedKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
func (r *Report) issue(code string, n uint64, path, want, got string) {
	r.Discrepancies = append(r.Discrepancies, Discrepancy{code, n, path, want, got})
}
