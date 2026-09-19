package mempool

import (
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

var (
	ErrFull = errors.New("UserOperation mempool is full")
	ErrSenderLimit = errors.New("sender UserOperation limit reached")
	ErrNonceConflict = errors.New("sender nonce already has a different UserOperation")
	ErrReplacementUnderpriced = errors.New("replacement maxFeePerGas bump is insufficient")
)

type Config struct {
	MaxOperations int
	MaxPerSender int
	TTL time.Duration
	ReplacementBumpBps uint64
}

func (c Config) Validate() error {
	if c.MaxOperations <= 0 { return errors.New("mempool max operations must be positive") }
	if c.MaxPerSender <= 0 { return errors.New("mempool max per sender must be positive") }
	if c.MaxPerSender > c.MaxOperations { return errors.New("mempool max per sender cannot exceed total capacity") }
	if c.TTL <= 0 { return errors.New("mempool TTL must be positive") }
	if c.ReplacementBumpBps > 10000 { return errors.New("replacement bump cannot exceed 10000 bps") }
	return nil
}

type Entry struct {
	Hash string
	Operation userop.PackedUserOperation
	Evidence simulation.Evidence
	AdmittedAt time.Time
	ExpiresAt time.Time
}

type AddResult struct {
	Hash string
	Duplicate bool
	Replaced bool
}

type Pool struct {
	mu sync.Mutex
	cfg Config
	byHash map[string]Entry
	bySenderNonce map[string]string
	perSender map[string]int
}

func New(cfg Config)(*Pool,error){
	if cfg.ReplacementBumpBps==0 { cfg.ReplacementBumpBps=1000 }
	if err:=cfg.Validate(); err!=nil { return nil,err }
	return &Pool{
		cfg:cfg,
		byHash:make(map[string]Entry),
		bySenderNonce:make(map[string]string),
		perSender:make(map[string]int),
	},nil
}

func (p *Pool) Add(op userop.PackedUserOperation,evidence simulation.Evidence,now time.Time)(AddResult,error){
	if now.IsZero() { return AddResult{},errors.New("admission time is required") }
	canonical,err:=op.Canonicalize()
	if err!=nil { return AddResult{},fmt.Errorf("canonical UserOperation required: %w",err) }
	hash:=strings.ToLower(evidence.UserOpHash)
	if !validHash(hash) { return AddResult{},errors.New("simulation evidence hash is invalid") }
	if !evidence.ExecutionSucceeded { return AddResult{},errors.New("successful simulation evidence is required") }
	expectedHash,err:=userop.Hash(evidence.ChainID,evidence.EntryPoint,op)
	if err!=nil { return AddResult{},fmt.Errorf("simulation evidence domain is invalid: %w",err) }
	if strings.ToLower(expectedHash)!=hash { return AddResult{},errors.New("simulation evidence does not match UserOperation") }

	sender:=strings.ToLower(op.Sender)
	nonceKey:=senderNonceKey(sender,canonical.Nonce.String())

	p.mu.Lock()
	defer p.mu.Unlock()
	p.pruneLocked(now)

	if existing,ok:=p.byHash[hash]; ok {
		if existing.ExpiresAt.After(now) { return AddResult{Hash:hash,Duplicate:true},nil }
		p.removeLocked(existing)
	}
	if existingHash,ok:=p.bySenderNonce[nonceKey]; ok && existingHash!=hash {
		existing,exists:=p.byHash[existingHash]
		if !exists { return AddResult{},ErrNonceConflict }
		oldFee,err:=maxFeePerGas(existing.Operation)
		if err!=nil { return AddResult{},ErrNonceConflict }
		newFee,err:=maxFeePerGas(op)
		if err!=nil { return AddResult{},ErrNonceConflict }
		if !replacementFeeSufficient(oldFee,newFee,p.cfg.ReplacementBumpBps) {
			return AddResult{},ErrReplacementUnderpriced
		}
		delete(p.byHash,existing.Hash)
		entry:=Entry{
			Hash:hash,Operation:op,Evidence:evidence,
			AdmittedAt:existing.AdmittedAt,ExpiresAt:existing.ExpiresAt,
		}
		p.byHash[hash]=entry
		p.bySenderNonce[nonceKey]=hash
		return AddResult{Hash:hash,Replaced:true},nil
	}
	if len(p.byHash)>=p.cfg.MaxOperations { return AddResult{},ErrFull }
	if p.perSender[sender]>=p.cfg.MaxPerSender { return AddResult{},ErrSenderLimit }

	entry:=Entry{
		Hash:hash,Operation:op,Evidence:evidence,
		AdmittedAt:now.UTC(),ExpiresAt:now.Add(p.cfg.TTL).UTC(),
	}
	p.byHash[hash]=entry
	p.bySenderNonce[nonceKey]=hash
	p.perSender[sender]++
	return AddResult{Hash:hash},nil
}

func (p *Pool) Get(hash string,now time.Time)(Entry,bool){
	p.mu.Lock()
	defer p.mu.Unlock()
	p.pruneLocked(now)
	entry,ok:=p.byHash[strings.ToLower(hash)]
	return entry,ok
}

func (p *Pool) Remove(hash string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	entry,ok:=p.byHash[strings.ToLower(hash)]
	if !ok { return false }
	p.removeLocked(entry)
	return true
}

func (p *Pool) Snapshot(now time.Time) []Entry {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.pruneLocked(now)
	out:=make([]Entry,0,len(p.byHash))
	for _,entry:=range p.byHash { out=append(out,entry) }
	sort.Slice(out,func(i,j int)bool{
		if out[i].AdmittedAt.Equal(out[j].AdmittedAt) { return out[i].Hash<out[j].Hash }
		return out[i].AdmittedAt.Before(out[j].AdmittedAt)
	})
	return out
}

func (p *Pool) Len(now time.Time) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.pruneLocked(now)
	return len(p.byHash)
}

func (p *Pool) pruneLocked(now time.Time){
	for _,entry:=range p.byHash {
		if !entry.ExpiresAt.After(now) { p.removeLocked(entry) }
	}
}

func (p *Pool) removeLocked(entry Entry){
	delete(p.byHash,entry.Hash)
	canonical,err:=entry.Operation.Canonicalize()
	if err==nil {
		sender:=strings.ToLower(entry.Operation.Sender)
		delete(p.bySenderNonce,senderNonceKey(sender,canonical.Nonce.String()))
		if p.perSender[sender]<=1 { delete(p.perSender,sender) } else { p.perSender[sender]-- }
	}
}

func senderNonceKey(sender,nonce string) string { return sender+":"+nonce }

func validHash(v string) bool {
	if len(v)!=66 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdef",c) { return false } }
	return true
}


func maxFeePerGas(op userop.PackedUserOperation)(*big.Int,error){
	canonical,err:=op.Canonicalize()
	if err!=nil{return nil,err}
	return new(big.Int).SetBytes(canonical.GasFees[16:]),nil
}

func replacementFeeSufficient(oldFee,newFee *big.Int,bumpBps uint64)bool{
	if oldFee==nil || newFee==nil{return false}
	scale:=new(big.Int).SetUint64(10000+bumpBps)
	required:=new(big.Int).Mul(new(big.Int).Set(oldFee),scale)
	required.Add(required,big.NewInt(9999))
	required.Div(required,big.NewInt(10000))
	minPlusOne:=new(big.Int).Add(new(big.Int).Set(oldFee),big.NewInt(1))
	if required.Cmp(minPlusOne)<0{required=minPlusOne}
	return newFee.Cmp(required)>=0
}


func (p *Pool) Restore(entries []Entry,now time.Time) error {
	if now.IsZero(){return errors.New("restore time is required")}
	byHash:=make(map[string]Entry,len(entries))
	bySenderNonce:=make(map[string]string,len(entries))
	perSender:=map[string]int{}
	for _,entry:=range entries{
		if !entry.ExpiresAt.After(now){continue}
		if entry.AdmittedAt.IsZero() || entry.ExpiresAt.IsZero() || entry.ExpiresAt.Before(entry.AdmittedAt){
			return errors.New("invalid mempool recovery timestamps")
		}
		canonical,err:=entry.Operation.Canonicalize()
		if err!=nil{return fmt.Errorf("invalid recovered UserOperation: %w",err)}
		h:=strings.ToLower(entry.Hash)
		if !validHash(h){return errors.New("invalid recovered UserOperation hash")}
		if strings.ToLower(entry.Evidence.UserOpHash)!=h || !entry.Evidence.ExecutionSucceeded{
			return errors.New("invalid recovered simulation evidence")
		}
		expected,err:=userop.Hash(entry.Evidence.ChainID,entry.Evidence.EntryPoint,entry.Operation)
		if err!=nil || strings.ToLower(expected)!=h{return errors.New("recovered evidence does not match UserOperation")}
		if _,ok:=byHash[h];ok{return errors.New("duplicate recovered UserOperation hash")}
		sender:=strings.ToLower(entry.Operation.Sender)
		nonceKey:=senderNonceKey(sender,canonical.Nonce.String())
		if _,ok:=bySenderNonce[nonceKey];ok{return errors.New("duplicate recovered sender nonce")}
		if len(byHash)>=p.cfg.MaxOperations{return ErrFull}
		if perSender[sender]>=p.cfg.MaxPerSender{return ErrSenderLimit}
		entry.Hash=h
		entry.AdmittedAt=entry.AdmittedAt.UTC()
		entry.ExpiresAt=entry.ExpiresAt.UTC()
		byHash[h]=entry
		bySenderNonce[nonceKey]=h
		perSender[sender]++
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.byHash=byHash
	p.bySenderNonce=bySenderNonce
	p.perSender=perSender
	return nil
}
