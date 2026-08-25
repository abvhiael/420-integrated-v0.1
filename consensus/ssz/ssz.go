package ssz

import (
	"crypto/sha256"
	"encoding/binary"
)

// This package implements the fixed-size subset of SSZ needed by the Step 4.3
// consensus containers. Variable-list generalized SSZ is intentionally deferred
// until networking/state containers require it.

type Root [32]byte

func Hash(data []byte) Root {
	return sha256.Sum256(data)
}

func Uint64Root(v uint64) Root {
	var chunk Root
	binary.LittleEndian.PutUint64(chunk[:8], v)
	return chunk
}

func Uint32Root(v uint32) Root {
	var chunk Root
	binary.LittleEndian.PutUint32(chunk[:4], v)
	return chunk
}

func Bytes32Root(v [32]byte) Root { return Root(v) }

func Bytes48Root(v [48]byte) Root {
	var a, b Root
	copy(a[:], v[:32])
	copy(b[:16], v[32:])
	return Pair(a, b)
}

func Bytes96Root(v [96]byte) Root {
	var a, b, c Root
	copy(a[:], v[:32])
	copy(b[:], v[32:64])
	copy(c[:], v[64:96])
	return Pair(Pair(a, b), Pair(c, Root{}))
}

func Pair(a, b Root) Root {
	var buf [64]byte
	copy(buf[:32], a[:])
	copy(buf[32:], b[:])
	return sha256.Sum256(buf[:])
}

func Merkleize(chunks []Root) Root {
	if len(chunks) == 0 {
		return Root{}
	}
	n := 1
	for n < len(chunks) {
		n <<= 1
	}
	level := make([]Root, n)
	copy(level, chunks)
	for n > 1 {
		next := make([]Root, n/2)
		for i := 0; i < n; i += 2 {
			next[i/2] = Pair(level[i], level[i+1])
		}
		level = next
		n /= 2
	}
	return level[0]
}

func Container(fields ...Root) Root {
	return Merkleize(fields)
}
