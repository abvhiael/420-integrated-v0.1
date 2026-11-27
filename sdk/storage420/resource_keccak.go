package storage420

import "math/bits"

// Legacy Ethereum Keccak-256, using the repository's bundler/userop/hash.go
// implementation. Do not substitute NIST SHA3-256 for Ethereum event identities.
func keccak256(data []byte) [32]byte {
	const rate = 136
	var state [25]uint64
	for len(data) >= rate {
		xorBlock(&state, data[:rate])
		keccakF1600(&state)
		data = data[rate:]
	}
	var block [rate]byte
	copy(block[:], data)
	block[len(data)] = 0x01
	block[rate-1] |= 0x80
	xorBlock(&state, block[:])
	keccakF1600(&state)

	var out [32]byte
	for i := 0; i < 4; i++ {
		v := state[i]
		for j := 0; j < 8; j++ { out[i*8+j] = byte(v >> (8*j)) }
	}
	return out
}

func xorBlock(state *[25]uint64, block []byte) {
	for i := 0; i < len(block)/8; i++ {
		var v uint64
		for j := 0; j < 8; j++ { v |= uint64(block[i*8+j]) << (8*j) }
		state[i] ^= v
	}
}

var keccakRC = [24]uint64{
	0x0000000000000001,0x0000000000008082,0x800000000000808a,0x8000000080008000,
	0x000000000000808b,0x0000000080000001,0x8000000080008081,0x8000000000008009,
	0x000000000000008a,0x0000000000000088,0x0000000080008009,0x000000008000000a,
	0x000000008000808b,0x800000000000008b,0x8000000000008089,0x8000000000008003,
	0x8000000000008002,0x8000000000000080,0x000000000000800a,0x800000008000000a,
	0x8000000080008081,0x8000000000008080,0x0000000080000001,0x8000000080008008,
}

var keccakRot = [25]int{
	0,1,62,28,27,
	36,44,6,55,20,
	3,10,43,25,39,
	41,45,15,21,8,
	18,2,61,56,14,
}

func keccakF1600(a *[25]uint64) {
	for _, rc := range keccakRC {
		var c [5]uint64
		for x:=0;x<5;x++ { c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20] }
		var d [5]uint64
		for x:=0;x<5;x++ { d[x]=c[(x+4)%5]^bits.RotateLeft64(c[(x+1)%5],1) }
		for x:=0;x<5;x++ { for y:=0;y<5;y++ { a[x+5*y]^=d[x] } }

		var b [25]uint64
		for x:=0;x<5;x++ {
			for y:=0;y<5;y++ {
				nx, ny := y, (2*x+3*y)%5
				b[nx+5*ny] = bits.RotateLeft64(a[x+5*y], keccakRot[x+5*y])
			}
		}
		for x:=0;x<5;x++ {
			for y:=0;y<5;y++ { a[x+5*y] = b[x+5*y] ^ ((^b[(x+1)%5+5*y]) & b[(x+2)%5+5*y]) }
		}
		a[0] ^= rc
	}
}
