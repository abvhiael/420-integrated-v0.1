package storage

import (
	"context"
	"strings"
)

// EthCall performs a read-only contract call at the requested block tag.
func (r RPCBackend) EthCall(ctx context.Context, to, data, blockTag string) (string, error) {
	if !validHexAddress(to) || !validHexData(data) {
		return "", ErrInvalidChainState
	}
	if strings.TrimSpace(blockTag) == "" {
		blockTag = "latest"
	}
	var out string
	if err := r.call(ctx, "eth_call", []interface{}{map[string]string{"to": to, "data": data}, blockTag}, &out); err != nil {
		return "", err
	}
	if !validHexData(out) {
		return "", ErrInvalidChainState
	}
	return out, nil
}

func validHexAddress(v string) bool {
	v = strings.TrimSpace(v)
	if len(v) != 42 || !strings.HasPrefix(strings.ToLower(v), "0x") { return false }
	return isHex(v[2:])
}

func validHexData(v string) bool {
	v = strings.TrimSpace(v)
	if len(v) < 2 || !strings.HasPrefix(strings.ToLower(v), "0x") || len(v[2:])%2 != 0 { return false }
	return isHex(v[2:])
}

func isHex(v string) bool {
	for _, c := range v {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) { return false }
	}
	return true
}
