package storage

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"math/bits"
	"strings"
	"time"
)

type RPCStorageContracts struct {
	Agreement  string
	Commitment string
	Capacity   string
	Settlement string
	Scheme     string
}

type RPCStorageReader struct {
	Backend RPCBackend
	Contracts RPCStorageContracts
	StartBlock uint64
	LogBatchSize uint64
	Now func() time.Time
}

func (r RPCStorageReader) AssignmentByAgreement(ctx context.Context, agreementID string) (AssignmentSnapshot, error) {
	if err := r.validate(); err != nil { return AssignmentSnapshot{}, err }
	id, err := bytes32Arg(agreementID)
	if err != nil { return AssignmentSnapshot{}, err }
	now := r.now()

	agreementRaw, err := r.call1(ctx, r.Contracts.Agreement, "getAgreement(bytes32)", id, "latest")
	if err != nil { return AssignmentSnapshot{}, err }
	aw, err := abiWords(agreementRaw, 18)
	if err != nil { return AssignmentSnapshot{}, err }
	if !wordBool(aw[17]) || wordUint64(aw[16]) != 2 { return AssignmentSnapshot{}, ErrInactiveAssignment }
	proofSchemeID, commitmentID, reservationID := wordHex(aw[7]), wordHex(aw[8]), wordHex(aw[9])
	size, start, end, interval := wordUint64(aw[10]), wordUint64(aw[11]), wordUint64(aw[12]), wordUint64(aw[13])
	if zeroWord(aw[8]) || zeroWord(aw[9]) || size == 0 || start >= end || interval == 0 || now.Before(time.Unix(int64(start),0).UTC()) || now.After(time.Unix(int64(end),0).UTC()) {
		return AssignmentSnapshot{}, ErrInactiveAssignment
	}

	commitRaw, err := r.call1(ctx, r.Contracts.Commitment, "getCommitment(bytes32)", aw[8], "latest")
	if err != nil { return AssignmentSnapshot{}, err }
	cw, err := abiWords(commitRaw, 10)
	if err != nil { return AssignmentSnapshot{}, err }
	if !wordBool(cw[9]) || !sameWord(cw[2], aw[7]) || !sameWord(cw[3], aw[3]) || wordUint64(cw[6]) != size || wordUint64(cw[7]) != start || wordUint64(cw[8]) != end || zeroWord(cw[1]) {
		return AssignmentSnapshot{}, ErrInvalidChainState
	}

	reservationRaw, err := r.call1(ctx, r.Contracts.Capacity, "getReservation(bytes32)", aw[9], "latest")
	if err != nil { return AssignmentSnapshot{}, err }
	rw, err := abiWords(reservationRaw, 6)
	if err != nil { return AssignmentSnapshot{}, err }
	if !wordBool(rw[4]) || !wordBool(rw[5]) || !sameWord(rw[0], cw[1]) || !sameWord(rw[1], id) || wordUint64(rw[2]) != size || wordUint64(rw[3]) < end || now.Unix() >= int64(wordUint64(rw[3])) {
		return AssignmentSnapshot{}, ErrInactiveAssignment
	}
	activeReservation, err := r.call1(ctx, r.Contracts.Capacity, "isReservationActive(bytes32)", aw[9], "latest")
	if err != nil { return AssignmentSnapshot{}, err }
	bv, err := abiWords(activeReservation,1)
	if err != nil || !wordBool(bv[0]) { return AssignmentSnapshot{}, ErrInactiveAssignment }

	schemeRaw, err := r.call1(ctx, r.Contracts.Scheme, "getScheme(bytes32)", aw[7], "latest")
	if err != nil { return AssignmentSnapshot{}, err }
	sw, err := abiWords(schemeRaw,6)
	if err != nil { return AssignmentSnapshot{}, err }
	if !wordBool(sw[4]) || !wordBool(sw[5]) || wordUint64(sw[3]) == 0 { return AssignmentSnapshot{}, ErrInactiveAssignment }

	duration := end-start
	windows := (duration + interval - 1) / interval
	if windows == 0 || windows > 4096 { return AssignmentSnapshot{}, ErrInvalidChainState }
	return AssignmentSnapshot{Assignment: Assignment{
		AgreementID: wordHex(id), CommitmentID: commitmentID, NodeID: wordHex(cw[1]), ShardRoot: strings.TrimPrefix(wordHex(cw[3]),"0x"), SizeBytes:size,
		StartTime:time.Unix(int64(start),0).UTC(), EndTime:time.Unix(int64(end),0).UTC(), Active:true,
	}, WindowCount:uint32(windows)}, nil
}

func (r RPCStorageReader) Window(ctx context.Context, agreementID string, windowIndex uint32) (Challenge, time.Time, error) {
	if err := r.validate(); err != nil { return Challenge{}, time.Time{}, err }
	snap, err := r.AssignmentByAgreement(ctx, agreementID)
	if err != nil { return Challenge{}, time.Time{}, err }
	settlementID, err := r.uniqueSettlement(ctx, agreementID)
	if err != nil { return Challenge{}, time.Time{}, err }
	sid, _ := bytes32Arg(settlementID)

	settleRaw, err := r.call1(ctx, r.Contracts.Settlement, "getSettlement(bytes32)", sid, "latest")
	if err != nil { return Challenge{}, time.Time{}, err }
	set, err := abiWords(settleRaw,13)
	if err != nil { return Challenge{}, time.Time{}, err }
	if !wordBool(set[12]) || !sameWord(set[0], mustBytes32(agreementID)) || wordUint64(set[11]) != 2 || windowIndex >= uint32(wordUint64(set[8])) {
		return Challenge{}, time.Time{}, ErrInactiveAssignment
	}
	wsRaw, err := r.call2(ctx, r.Contracts.Settlement, "windowState(bytes32,uint32)", sid, uintWord(uint64(windowIndex)), "latest")
	if err != nil { return Challenge{}, time.Time{}, err }
	ws, err := abiWords(wsRaw,1)
	if err != nil || wordUint64(ws[0]) != 1 { return Challenge{}, time.Time{}, ErrInactiveAssignment }

	timingRaw, err := r.call2(ctx, r.Contracts.Settlement, "windowTiming(bytes32,uint32)", sid, uintWord(uint64(windowIndex)), "latest")
	if err != nil { return Challenge{}, time.Time{}, err }
	tw, err := abiWords(timingRaw,2)
	if err != nil { return Challenge{}, time.Time{}, err }
	epoch, deadline := wordUint64(tw[0]), wordUint64(tw[1])
	if epoch == 0 || deadline < epoch || epoch < uint64(snap.Assignment.StartTime.Unix()) || epoch > uint64(snap.Assignment.EndTime.Unix()) { return Challenge{},time.Time{},ErrInvalidChainState }

	challengeRaw, err := r.call3(ctx, r.Contracts.Settlement, "canonicalChallengeId(bytes32,uint32,uint64)", mustBytes32(agreementID), uintWord(uint64(windowIndex)), uintWord(epoch), "latest")
	if err != nil { return Challenge{}, time.Time{}, err }
	ch, err := abiWords(challengeRaw,1)
	if err != nil || zeroWord(ch[0]) { return Challenge{},time.Time{},ErrInvalidChainState }
	return Challenge{AgreementID:snap.Assignment.AgreementID, CommitmentID:snap.Assignment.CommitmentID, ChallengeID:wordHex(ch[0]), Epoch:time.Unix(int64(epoch),0).UTC()}, time.Unix(int64(deadline),0).UTC(), nil
}

func (r RPCStorageReader) uniqueSettlement(ctx context.Context, agreementID string) (string,error) {
	id, err := bytes32Arg(agreementID); if err != nil { return "",err }
	topic0 := "0x"+hex.EncodeToString(keccak256([]byte("StorageSettlementOpened(bytes32,bytes32,address,address,address,address,uint256,uint32)"))[:])
	latest, err := r.Backend.LatestBlock(ctx); if err != nil { return "",err }
	batch := r.LogBatchSize; if batch == 0 { batch=2048 }
	found := ""
	for from:=r.StartBlock; from<=latest.Number; {
		to:=from+batch-1; if to<from || to>latest.Number { to=latest.Number }
		logs, err := r.Backend.Logs(ctx,from,to,LogFilter{Addresses:[]string{r.Contracts.Settlement},Topics:[][]string{{topic0},{},{wordHex(id)}}})
		if err != nil { return "",err }
		for _, log := range logs {
			if log.Removed || len(log.Topics)<3 || !equalHex(log.Topics[2],wordHex(id)) { return "",ErrInvalidChainState }
			candidate:=log.Topics[1]
			if found!="" && !equalHex(found,candidate) { return "",ErrInvalidChainState }
			found=candidate
		}
		if to==latest.Number { break }; from=to+1
	}
	if found=="" { return "",ErrInactiveAssignment }
	return found,nil
}

func (r RPCStorageReader) validate() error {
	for _, a := range []string{r.Contracts.Agreement,r.Contracts.Commitment,r.Contracts.Capacity,r.Contracts.Settlement,r.Contracts.Scheme} { if !validHexAddress(a) { return ErrInvalidChainState } }
	return nil
}
func (r RPCStorageReader) now() time.Time { if r.Now!=nil { return r.Now().UTC() }; return time.Now().UTC() }

func (r RPCStorageReader) call1(ctx context.Context,to,sig string,a [32]byte,tag string)(string,error){ return r.Backend.EthCall(ctx,to,calldata(sig,a),tag) }
func (r RPCStorageReader) call2(ctx context.Context,to,sig string,a,b [32]byte,tag string)(string,error){ return r.Backend.EthCall(ctx,to,calldata(sig,a,b),tag) }
func (r RPCStorageReader) call3(ctx context.Context,to,sig string,a,b,c [32]byte,tag string)(string,error){ return r.Backend.EthCall(ctx,to,calldata(sig,a,b,c),tag) }

func calldata(sig string,args ...[32]byte) string {
	h:=keccak256([]byte(sig)); b:=make([]byte,4+32*len(args)); copy(b,h[:4]); for i,a:=range args { copy(b[4+i*32:],a[:]) }; return "0x"+hex.EncodeToString(b)
}
func bytes32Arg(v string)([32]byte,error){ var out [32]byte; v=strings.TrimSpace(v); if strings.HasPrefix(strings.ToLower(v),"0x") { v=v[2:] }; if len(v)!=64 || !isHex(v) { return out,ErrInvalidChainState }; b,err:=hex.DecodeString(v); if err!=nil{return out,ErrInvalidChainState}; copy(out[:],b); return out,nil }
func mustBytes32(v string)[32]byte { x,_:=bytes32Arg(v); return x }
func uintWord(v uint64)(o [32]byte){ binary.BigEndian.PutUint64(o[24:],v); return }
func abiWords(v string,min int)([][32]byte,error){ if !validHexData(v){return nil,ErrInvalidChainState}; b,err:=hex.DecodeString(strings.TrimPrefix(v,"0x")); if err!=nil || len(b)%32!=0 || len(b)/32<min{return nil,ErrInvalidChainState}; out:=make([][32]byte,len(b)/32); for i:=range out{copy(out[i][:],b[i*32:(i+1)*32])}; return out,nil }
func wordHex(w [32]byte)string{return "0x"+hex.EncodeToString(w[:])}
func wordUint64(w [32]byte)uint64{ for _,b:=range w[:24]{if b!=0{return ^uint64(0)}}; return binary.BigEndian.Uint64(w[24:]) }
func wordBool(w [32]byte)bool{ for _,b:=range w[:31]{if b!=0{return false}}; return w[31]==1 }
func zeroWord(w [32]byte)bool{ var z [32]byte; return w==z }
func sameWord(a,b [32]byte)bool{return a==b}

// keccak256 is the Ethereum legacy Keccak-256 sponge, kept local to avoid a runtime dependency.
func keccak256(msg []byte) [32]byte {
	var st [25]uint64
	const rate=136
	for len(msg)>=rate { absorbBlock(&st,msg[:rate]); keccakF1600(&st); msg=msg[rate:] }
	var last [rate]byte; copy(last[:],msg); last[len(msg)]=0x01; last[rate-1]|=0x80; absorbBlock(&st,last[:]); keccakF1600(&st)
	var out [32]byte; for i:=0;i<4;i++{binary.LittleEndian.PutUint64(out[i*8:],st[i])}; return out
}
func absorbBlock(st *[25]uint64,b []byte){ for i:=0;i<len(b)/8;i++{st[i]^=binary.LittleEndian.Uint64(b[i*8:])} }
func keccakF1600(a *[25]uint64){
	rc:=[24]uint64{0x0000000000000001,0x0000000000008082,0x800000000000808a,0x8000000080008000,0x000000000000808b,0x0000000080000001,0x8000000080008081,0x8000000000008009,0x000000000000008a,0x0000000000000088,0x0000000080008009,0x000000008000000a,0x000000008000808b,0x800000000000008b,0x8000000000008089,0x8000000000008003,0x8000000000008002,0x8000000000000080,0x000000000000800a,0x800000008000000a,0x8000000080008081,0x8000000000008080,0x0000000080000001,0x8000000080008008}
	r:=[25]int{0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14}
	for _,round:=range rc{ var c,d [5]uint64; for x:=0;x<5;x++{c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]}; for x:=0;x<5;x++{d[x]=c[(x+4)%5]^bits.RotateLeft64(c[(x+1)%5],1)}; for i:=0;i<25;i++{a[i]^=d[i%5]}; var b [25]uint64; for x:=0;x<5;x++{for y:=0;y<5;y++{i:=x+5*y; nx:=y; ny:=(2*x+3*y)%5; b[nx+5*ny]=bits.RotateLeft64(a[i],r[i])}}; for x:=0;x<5;x++{for y:=0;y<5;y++{i:=x+5*y; a[i]=b[i]^((^b[(x+1)%5+5*y])&b[(x+2)%5+5*y])}}; a[0]^=round }
}

var _ CanonicalStorageReader = RPCStorageReader{}
var _ = errors.Is
var _ = fmt.Sprintf
