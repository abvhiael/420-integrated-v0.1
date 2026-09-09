package storage

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestKeccakSelectorMatchesEthereum(t *testing.T){
	if got:=calldata("getCommitment(bytes32)",[32]byte{}); !strings.HasPrefix(got,"0x7795820c") { t.Fatalf("selector=%s",got[:10]) }
}

func TestRPCStorageReaderHydratesCanonicalShardPlacement(t *testing.T){
	now:=time.Unix(1_800_000_000,0).UTC(); start:=uint64(now.Add(-time.Minute).Unix()); end:=uint64(now.Add(time.Hour).Unix())
	agreementID:=wordWithByte(0xaa); commitmentID:=wordWithByte(0xcc); reservationID:=wordWithByte(0xdd); schemeID:=wordWithByte(0xee); nodeID:=wordWithByte(0x44)
	controller:=wordWithByte(0x11); objectID:=wordWithByte(0x22); objectRoot:=wordWithByte(0x55); manifestHash:=wordWithByte(0x33); manifestID:=wordWithByte(0x66); shardRoot:=wordWithByte(0x77)
	agreement:=make([][32]byte,18); agreement[0]=controller; agreement[2]=objectID; agreement[3]=objectRoot; agreement[4]=manifestHash; agreement[7]=schemeID; agreement[8]=commitmentID; agreement[9]=reservationID; agreement[10]=uintWord(10); agreement[11]=uintWord(start); agreement[12]=uintWord(end); agreement[13]=uintWord(1800); agreement[14]=uintWord(1); agreement[15]=uintWord(1); agreement[16]=uintWord(2); agreement[17]=uintWord(1)
	commit:=make([][32]byte,10); commit[1]=nodeID; commit[2]=schemeID; commit[3]=objectRoot; commit[6]=uintWord(10); commit[7]=uintWord(start); commit[8]=uintWord(end); commit[9]=uintWord(1)
	reservation:=make([][32]byte,6); reservation[0]=nodeID; reservation[1]=agreementID; reservation[2]=uintWord(10); reservation[3]=uintWord(end+10); reservation[4]=uintWord(1); reservation[5]=uintWord(1)
	scheme:=make([][32]byte,6); scheme[3]=uintWord(300); scheme[4]=uintWord(1); scheme[5]=uintWord(1)
	manifest:=make([][32]byte,13); manifest[0]=controller; manifest[1]=objectID; manifest[2]=objectRoot; manifest[3]=manifestHash; manifest[6]=uintWord(10); manifest[8]=uintWord(1); manifest[9]=uintWord(1); manifest[10]=uintWord(1); manifest[11]=uintWord(1); manifest[12]=uintWord(1)
	placement:=make([][32]byte,8); placement[0]=manifestID; placement[1]=agreementID; placement[2]=commitmentID; placement[3]=nodeID; placement[4]=shardRoot; placement[5]=uintWord(6); placement[6]=uintWord(0); placement[7]=uintWord(1)
	responses:=[]string{encodeWords(agreement),encodeWords(commit),encodeWords(reservation),encodeWords([][32]byte{uintWord(1)}),encodeWords(scheme),encodeWords([][32]byte{manifestID}),encodeWords(manifest),encodeWords(placement)}
	server:=rpcSequenceServer(t,responses); defer server.Close()
	r:=RPCStorageReader{Backend:RPCBackend{URL:server.URL,Client:server.Client()},Contracts:testContracts(),Now:func()time.Time{return now}}
	snap,err:=r.AssignmentByAgreement(context.Background(),wordHex(agreementID)); if err!=nil{t.Fatal(err)}
	wantRoot:=strings.TrimPrefix(wordHex(shardRoot),"0x")
	if snap.Assignment.CommitmentID!=wordHex(commitmentID)||snap.Assignment.NodeID!=wordHex(nodeID)||snap.Assignment.SizeBytes!=6||snap.Assignment.ShardRoot!=wantRoot||snap.WindowCount!=3||!snap.Assignment.Active{t.Fatalf("snap=%+v",snap)}
	if snap.Assignment.ShardRoot==strings.TrimPrefix(wordHex(objectRoot),"0x"){t.Fatal("assignment used object root instead of shard root")}
}

func TestRPCStorageReaderFailsClosedOnUnsealedManifest(t *testing.T){
	now:=time.Unix(1_800_000_000,0).UTC(); start:=uint64(now.Add(-time.Minute).Unix()); end:=uint64(now.Add(time.Hour).Unix())
	aid:=wordWithByte(1); cid:=wordWithByte(2); rid:=wordWithByte(3); sid:=wordWithByte(4); nid:=wordWithByte(5); controller:=wordWithByte(6); obj:=wordWithByte(7); root:=wordWithByte(8); mh:=wordWithByte(9); mid:=wordWithByte(10)
	a:=make([][32]byte,18);a[0]=controller;a[2]=obj;a[3]=root;a[4]=mh;a[7]=sid;a[8]=cid;a[9]=rid;a[10]=uintWord(10);a[11]=uintWord(start);a[12]=uintWord(end);a[13]=uintWord(1800);a[14]=uintWord(1);a[15]=uintWord(1);a[16]=uintWord(2);a[17]=uintWord(1)
	c:=make([][32]byte,10);c[1]=nid;c[2]=sid;c[3]=root;c[6]=uintWord(10);c[7]=uintWord(start);c[8]=uintWord(end);c[9]=uintWord(1)
	rv:=make([][32]byte,6);rv[0]=nid;rv[1]=aid;rv[2]=uintWord(10);rv[3]=uintWord(end+10);rv[4]=uintWord(1);rv[5]=uintWord(1)
	scheme:=make([][32]byte,6);scheme[3]=uintWord(300);scheme[4]=uintWord(1);scheme[5]=uintWord(1)
	manifest:=make([][32]byte,13);manifest[0]=controller;manifest[1]=obj;manifest[2]=root;manifest[3]=mh;manifest[8]=uintWord(1);manifest[9]=uintWord(1);manifest[10]=uintWord(1);manifest[11]=uintWord(0);manifest[12]=uintWord(1)
	server:=rpcSequenceServer(t,[]string{encodeWords(a),encodeWords(c),encodeWords(rv),encodeWords([][32]byte{uintWord(1)}),encodeWords(scheme),encodeWords([][32]byte{mid}),encodeWords(manifest)});defer server.Close()
	r:=RPCStorageReader{Backend:RPCBackend{URL:server.URL,Client:server.Client()},Contracts:testContracts(),Now:func()time.Time{return now}}
	if _,err:=r.AssignmentByAgreement(context.Background(),wordHex(aid));!errors.Is(err,ErrInvalidChainState){t.Fatalf("got %v",err)}
}

func TestRPCStorageReaderFailsClosedOnReservationMismatch(t *testing.T){
	now:=time.Unix(1_800_000_000,0).UTC(); start:=uint64(now.Add(-time.Minute).Unix()); end:=uint64(now.Add(time.Hour).Unix())
	aid:=wordWithByte(1); cid:=wordWithByte(2); rid:=wordWithByte(3); sid:=wordWithByte(4); nid:=wordWithByte(5); root:=wordWithByte(6)
	a:=make([][32]byte,18);a[0]=wordWithByte(10);a[2]=wordWithByte(11);a[3]=root;a[4]=wordWithByte(12);a[7]=sid;a[8]=cid;a[9]=rid;a[10]=uintWord(10);a[11]=uintWord(start);a[12]=uintWord(end);a[13]=uintWord(1800);a[14]=uintWord(1);a[15]=uintWord(1);a[16]=uintWord(2);a[17]=uintWord(1)
	c:=make([][32]byte,10);c[1]=nid;c[2]=sid;c[3]=root;c[6]=uintWord(10);c[7]=uintWord(start);c[8]=uintWord(end);c[9]=uintWord(1)
	rv:=make([][32]byte,6);rv[0]=wordWithByte(9);rv[1]=aid;rv[2]=uintWord(10);rv[3]=uintWord(end+10);rv[4]=uintWord(1);rv[5]=uintWord(1)
	server:=rpcSequenceServer(t,[]string{encodeWords(a),encodeWords(c),encodeWords(rv)});defer server.Close()
	r:=RPCStorageReader{Backend:RPCBackend{URL:server.URL,Client:server.Client()},Contracts:testContracts(),Now:func()time.Time{return now}}
	if _,err:=r.AssignmentByAgreement(context.Background(),wordHex(aid));!errors.Is(err,ErrInactiveAssignment){t.Fatalf("got %v",err)}
}

func TestEthCallRejectsMalformedResult(t *testing.T){
	server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,_ *http.Request){_,_=w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"nothex"}`))}));defer server.Close()
	_,err:= (RPCBackend{URL:server.URL,Client:server.Client()}).EthCall(context.Background(),testContracts().Agreement,"0x1234","latest")
	if !errors.Is(err,ErrInvalidChainState){t.Fatalf("got %v",err)}
}

func rpcSequenceServer(t *testing.T,responses []string)*httptest.Server{
	t.Helper();i:=0
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){var req struct{Method string `json:"method"`};if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{t.Fatal(err)};if req.Method!="eth_call"{t.Fatalf("method=%s",req.Method)};if i>=len(responses){t.Fatalf("extra call")};resp:=responses[i];i++;w.Header().Set("Content-Type","application/json");_,_=w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"`+resp+`"}`))}))
}
func encodeWords(words [][32]byte)string{b:=make([]byte,32*len(words));for i,w:=range words{copy(b[i*32:],w[:])};return "0x"+hex.EncodeToString(b)}
func wordWithByte(b byte)(w [32]byte){w[31]=b;return}
func testContracts()RPCStorageContracts{return RPCStorageContracts{Agreement:"0x1111111111111111111111111111111111111111",Commitment:"0x2222222222222222222222222222222222222222",Capacity:"0x3333333333333333333333333333333333333333",Settlement:"0x4444444444444444444444444444444444444444",Scheme:"0x5555555555555555555555555555555555555555",Manifest:"0x6666666666666666666666666666666666666666"}}
