package storage

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrRepairRPC = errors.New("repair rpc lifecycle failed")

type RepairShardTransferer interface {
	RepairShardTransferred(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID string) (bool, error)
	TransferRepairShard(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID string) error
}

type RPCRepairContracts struct {
	Agreement  string
	Commitment string
	Capacity   string
	Manifest   string
}

type RPCRepairLifecycleWriter struct {
	Backend      RPCBackend
	Contracts    RPCRepairContracts
	ConsumerFrom string
	ProviderFrom string
	Transferer   RepairShardTransferer
	PollInterval time.Duration
	ReceiptWait  time.Duration
}

func (w RPCRepairLifecycleWriter) EnsureAgreement(ctx context.Context, intent RepairExecutionIntent) (string, error) {
	if err := w.validate(); err != nil { return "", err }
	nonce := repairNonce(intent)
	offer, err := bytes32Arg(intent.Candidate.OfferID); if err != nil { return "", ErrRepairRPC }
	objectID, err := bytes32Arg(intent.ObjectID); if err != nil { return "", ErrRepairRPC }
	agreementID, err := w.canonicalAgreementID(ctx, offer, objectID, nonce); if err != nil { return "", err }
	if _, err := w.getAgreement(ctx, agreementID); err == nil { return wordHex(agreementID), nil }
	contentRoot, err := bytes32Arg(intent.Lifecycle.ContentRoot); if err != nil { return "", ErrRepairRPC }
	manifestHash, err := bytes32Arg(intent.ManifestHash); if err != nil { return "", ErrRepairRPC }
	storageClass, err := bytes32Arg(intent.Lifecycle.StorageClass); if err != nil { return "", ErrRepairRPC }
	repairPolicy, err := bytes32Arg(intent.Lifecycle.RepairPolicyHash); if err != nil { return "", ErrRepairRPC }
	proofScheme, err := bytes32Arg(intent.Lifecycle.ProofSchemeID); if err != nil { return "", ErrRepairRPC }
	data := fixedCalldata("proposeAgreement(bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint128,uint64,uint64,uint64,uint32,uint32,uint256)",
		offer, objectID, contentRoot, manifestHash, storageClass, repairPolicy, proofScheme,
		uintWord(intent.Shard.SizeBytes), uintWord(intent.Lifecycle.StartTime), uintWord(intent.Lifecycle.EndTime), uintWord(intent.Lifecycle.ProofInterval),
		uintWord(uint64(intent.DataShards)), uintWord(uint64(intent.TotalShards)), nonce)
	if err := w.sendAndWait(ctx, w.ConsumerFrom, w.Contracts.Agreement, data); err != nil { return "", err }
	return wordHex(agreementID), nil
}

func (w RPCRepairLifecycleWriter) EnsureCommitment(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error) {
	if err := w.validate(); err != nil { return "", err }
	commitmentID := repairCommitmentID(intent)
	if _, err := w.getCommitment(ctx, commitmentID); err == nil { return wordHex(commitmentID), nil }
	nodeID, err := bytes32Arg(intent.Candidate.NodeID); if err != nil { return "", ErrRepairRPC }
	proofScheme, err := bytes32Arg(intent.Lifecycle.ProofSchemeID); if err != nil { return "", ErrRepairRPC }
	contentRoot, err := bytes32Arg(intent.Lifecycle.ContentRoot); if err != nil { return "", ErrRepairRPC }
	shardRoot, err := bytes32Arg(intent.Shard.ShardRoot); if err != nil { return "", ErrRepairRPC }
	metadata := repairMetadataID(intent)
	data := fixedCalldata("registerCommitment(bytes32,bytes32,bytes32,bytes32,bytes32,uint128,uint64,uint64,bytes32)", commitmentID, nodeID, proofScheme, contentRoot, shardRoot, uintWord(intent.Shard.SizeBytes), uintWord(intent.Lifecycle.StartTime), uintWord(intent.Lifecycle.EndTime), metadata)
	if err := w.sendAndWait(ctx, w.ProviderFrom, w.Contracts.Commitment, data); err != nil { return "", err }
	return wordHex(commitmentID), nil
}

func (w RPCRepairLifecycleWriter) EnsureCapacityReservation(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error) {
	if err := w.validate(); err != nil { return "", err }
	nodeID, err := bytes32Arg(intent.Candidate.NodeID); if err != nil { return "", ErrRepairRPC }
	aid, err := bytes32Arg(agreementID); if err != nil { return "", ErrRepairRPC }
	reservationID, err := w.canonicalReservationID(ctx, nodeID, aid); if err != nil { return "", err }
	if ok, _ := w.reservationActive(ctx, reservationID); ok { return wordHex(reservationID), nil }
	data := fixedCalldata("reserveCapacity(bytes32,bytes32,uint128,uint64)", nodeID, aid, uintWord(intent.Shard.SizeBytes), uintWord(intent.Lifecycle.EndTime))
	if err := w.sendAndWait(ctx, w.ProviderFrom, w.Contracts.Capacity, data); err != nil { return "", err }
	return wordHex(reservationID), nil
}

func (w RPCRepairLifecycleWriter) EnsureAgreementActive(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID, reservationID string) error {
	aw, err := w.getAgreement(ctx, mustBytes32(agreementID)); if err == nil {
		state, ok := wordUint64(aw[16]); if ok && state == 2 { return nil }
	}
	data := fixedCalldata("activateAgreement(bytes32,bytes32,bytes32)", mustBytes32(agreementID), mustBytes32(commitmentID), mustBytes32(reservationID))
	return w.sendAndWait(ctx, w.ProviderFrom, w.Contracts.Agreement, data)
}

func (w RPCRepairLifecycleWriter) EnsureShardTransferred(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID string) error {
	if w.Transferer == nil { return ErrRepairRPC }
	ok, err := w.Transferer.RepairShardTransferred(ctx, intent, agreementID, commitmentID); if err != nil { return err }
	if ok { return nil }
	return w.Transferer.TransferRepairShard(ctx, intent, agreementID, commitmentID)
}

func (w RPCRepairLifecycleWriter) EnsurePlacementReplaced(ctx context.Context, intent RepairExecutionIntent, agreementID string) error {
	manifestID := mustBytes32(intent.ManifestID)
	current, err := w.placementAt(ctx, manifestID, intent.Shard.ShardIndex)
	if err == nil && equalHex(wordHex(current[1]), agreementID) { return nil }
	data := fixedCalldata("replacePlacement(bytes32,uint32,bytes32)", manifestID, uintWord(uint64(intent.Shard.ShardIndex)), mustBytes32(agreementID))
	return w.sendAndWait(ctx, w.ConsumerFrom, w.Contracts.Manifest, data)
}

func (w RPCRepairLifecycleWriter) ReadRepairLifecycle(ctx context.Context, intent RepairExecutionIntent) (RepairLifecycleState, error) {
	if err := w.validate(); err != nil { return RepairLifecycleState{}, err }
	offer := mustBytes32(intent.Candidate.OfferID); objectID := mustBytes32(intent.ObjectID); nonce := repairNonce(intent)
	aid, err := w.canonicalAgreementID(ctx, offer, objectID, nonce); if err != nil { return RepairLifecycleState{}, err }
	state := RepairLifecycleState{AgreementID: wordHex(aid)}
	aw, err := w.getAgreement(ctx, aid)
	if err == nil {
		state.CommitmentID = wordHex(aw[8]); state.CapacityReservationID = wordHex(aw[9])
		s, ok := wordUint64(aw[16]); state.AgreementActive = ok && s == 2
	}
	if w.Transferer != nil && state.CommitmentID != "" && !zeroWord(mustBytes32(state.CommitmentID)) {
		state.ShardTransferred, _ = w.Transferer.RepairShardTransferred(ctx, intent, state.AgreementID, state.CommitmentID)
	}
	if p, err := w.placementAt(ctx, mustBytes32(intent.ManifestID), intent.Shard.ShardIndex); err == nil { state.PlacementReplaced = equalHex(wordHex(p[1]), state.AgreementID) }
	return state, nil
}

func (w RPCRepairLifecycleWriter) validate() error {
	if !validHexAddress(w.Contracts.Agreement) || !validHexAddress(w.Contracts.Commitment) || !validHexAddress(w.Contracts.Capacity) || !validHexAddress(w.Contracts.Manifest) || !validHexAddress(w.ConsumerFrom) || !validHexAddress(w.ProviderFrom) { return ErrRepairRPC }
	return nil
}

func (w RPCRepairLifecycleWriter) sendAndWait(ctx context.Context, from, to string, data []byte) error {
	var txHash string
	if err := w.Backend.call(ctx, "eth_sendTransaction", []interface{}{map[string]interface{}{"from":from,"to":to,"data":"0x"+hex.EncodeToString(data)}}, &txHash); err != nil || !validHash32(txHash) { return ErrRepairRPC }
	poll := w.PollInterval; if poll <= 0 { poll = 250*time.Millisecond }; wait := w.ReceiptWait; if wait <= 0 { wait = 30*time.Second }
	deadline := time.Now().Add(wait)
	for {
		if err := ctx.Err(); err != nil { return err }; if time.Now().After(deadline) { return context.DeadlineExceeded }
		var receipt *struct{ Status string `json:"status"`; Hash string `json:"transactionHash"` }
		err := w.Backend.call(ctx, "eth_getTransactionReceipt", []interface{}{txHash}, &receipt)
		if err == nil && receipt != nil { if receipt.Status != "0x1" || !equalHex(receipt.Hash, txHash) { return ErrRepairRPC }; return nil }
		if err != nil && !errors.Is(err, ErrRPC) { return err }
		t := time.NewTimer(poll); select { case <-ctx.Done(): t.Stop(); return ctx.Err(); case <-t.C: }
	}
}

func (w RPCRepairLifecycleWriter) canonicalAgreementID(ctx context.Context, offer, objectID, nonce [32]byte) ([32]byte,error) { raw,err:=w.Backend.EthCall(ctx,w.Contracts.Agreement,calldata("canonicalAgreementId(address,bytes32,bytes32,uint256)",addressWord(w.ConsumerFrom),offer,objectID,nonce),"latest"); if err!=nil{return [32]byte{},err}; words,err:=abiWords(raw,1); if err!=nil{return [32]byte{},err}; return words[0],nil }
func (w RPCRepairLifecycleWriter) canonicalReservationID(ctx context.Context,node,agreement [32]byte)([32]byte,error){ raw,err:=w.Backend.EthCall(ctx,w.Contracts.Capacity,calldata("canonicalReservationId(bytes32,bytes32)",node,agreement),"latest"); if err!=nil{return [32]byte{},err}; words,err:=abiWords(raw,1); if err!=nil{return [32]byte{},err}; return words[0],nil }
func (w RPCRepairLifecycleWriter) getAgreement(ctx context.Context,id [32]byte)([][32]byte,error){ raw,err:=w.Backend.EthCall(ctx,w.Contracts.Agreement,calldata("getAgreement(bytes32)",id),"latest"); if err!=nil{return nil,err}; return abiWords(raw,18) }
func (w RPCRepairLifecycleWriter) getCommitment(ctx context.Context,id [32]byte)([][32]byte,error){ raw,err:=w.Backend.EthCall(ctx,w.Contracts.Commitment,calldata("getCommitment(bytes32)",id),"latest"); if err!=nil{return nil,err}; return abiWords(raw,10) }
func (w RPCRepairLifecycleWriter) reservationActive(ctx context.Context,id [32]byte)(bool,error){ raw,err:=w.Backend.EthCall(ctx,w.Contracts.Capacity,calldata("isReservationActive(bytes32)",id),"latest"); if err!=nil{return false,err}; words,err:=abiWords(raw,1); if err!=nil{return false,err}; return wordBool(words[0]),nil }
func (w RPCRepairLifecycleWriter) placementAt(ctx context.Context,manifest [32]byte,index uint32)([][32]byte,error){ raw,err:=w.Backend.EthCall(ctx,w.Contracts.Manifest,calldata("placementAt(bytes32,uint32)",manifest,uintWord(uint64(index))),"latest"); if err!=nil{return nil,err}; return abiWords(raw,8) }

func fixedCalldata(signature string, words ...[32]byte) []byte { sig:=keccak256([]byte(signature)); out:=make([]byte,4+32*len(words)); copy(out[:4],sig[:4]); for i,w:=range words{copy(out[4+i*32:4+(i+1)*32],w[:])}; return out }
func addressWord(v string) [32]byte { var w [32]byte; s:=strings.TrimPrefix(strings.ToLower(strings.TrimSpace(v)),"0x"); b,_:=hex.DecodeString(s); copy(w[12:],b); return w }
func mustBytes32(v string) [32]byte { w,err:=bytes32Arg(v); if err!=nil { return [32]byte{} }; return w }
func repairNonce(intent RepairExecutionIntent) [32]byte { return keccak256([]byte(fmt.Sprintf("420/REPAIR/AGREEMENT/V1|%s|%d|%s",strings.ToLower(intent.ManifestID),intent.Shard.ShardIndex,strings.ToLower(intent.Candidate.NodeID)))) }
func repairCommitmentID(intent RepairExecutionIntent) [32]byte { return keccak256([]byte(fmt.Sprintf("420/REPAIR/COMMITMENT/V1|%s|%d|%s",strings.ToLower(intent.ManifestID),intent.Shard.ShardIndex,strings.ToLower(intent.Candidate.NodeID)))) }
func repairMetadataID(intent RepairExecutionIntent) [32]byte { return keccak256([]byte(fmt.Sprintf("420/REPAIR/METADATA/V1|%s|%d",strings.ToLower(intent.ManifestID),intent.Shard.ShardIndex))) }
