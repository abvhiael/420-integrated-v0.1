package trust

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

var (
	ErrMalformedData   = errors.New("420Trust malformed RPC data")
	ErrInactiveMetric  = errors.New("420Trust metric inactive")
	ErrUnmappedSubject = errors.New("420Trust subject type is not mapped")
)

type Config struct {
	Aggregator       string
	ReadMetricSelector [4]byte
	SubjectTypes     map[string][32]byte
}

type Adapter struct {
	rpc              RPC
	aggregator       string
	selector         [4]byte
	subjectTypes     map[string][32]byte
}

func NewAdapter(rpc RPC, cfg Config) (*Adapter, error) {
	if rpc == nil {
		return nil, errors.New("420Trust RPC is required")
	}
	if !validAddress(cfg.Aggregator) {
		return nil, errors.New("420Trust aggregator address is invalid")
	}
	if cfg.ReadMetricSelector == ([4]byte{}) {
		return nil, errors.New("420Trust readMetric selector is required")
	}
	if len(cfg.SubjectTypes) == 0 {
		return nil, errors.New("420Trust subject type mappings are required")
	}
	mappings := make(map[string][32]byte, len(cfg.SubjectTypes))
	for kind, id := range cfg.SubjectTypes {
		kind = strings.ToUpper(strings.TrimSpace(kind))
		if kind == "" || id == ([32]byte{}) {
			return nil, errors.New("420Trust subject mapping is invalid")
		}
		mappings[kind] = id
	}
	return &Adapter{
		rpc: rpc,
		aggregator: strings.ToLower(cfg.Aggregator),
		selector: cfg.ReadMetricSelector,
		subjectTypes: mappings,
	}, nil
}

func (a *Adapter) ReadMetric(ctx context.Context, subject model.SubjectRef, metricID string) (model.TrustMetricRef, error) {
	subjectType, ok := a.subjectTypes[strings.ToUpper(strings.TrimSpace(subject.Type))]
	if !ok {
		return model.TrustMetricRef{}, ErrUnmappedSubject
	}
	subjectID, err := parseBytes32(subject.ID)
	if err != nil {
		return model.TrustMetricRef{}, fmt.Errorf("420Trust subject id: %w", err)
	}
	metric, err := parseBytes32(metricID)
	if err != nil {
		return model.TrustMetricRef{}, fmt.Errorf("420Trust metric id: %w", err)
	}

	data := make([]byte, 4, 4+96)
	copy(data, a.selector[:])
	data = append(data, subjectType[:]...)
	data = append(data, subjectID[:]...)
	data = append(data, metric[:]...)

	var encoded string
	params := []any{map[string]any{
		"to": a.aggregator,
		"data": "0x" + hex.EncodeToString(data),
	}, "latest"}
	if err := a.rpc.Call(ctx, "eth_call", params, &encoded); err != nil {
		return model.TrustMetricRef{}, err
	}

	out, err := decodeMetric(encoded, metricID)
	if err != nil {
		return model.TrustMetricRef{}, err
	}
	if !out.Active {
		return model.TrustMetricRef{}, ErrInactiveMetric
	}
	return out, nil
}

func decodeMetric(encoded, metricID string) (model.TrustMetricRef, error) {
	raw, err := decodeHex(encoded)
	if err != nil || len(raw) != 6*32 {
		return model.TrustMetricRef{}, ErrMalformedData
	}
	word := func(i int) []byte { return raw[i*32 : (i+1)*32] }

	revision, err := uintWord(word(2), 32)
	if err != nil {
		return model.TrustMetricRef{}, err
	}
	active, err := boolWord(word(3))
	if err != nil {
		return model.TrustMetricRef{}, err
	}
	total := signedWord(word(4))
	signals, err := uintWord(word(5), 64)
	if err != nil {
		return model.TrustMetricRef{}, err
	}

	out := model.TrustMetricRef{
		DomainID:       "0x" + hex.EncodeToString(word(0)),
		UnitID:         "0x" + hex.EncodeToString(word(1)),
		MetricID:       strings.ToLower(strings.TrimSpace(metricID)),
		MetricRevision: uint32(revision),
		Active:         active,
		Total:          total.String(),
		ActiveSignals:  signals,
	}
	if err := out.Validate(); err != nil {
		return model.TrustMetricRef{}, ErrMalformedData
	}
	return out, nil
}

func parseBytes32(v string) ([32]byte, error) {
	var out [32]byte
	v = strings.TrimSpace(v)
	if !strings.HasPrefix(v, "0x") || len(v) != 66 {
		return out, ErrMalformedData
	}
	raw, err := hex.DecodeString(v[2:])
	if err != nil || len(raw) != 32 {
		return out, ErrMalformedData
	}
	copy(out[:], raw)
	return out, nil
}

func decodeHex(v string) ([]byte, error) {
	if !strings.HasPrefix(v, "0x") || len(v)%2 != 0 {
		return nil, ErrMalformedData
	}
	raw, err := hex.DecodeString(v[2:])
	if err != nil {
		return nil, ErrMalformedData
	}
	return raw, nil
}

func uintWord(word []byte, bits int) (uint64, error) {
	if len(word) != 32 {
		return 0, ErrMalformedData
	}
	n := new(big.Int).SetBytes(word)
	if n.Sign() < 0 || n.BitLen() > bits {
		return 0, ErrMalformedData
	}
	return n.Uint64(), nil
}

func boolWord(word []byte) (bool, error) {
	n, err := uintWord(word, 1)
	if err != nil || n > 1 {
		return false, ErrMalformedData
	}
	return n == 1, nil
}

func signedWord(word []byte) *big.Int {
	n := new(big.Int).SetBytes(word)
	if len(word) == 32 && word[0]&0x80 != 0 {
		mod := new(big.Int).Lsh(big.NewInt(1), 256)
		n.Sub(n, mod)
	}
	return n
}

func validAddress(v string) bool {
	if len(v) != 42 || !strings.HasPrefix(v, "0x") {
		return false
	}
	_, err := hex.DecodeString(v[2:])
	return err == nil
}
