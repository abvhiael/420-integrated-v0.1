package storage

import "encoding/hex"

func EventTopic(signature string) string {
	h := keccak256([]byte(signature))
	return "0x" + hex.EncodeToString(h[:])
}
