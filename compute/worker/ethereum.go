package worker

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

var (
	secp256k1P = mustBigHex("fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f")
	secp256k1N = mustBigHex("fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141")
	secp256k1HalfN = new(big.Int).Rsh(new(big.Int).Set(secp256k1N), 1)
	secp256k1Gx = mustBigHex("79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798")
	secp256k1Gy = mustBigHex("483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
	ErrInvalidExecutionKey = errors.New("invalid execution key")
)

type ecPoint struct {
	x *big.Int
	y *big.Int
	inf bool
}

type Secp256k1ExecutionKey struct {
	d *big.Int
	pub ecPoint
	address string
}

func NewSecp256k1ExecutionKey(privateKey []byte) (*Secp256k1ExecutionKey, error) {
	if len(privateKey) != 32 {
		return nil, fmt.Errorf("%w: private key must be 32 bytes", ErrInvalidExecutionKey)
	}
	d := new(big.Int).SetBytes(privateKey)
	if d.Sign() <= 0 || d.Cmp(secp256k1N) >= 0 {
		return nil, fmt.Errorf("%w: private scalar out of range", ErrInvalidExecutionKey)
	}
	pub := scalarMult(ecPoint{x: secp256k1Gx, y: secp256k1Gy}, d)
	if pub.inf {
		return nil, fmt.Errorf("%w: invalid public key", ErrInvalidExecutionKey)
	}
	raw := make([]byte, 64)
	copy(raw[32-len(pub.x.Bytes()):32], pub.x.Bytes())
	copy(raw[64-len(pub.y.Bytes()):], pub.y.Bytes())
	sum := keccak256(raw)
	return &Secp256k1ExecutionKey{
		d: d,
		pub: pub,
		address: "0x" + hex.EncodeToString(sum[12:]),
	}, nil
}

func (k *Secp256k1ExecutionKey) Address() string {
	if k == nil {
		return ""
	}
	return k.address
}

func (k *Secp256k1ExecutionKey) VerifyDigest(digest [32]byte, signature []byte) bool {
	if k == nil {
		return false
	}
	return verifySecp256k1Signature(k.pub, digest, signature)
}

func (k *Secp256k1ExecutionKey) SignDigest(digest [32]byte) ([]byte, error) {
	if k == nil || k.d == nil {
		return nil, ErrInvalidExecutionKey
	}
	gen := newRFC6979(k.d, digest[:])
	z := new(big.Int).SetBytes(digest[:])
	for tries := 0; tries < 128; tries++ {
		nonce := gen.next()
		rp := scalarMult(ecPoint{x: secp256k1Gx, y: secp256k1Gy}, nonce)
		if rp.inf {
			continue
		}
		r := new(big.Int).Mod(new(big.Int).Set(rp.x), secp256k1N)
		if r.Sign() == 0 {
			continue
		}
		kinv := new(big.Int).ModInverse(nonce, secp256k1N)
		if kinv == nil {
			continue
		}
		s := new(big.Int).Mul(r, k.d)
		s.Add(s, z)
		s.Mod(s, secp256k1N)
		s.Mul(s, kinv)
		s.Mod(s, secp256k1N)
		if s.Sign() == 0 {
			continue
		}
		recid := 0
		if rp.x.Cmp(secp256k1N) >= 0 {
			recid |= 2
		}
		if rp.y.Bit(0) == 1 {
			recid |= 1
		}
		if s.Cmp(secp256k1HalfN) > 0 {
			s.Sub(secp256k1N, s)
			recid ^= 1
		}
		if recid > 1 {
			continue
		}
		sig := make([]byte, 65)
		rb, sb := r.Bytes(), s.Bytes()
		copy(sig[32-len(rb):32], rb)
		copy(sig[64-len(sb):64], sb)
		sig[64] = byte(27 + recid)
		return sig, nil
	}
	return nil, fmt.Errorf("%w: failed to derive recoverable signature", ErrInvalidExecutionKey)
}

func verifySecp256k1Signature(pub ecPoint, digest [32]byte, signature []byte) bool {
	if pub.inf || len(signature) != 65 || (signature[64] != 27 && signature[64] != 28) {
		return false
	}
	r := new(big.Int).SetBytes(signature[:32])
	s := new(big.Int).SetBytes(signature[32:64])
	if r.Sign() <= 0 || r.Cmp(secp256k1N) >= 0 || s.Sign() <= 0 || s.Cmp(secp256k1HalfN) > 0 {
		return false
	}
	w := new(big.Int).ModInverse(s, secp256k1N)
	if w == nil {
		return false
	}
	z := new(big.Int).SetBytes(digest[:])
	u1 := new(big.Int).Mul(z, w); u1.Mod(u1, secp256k1N)
	u2 := new(big.Int).Mul(r, w); u2.Mod(u2, secp256k1N)
	p := pointAdd(
		scalarMult(ecPoint{x: secp256k1Gx, y: secp256k1Gy}, u1),
		scalarMult(pub, u2),
	)
	if p.inf {
		return false
	}
	x := new(big.Int).Mod(p.x, secp256k1N)
	return x.Cmp(r) == 0
}

func pointAdd(a, b ecPoint) ecPoint {
	if a.inf { return clonePoint(b) }
	if b.inf { return clonePoint(a) }
	if a.x.Cmp(b.x) == 0 {
		if new(big.Int).Mod(new(big.Int).Add(a.y, b.y), secp256k1P).Sign() == 0 {
			return ecPoint{inf:true}
		}
		return pointDouble(a)
	}
	num := new(big.Int).Sub(b.y, a.y); num.Mod(num, secp256k1P)
	den := new(big.Int).Sub(b.x, a.x); den.Mod(den, secp256k1P)
	den.ModInverse(den, secp256k1P)
	if den == nil { return ecPoint{inf:true} }
	lambda := new(big.Int).Mul(num, den); lambda.Mod(lambda, secp256k1P)
	x := new(big.Int).Mul(lambda, lambda)
	x.Sub(x, a.x); x.Sub(x, b.x); x.Mod(x, secp256k1P)
	y := new(big.Int).Sub(a.x, x)
	y.Mul(lambda, y); y.Sub(y, a.y); y.Mod(y, secp256k1P)
	return ecPoint{x:x,y:y}
}

func pointDouble(a ecPoint) ecPoint {
	if a.inf || a.y.Sign() == 0 { return ecPoint{inf:true} }
	num := new(big.Int).Mul(a.x, a.x)
	num.Mul(num, big.NewInt(3)); num.Mod(num, secp256k1P)
	den := new(big.Int).Mul(a.y, big.NewInt(2)); den.Mod(den, secp256k1P)
	den.ModInverse(den, secp256k1P)
	if den == nil { return ecPoint{inf:true} }
	lambda := new(big.Int).Mul(num, den); lambda.Mod(lambda, secp256k1P)
	x := new(big.Int).Mul(lambda, lambda)
	twoX := new(big.Int).Mul(a.x, big.NewInt(2))
	x.Sub(x, twoX); x.Mod(x, secp256k1P)
	y := new(big.Int).Sub(a.x, x)
	y.Mul(lambda, y); y.Sub(y, a.y); y.Mod(y, secp256k1P)
	return ecPoint{x:x,y:y}
}

func scalarMult(p ecPoint, k *big.Int) ecPoint {
	if k == nil || k.Sign() == 0 || p.inf { return ecPoint{inf:true} }
	n := new(big.Int).Set(k)
	result := ecPoint{inf:true}
	addend := clonePoint(p)
	for n.Sign() > 0 {
		if n.Bit(0) == 1 { result = pointAdd(result, addend) }
		addend = pointDouble(addend)
		n.Rsh(n, 1)
	}
	return result
}

func clonePoint(p ecPoint) ecPoint {
	if p.inf { return ecPoint{inf:true} }
	return ecPoint{x:new(big.Int).Set(p.x), y:new(big.Int).Set(p.y)}
}

type rfc6979 struct { k, v []byte }

func newRFC6979(d *big.Int, digest []byte) *rfc6979 {
	x := make([]byte, 32)
	db := d.Bytes()
	copy(x[32-len(db):], db)
	h1 := bits2octets(digest)
	v := bytesRepeat(0x01, 32)
	k := bytesRepeat(0x00, 32)
	k = hmacSHA256(k, v, []byte{0x00}, x, h1)
	v = hmacSHA256(k, v)
	k = hmacSHA256(k, v, []byte{0x01}, x, h1)
	v = hmacSHA256(k, v)
	return &rfc6979{k:k, v:v}
}

func (g *rfc6979) next() *big.Int {
	for {
		g.v = hmacSHA256(g.k, g.v)
		candidate := new(big.Int).SetBytes(g.v)
		if candidate.Sign() > 0 && candidate.Cmp(secp256k1N) < 0 {
			return candidate
		}
		g.k = hmacSHA256(g.k, g.v, []byte{0x00})
		g.v = hmacSHA256(g.k, g.v)
	}
}

func bits2octets(in []byte) []byte {
	z := new(big.Int).SetBytes(in)
	z.Mod(z, secp256k1N)
	out := make([]byte, 32)
	b := z.Bytes()
	copy(out[32-len(b):], b)
	return out
}

func hmacSHA256(key []byte, chunks ...[]byte) []byte {
	h := hmac.New(sha256.New, key)
	for _, c := range chunks { _, _ = h.Write(c) }
	return h.Sum(nil)
}

func bytesRepeat(b byte, n int) []byte {
	out := make([]byte, n)
	for i := range out { out[i] = b }
	return out
}

func mustBigHex(value string) *big.Int {
	n, ok := new(big.Int).SetString(value, 16)
	if !ok { panic("invalid big integer") }
	return n
}

func parseAddress(value string) ([20]byte, error) {
	var out [20]byte
	if len(value) != 42 || !strings.HasPrefix(value, "0x") {
		return out, fmt.Errorf("address must be 0x + 40 hex")
	}
	b, err := hex.DecodeString(value[2:])
	if err != nil || len(b) != 20 {
		return out, fmt.Errorf("invalid address")
	}
	copy(out[:], b)
	allZero := true
	for _, v := range out { if v != 0 { allZero=false; break } }
	if allZero { return out, fmt.Errorf("zero address") }
	return out, nil
}

func keccak256(data []byte) [32]byte {
	const rate = 136
	var state [25]uint64
	for len(data) >= rate {
		for i := 0; i < rate/8; i++ {
			state[i] ^= load64LE(data[i*8:(i+1)*8])
		}
		keccakF1600(&state)
		data = data[rate:]
	}
	var block [rate]byte
	copy(block[:], data)
	block[len(data)] = 0x01
	block[rate-1] ^= 0x80
	for i := 0; i < rate/8; i++ {
		state[i] ^= load64LE(block[i*8:(i+1)*8])
	}
	keccakF1600(&state)
	var out [32]byte
	for i := 0; i < 4; i++ { store64LE(out[i*8:(i+1)*8], state[i]) }
	return out
}

func load64LE(b []byte) uint64 {
	return uint64(b[0]) | uint64(b[1])<<8 | uint64(b[2])<<16 | uint64(b[3])<<24 |
		uint64(b[4])<<32 | uint64(b[5])<<40 | uint64(b[6])<<48 | uint64(b[7])<<56
}
func store64LE(b []byte, v uint64) {
	for i:=0;i<8;i++ { b[i]=byte(v>>(8*i)) }
}
func rol64(v uint64, n uint) uint64 { return (v<<n)|(v>>(64-n)) }

func keccakF1600(a *[25]uint64) {
	roundConstants := [24]uint64{
		0x0000000000000001,0x0000000000008082,0x800000000000808a,0x8000000080008000,
		0x000000000000808b,0x0000000080000001,0x8000000080008081,0x8000000000008009,
		0x000000000000008a,0x0000000000000088,0x0000000080008009,0x000000008000000a,
		0x000000008000808b,0x800000000000008b,0x8000000000008089,0x8000000000008003,
		0x8000000000008002,0x8000000000000080,0x000000000000800a,0x800000008000000a,
		0x8000000080008081,0x8000000000008080,0x0000000080000001,0x8000000080008008,
	}
	rot := [25]uint{0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14}
	for _, rc := range roundConstants {
		var c,d [5]uint64
		for x:=0;x<5;x++ { c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20] }
		for x:=0;x<5;x++ { d[x]=c[(x+4)%5]^rol64(c[(x+1)%5],1) }
		for x:=0;x<5;x++ { for y:=0;y<5;y++ { a[x+5*y]^=d[x] } }
		var b [25]uint64
		for x:=0;x<5;x++ { for y:=0;y<5;y++ {
			idx:=x+5*y
			nx:=y
			ny:=(2*x+3*y)%5
			if rot[idx]==0 { b[nx+5*ny]=a[idx] } else { b[nx+5*ny]=rol64(a[idx],rot[idx]) }
		}}
		for x:=0;x<5;x++ { for y:=0;y<5;y++ {
			a[x+5*y]=b[x+5*y]^((^b[(x+1)%5+5*y])&b[(x+2)%5+5*y])
		}}
		a[0]^=rc
	}
}
