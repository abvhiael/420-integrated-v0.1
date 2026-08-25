package proposer

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
)

var ErrEmptyInput = errors.New("cannot shuffle empty input")

type Stream struct {
	seed     [32]byte
	domain   string
	rotation uint64
	counter  uint64
	buf      [32]byte
	offset   int
}

func NewStream(seed [32]byte, domain string, rotation uint64) *Stream {
	return &Stream{seed: seed, domain: domain, rotation: rotation, offset: 32}
}

func (s *Stream) refill() {
	h := sha256.New()
	h.Write(s.seed[:])
	h.Write([]byte(s.domain))
	var b [16]byte
	binary.LittleEndian.PutUint64(b[:8], s.rotation)
	binary.LittleEndian.PutUint64(b[8:], s.counter)
	h.Write(b[:])
	copy(s.buf[:], h.Sum(nil))
	s.counter++
	s.offset = 0
}

func (s *Stream) Uint64() uint64 {
	if s.offset+8 > len(s.buf) {
		s.refill()
	}
	v := binary.LittleEndian.Uint64(s.buf[s.offset : s.offset+8])
	s.offset += 8
	return v
}

// UniformIndex uses rejection sampling to avoid modulo bias.
func (s *Stream) UniformIndex(n uint64) uint64 {
	if n == 0 {
		panic("UniformIndex(0)")
	}
	limit := ^uint64(0) - (^uint64(0) % n)
	for {
		v := s.Uint64()
		if v < limit {
			return v % n
		}
	}
}

func Shuffle[T any](input []T, seed [32]byte, domain string, rotation uint64) ([]T, error) {
	if len(input) == 0 {
		return nil, ErrEmptyInput
	}
	out := append([]T(nil), input...)
	stream := NewStream(seed, domain, rotation)
	for i := len(out) - 1; i > 0; i-- {
		j := int(stream.UniformIndex(uint64(i + 1)))
		out[i], out[j] = out[j], out[i]
	}
	return out, nil
}
