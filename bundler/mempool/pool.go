package mempool

import (
	"errors"
	"fmt"
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
)

type Config struct {
	MaxOperations int
	MaxPerSender int
	TTL time.Duration
}

func (c Config) Validate() error {
	if c.MaxOperations <= 0 { return errors.New("mempool max operations must be positive") }
	if c.MaxPerSender <= 0 { return errors.New("mempool max per sender must be positive") }
	if c.MaxPerSender > c.MaxOperations { return errors.New("mempool max per sender cannot exceed total capacity") }
	if c.TTL <= 0 { return errors.New("mempool TTL must be positive") }
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
		return AddResult{},ErrNonceConflict
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
