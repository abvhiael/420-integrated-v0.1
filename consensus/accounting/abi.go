package accounting

import (
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	ethhash "github.com/420integrated/420-integrated/execution/storage"
	"github.com/420integrated/420-integrated/indexer/model"
	"math/big"
	"strconv"
	"strings"
)

//go:embed events.json
var eventABI []byte

type field struct {
	Name    string
	Type    string
	Indexed bool
}
type definition struct {
	Address string
	Name    string
	Inputs  []field
}
type Event struct {
	Name   string
	Fields map[string]string
	Log    model.LogRecord
}

func definitions() []definition {
	var defs []definition
	if err := json.Unmarshal(eventABI, &defs); err != nil {
		panic(err)
	}
	return defs
}
func signature(d definition) string {
	types := make([]string, len(d.Inputs))
	for i, f := range d.Inputs {
		types[i] = f.Type
	}
	return d.Name + "(" + strings.Join(types, ",") + ")"
}
func words(raw string) ([][]byte, error) {
	if !strings.HasPrefix(raw, "0x") || len(raw)%64 != 2 {
		return nil, fmt.Errorf("malformed ABI words")
	}
	b, err := hex.DecodeString(raw[2:])
	if err != nil {
		return nil, err
	}
	out := make([][]byte, len(b)/32)
	for i := range out {
		out[i] = b[i*32 : (i+1)*32]
	}
	return out, nil
}
func wordValue(kind string, b []byte) (string, error) {
	if len(b) != 32 {
		return "", fmt.Errorf("invalid ABI word")
	}
	n := new(big.Int).SetBytes(b)
	switch {
	case kind == "bytes32":
		return "0x" + hex.EncodeToString(b), nil
	case kind == "address":
		if n.BitLen() > 160 {
			return "", fmt.Errorf("invalid address padding")
		}
		return "0x" + hex.EncodeToString(b[12:]), nil
	case strings.HasPrefix(kind, "uint"):
		width, err := strconv.Atoi(strings.TrimPrefix(kind, "uint"))
		if err != nil || n.BitLen() > width {
			return "", fmt.Errorf("ABI integer overflow")
		}
		return n.String(), nil
	case kind == "bool":
		if n.Cmp(big.NewInt(1)) > 0 {
			return "", fmt.Errorf("invalid ABI boolean")
		}
		return n.String(), nil
	}
	return "", fmt.Errorf("unsupported accounting ABI type %s", kind)
}
func Decode(log model.LogRecord) (Event, error) {
	e := Event{Log: log, Fields: map[string]string{}}
	if len(log.Topics) == 0 {
		return e, fmt.Errorf("missing accounting topic")
	}
	for _, d := range definitions() {
		if !strings.EqualFold(d.Address, log.Address) || !strings.EqualFold(ethhash.EventTopic(signature(d)), log.Topics[0]) {
			continue
		}
		e.Name = d.Name
		data, err := words(log.Data)
		if err != nil {
			return e, err
		}
		ti, di := 1, 0
		for _, f := range d.Inputs {
			var b []byte
			if f.Indexed {
				if ti >= len(log.Topics) {
					return e, fmt.Errorf("missing indexed field")
				}
				w, err := words(log.Topics[ti])
				if err != nil || len(w) != 1 {
					return e, fmt.Errorf("invalid indexed field")
				}
				b = w[0]
				ti++
			} else {
				if di >= len(data) {
					return e, fmt.Errorf("missing data field")
				}
				b = data[di]
				di++
			}
			v, err := wordValue(f.Type, b)
			if err != nil {
				return e, err
			}
			e.Fields[f.Name] = v
		}
		if ti != len(log.Topics) || di != len(data) {
			return e, fmt.Errorf("non-canonical accounting event encoding")
		}
		return e, nil
	}
	return e, fmt.Errorf("unknown accounting topic/emitter")
}
func relevant(log model.LogRecord) bool {
	for _, a := range Addresses {
		if strings.EqualFold(a, log.Address) {
			return true
		}
	}
	return false
}
func eventKey(log model.LogRecord) string {
	return fmt.Sprintf("%d:%s:%s:%d", log.ChainID, strings.ToLower(log.BlockHash), strings.ToLower(log.TransactionHash), log.LogIndex)
}
func equalLog(a, b model.LogRecord) bool {
	return a.ChainID == b.ChainID && a.BlockNumber == b.BlockNumber && strings.EqualFold(a.BlockHash, b.BlockHash) && strings.EqualFold(a.TransactionHash, b.TransactionHash) && a.TransactionIndex == b.TransactionIndex && a.LogIndex == b.LogIndex && strings.EqualFold(a.Address, b.Address) && strings.EqualFold(a.Data, b.Data) && strings.EqualFold(strings.Join(a.Topics, ":"), strings.Join(b.Topics, ":"))
}
