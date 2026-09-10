package storage

import (
	"context"
	"encoding/binary"
	"encoding/hex"
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
	Manifest   string
}

type RPCStorageReader struct {
	Backend      RPCBackend
	Contracts    RPCStorageContracts
	StartBlock   uint64
	LogBatchSize uint64
	Now          func() time.Time
}

func (r RPCStorageReader) AssignmentByAgreement(ctx context.Context, agreementID string) (AssignmentSnapshot, error) {
	if err := r.validate(); err != nil { return AssignmentSnapshot{}, err }
	id, err := bytes32Arg(agreementID); if err != nil { return AssignmentSnapshot{}, err }
	now := r.now()

	raw, err := r.call1(ctx,r.Contracts.Agreement,"getAgreement(bytes32)",id,"latest"); if err != nil { return AssignmentSnapshot{},err }
	aw, err := abiWords(raw,18); if err != nil { return AssignmentSnapshot{},err }
	state, ok := wordUint64(aw[16]); if !ok || state != 2 || !wordBool(aw[17]) { return AssignmentSnapshot{},ErrInactiveAssignment }
	agreementSize,sok := wordUint64(aw[10]); start,stok := wordUint64(aw[11]); end,eok := wordUint64(aw[12]); interval,iok := wordUint64(aw[13]); dataShards,dsok:=wordUint64(aw[14]); totalShards,tsok:=wordUint64(aw[15])
	if !sok||!stok||!eok||!iok||!dsok||!tsok||zeroWord(aw[2])||zeroWord(aw[3])||zeroWord(aw[4])||zeroWord(aw[8])||zeroWord(aw[9])||agreementSize==0||start>=end||interval==0||dataShards==0||totalShards<dataShards||totalShards>1024||now.Before(time.Unix(int64(start),0).UTC())||now.After(time.Unix(int64(end),0).UTC()){ return AssignmentSnapshot{},ErrInactiveAssignment }

	raw,err=r.call1(ctx,r.Contracts.Commitment,"getCommitment(bytes32)",aw[8],"latest"); if err!=nil{return AssignmentSnapshot{},err}
	cw,err:=abiWords(raw,10); if err!=nil{return AssignmentSnapshot{},err}
	cs,cok:=wordUint64(cw[6]); cstart,csok:=wordUint64(cw[7]); cend,ceok:=wordUint64(cw[8])
	if !wordBool(cw[9])||!cok||!csok||!ceok||!sameWord(cw[2],aw[7])||!sameWord(cw[3],aw[3])||cs!=agreementSize||cstart!=start||cend!=end||zeroWord(cw[1]) { return AssignmentSnapshot{},ErrInvalidChainState }

	raw,err=r.call1(ctx,r.Contracts.Capacity,"getReservation(bytes32)",aw[9],"latest"); if err!=nil{return AssignmentSnapshot{},err}
	rw,err:=abiWords(raw,6); if err!=nil{return AssignmentSnapshot{},err}
	rs,rsok:=wordUint64(rw[2]); release,rok:=wordUint64(rw[3])
	if !wordBool(rw[4])||!wordBool(rw[5])||!rsok||!rok||!sameWord(rw[0],cw[1])||!sameWord(rw[1],id)||rs!=agreementSize||release<end||now.Unix()>=int64(release){return AssignmentSnapshot{},ErrInactiveAssignment}
	raw,err=r.call1(ctx,r.Contracts.Capacity,"isReservationActive(bytes32)",aw[9],"latest"); if err!=nil{return AssignmentSnapshot{},err}
	bv,err:=abiWords(raw,1); if err!=nil||!wordBool(bv[0]){return AssignmentSnapshot{},ErrInactiveAssignment}

	raw,err=r.call1(ctx,r.Contracts.Scheme,"getScheme(bytes32)",aw[7],"latest"); if err!=nil{return AssignmentSnapshot{},err}
	sw,err:=abiWords(raw,6); if err!=nil{return AssignmentSnapshot{},err}
	delay,dok:=wordUint64(sw[3]); if !dok||delay==0||!wordBool(sw[4])||!wordBool(sw[5]){return AssignmentSnapshot{},ErrInactiveAssignment}

	// Provider transport is authorized against the immutable per-shard placement,
	// not the broader agreement/commitment content root. Require a sealed manifest
	// so every placement index is canonical and resolvable without ambiguity.
	raw,err=r.call3(ctx,r.Contracts.Manifest,"canonicalManifestId(address,bytes32,bytes32)",aw[0],aw[2],aw[4],"latest"); if err!=nil{return AssignmentSnapshot{},err}
	mi,err:=abiWords(raw,1); if err!=nil||zeroWord(mi[0]){return AssignmentSnapshot{},ErrInvalidChainState}; manifestID:=mi[0]
	raw,err=r.call1(ctx,r.Contracts.Manifest,"getManifest(bytes32)",manifestID,"latest"); if err!=nil{return AssignmentSnapshot{},err}
	mw,err:=abiWords(raw,13); if err!=nil{return AssignmentSnapshot{},err}
	md,mdok:=wordUint64(mw[8]); mt,mtok:=wordUint64(mw[9]); placed,pok:=wordUint64(mw[10])
	if !mdok||!mtok||!pok||!wordBool(mw[11])||!wordBool(mw[12])||!sameWord(mw[0],aw[0])||!sameWord(mw[1],aw[2])||!sameWord(mw[2],aw[3])||!sameWord(mw[3],aw[4])||md!=dataShards||mt!=totalShards||placed!=totalShards{return AssignmentSnapshot{},ErrInvalidChainState}

	var shardRoot [32]byte; var shardSize uint64; found:=false
	for i:=uint64(0);i<totalShards;i++{
		raw,err=r.call2(ctx,r.Contracts.Manifest,"placementAt(bytes32,uint32)",manifestID,uintWord(i),"latest"); if err!=nil{return AssignmentSnapshot{},err}
		pw,err:=abiWords(raw,8); if err!=nil{return AssignmentSnapshot{},err}
		ps,psok:=wordUint64(pw[5]); pi,piok:=wordUint64(pw[6])
		if !wordBool(pw[7])||!psok||!piok||ps==0||ps>agreementSize||pi!=i||!sameWord(pw[0],manifestID)||zeroWord(pw[4]){return AssignmentSnapshot{},ErrInvalidChainState}
		if !sameWord(pw[1],id){continue}
		if found||!sameWord(pw[2],aw[8])||!sameWord(pw[3],cw[1]){return AssignmentSnapshot{},ErrInvalidChainState}
		found=true; shardRoot=pw[4]; shardSize=ps
	}
	if !found{return AssignmentSnapshot{},ErrInvalidChainState}

	duration:=end-start; windows:=(duration+interval-1)/interval
	if windows==0||windows>4096{return AssignmentSnapshot{},ErrInvalidChainState}
	return AssignmentSnapshot{Assignment:Assignment{AgreementID:wordHex(id),CommitmentID:wordHex(aw[8]),NodeID:wordHex(cw[1]),ShardRoot:strings.TrimPrefix(wordHex(shardRoot),"0x"),SizeBytes:shardSize,StartTime:time.Unix(int64(start),0).UTC(),EndTime:time.Unix(int64(end),0).UTC(),Active:true},WindowCount:uint32(windows)},nil
}

func (r RPCStorageReader) Window(ctx context.Context, agreementID string, windowIndex uint32) (Challenge,time.Time,error){
	if err:=r.validate();err!=nil{return Challenge{},time.Time{},err}
	snap,err:=r.AssignmentByAgreement(ctx,agreementID);if err!=nil{return Challenge{},time.Time{},err}
	settlementID,err:=r.uniqueSettlement(ctx,agreementID);if err!=nil{return Challenge{},time.Time{},err}
	sid,err:=bytes32Arg(settlementID);if err!=nil{return Challenge{},time.Time{},err}
	raw,err:=r.call1(ctx,r.Contracts.Settlement,"getSettlement(bytes32)",sid,"latest");if err!=nil{return Challenge{},time.Time{},err}
	set,err:=abiWords(raw,13);if err!=nil{return Challenge{},time.Time{},err}
	ss,sok:=wordUint64(set[11]);wc,wok:=wordUint64(set[8]);aid,_:=bytes32Arg(agreementID)
	if !sok||!wok||!wordBool(set[12])||!sameWord(set[0],aid)||ss!=2||uint64(windowIndex)>=wc{return Challenge{},time.Time{},ErrInactiveAssignment}
	raw,err=r.call2(ctx,r.Contracts.Settlement,"windowState(bytes32,uint32)",sid,uintWord(uint64(windowIndex)),"latest");if err!=nil{return Challenge{},time.Time{},err}
	ws,err:=abiWords(raw,1);if err!=nil{return Challenge{},time.Time{},err};wsv,ok:=wordUint64(ws[0]);if !ok||wsv!=1{return Challenge{},time.Time{},ErrInactiveAssignment}
	raw,err=r.call2(ctx,r.Contracts.Settlement,"windowTiming(bytes32,uint32)",sid,uintWord(uint64(windowIndex)),"latest");if err!=nil{return Challenge{},time.Time{},err}
	tw,err:=abiWords(raw,2);if err!=nil{return Challenge{},time.Time{},err};epoch,eok:=wordUint64(tw[0]);deadline,dok:=wordUint64(tw[1])
	if !eok||!dok||epoch==0||deadline<epoch||epoch<uint64(snap.Assignment.StartTime.Unix())||epoch>uint64(snap.Assignment.EndTime.Unix()){return Challenge{},time.Time{},ErrInvalidChainState}
	raw,err=r.call3(ctx,r.Contracts.Settlement,"canonicalChallengeId(bytes32,uint32,uint64)",aid,uintWord(uint64(windowIndex)),uintWord(epoch),"latest");if err!=nil{return Challenge{},time.Time{},err}
	ch,err:=abiWords(raw,1);if err!=nil||zeroWord(ch[0]){return Challenge{},time.Time{},ErrInvalidChainState}
	return Challenge{AgreementID:snap.Assignment.AgreementID,CommitmentID:snap.Assignment.CommitmentID,ChallengeID:wordHex(ch[0]),Epoch:time.Unix(int64(epoch),0).UTC()},time.Unix(int64(deadline),0).UTC(),nil
}

func (r RPCStorageReader) uniqueSettlement(ctx context.Context,agreementID string)(string,error){
	id,err:=bytes32Arg(agreementID);if err!=nil{return "",err}
	h:=keccak256([]byte("StorageSettlementOpened(bytes32,bytes32,address,address,address,address,uint256,uint32)"));topic0:="0x"+hex.EncodeToString(h[:])
	latest,err:=r.Backend.LatestBlock(ctx);if err!=nil{return "",err};batch:=r.LogBatchSize;if batch==0{batch=2048};found:=""
	for from:=r.StartBlock;from<=latest.Number;{to:=from+batch-1;if to<from||to>latest.Number{to=latest.Number};logs,err:=r.Backend.Logs(ctx,from,to,LogFilter{Addresses:[]string{r.Contracts.Settlement},Topics:[][]string{{topic0},{},{wordHex(id)}}});if err!=nil{return "",err};for _,log:=range logs{if log.Removed||len(log.Topics)<3||!equalHex(log.Topics[2],wordHex(id)){return "",ErrInvalidChainState};candidate:=log.Topics[1];if found!=""&&!equalHex(found,candidate){return "",ErrInvalidChainState};found=candidate};if to==latest.Number{break};from=to+1}
	if found==""{return "",ErrInactiveAssignment};return found,nil
}

func (r RPCStorageReader) validate()error{for _,a:=range []string{r.Contracts.Agreement,r.Contracts.Commitment,r.Contracts.Capacity,r.Contracts.Settlement,r.Contracts.Scheme,r.Contracts.Manifest}{if !validHexAddress(a){return ErrInvalidChainState}};return nil}
func (r RPCStorageReader) now()time.Time{if r.Now!=nil{return r.Now().UTC()};return time.Now().UTC()}
func (r RPCStorageReader) call1(ctx context.Context,to,sig string,a [32]byte,tag string)(string,error){return r.Backend.EthCall(ctx,to,calldata(sig,a),tag)}
func (r RPCStorageReader) call2(ctx context.Context,to,sig string,a,b [32]byte,tag string)(string,error){return r.Backend.EthCall(ctx,to,calldata(sig,a,b),tag)}
func (r RPCStorageReader) call3(ctx context.Context,to,sig string,a,b,c [32]byte,tag string)(string,error){return r.Backend.EthCall(ctx,to,calldata(sig,a,b,c),tag)}
func calldata(sig string,args ...[32]byte)string{h:=keccak256([]byte(sig));b:=make([]byte,4+32*len(args));copy(b,h[:4]);for i,a:=range args{copy(b[4+i*32:],a[:])};return "0x"+hex.EncodeToString(b)}
func bytes32Arg(v string)([32]byte,error){var out [32]byte;v=strings.TrimSpace(v);if strings.HasPrefix(strings.ToLower(v),"0x"){v=v[2:]};if len(v)!=64||!isHex(v){return out,ErrInvalidChainState};b,err:=hex.DecodeString(v);if err!=nil{return out,ErrInvalidChainState};copy(out[:],b);return out,nil}
func uintWord(v uint64)(o [32]byte){binary.BigEndian.PutUint64(o[24:],v);return}
func abiWords(v string,min int)([][32]byte,error){if !validHexData(v){return nil,ErrInvalidChainState};b,err:=hex.DecodeString(strings.TrimPrefix(v,"0x"));if err!=nil||len(b)%32!=0||len(b)/32<min{return nil,ErrInvalidChainState};out:=make([][32]byte,len(b)/32);for i:=range out{copy(out[i][:],b[i*32:(i+1)*32])};return out,nil}
func wordHex(w [32]byte)string{return "0x"+hex.EncodeToString(w[:])}
func wordUint64(w [32]byte)(uint64,bool){for _,b:=range w[:24]{if b!=0{return 0,false}};return binary.BigEndian.Uint64(w[24:]),true}
func wordBool(w [32]byte)bool{for _,b:=range w[:31]{if b!=0{return false}};return w[31]==1}
func zeroWord(w [32]byte)bool{var z [32]byte;return w==z}
func sameWord(a,b [32]byte)bool{return a==b}

func keccak256(msg []byte)[32]byte{var st [25]uint64;const rate=136;for len(msg)>=rate{absorbBlock(&st,msg[:rate]);keccakF1600(&st);msg=msg[rate:]};var last [rate]byte;copy(last[:],msg);last[len(msg)]=0x01;last[rate-1]|=0x80;absorbBlock(&st,last[:]);keccakF1600(&st);var out [32]byte;for i:=0;i<4;i++{binary.LittleEndian.PutUint64(out[i*8:],st[i])};return out}
func absorbBlock(st *[25]uint64,b []byte){for i:=0;i<len(b)/8;i++{st[i]^=binary.LittleEndian.Uint64(b[i*8:])}}
func keccakF1600(a *[25]uint64){rc:=[24]uint64{0x1,0x8082,0x800000000000808a,0x8000000080008000,0x808b,0x80000001,0x8000000080008081,0x8000000000008009,0x8a,0x88,0x80008009,0x8000000a,0x8000808b,0x800000000000008b,0x8000000000008089,0x8000000000008003,0x8000000000008002,0x8000000000000080,0x800a,0x800000008000000a,0x8000000080008081,0x8000000000008080,0x80000001,0x8000000080008008};rot:=[25]int{0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14};for _,round:=range rc{var c,d [5]uint64;for x:=0;x<5;x++{c[x]=a[x]^a[x+5]^a[x+10]^a[x+15]^a[x+20]};for x:=0;x<5;x++{d[x]=c[(x+4)%5]^bits.RotateLeft64(c[(x+1)%5],1)};for i:=0;i<25;i++{a[i]^=d[i%5]};var b [25]uint64;for x:=0;x<5;x++{for y:=0;y<5;y++{i:=x+5*y;b[y+5*((2*x+3*y)%5)]=bits.RotateLeft64(a[i],rot[i])}};for x:=0;x<5;x++{for y:=0;y<5;y++{i:=x+5*y;a[i]=b[i]^((^b[(x+1)%5+5*y])&b[(x+2)%5+5*y])}};a[0]^=round}}

var _ CanonicalStorageReader = RPCStorageReader{}
