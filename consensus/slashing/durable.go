package slashing

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"syscall"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

// HistoryIdentity binds one journal to one validator key and network genesis.
// Protocol upgrades must retain this history, not create a new empty journal.
type HistoryIdentity struct {
	ChainID uint64
	Genesis ctypes.Root
	ValidatorID uint64
	PublicKey ctypes.BLSPubkey
}

type voteRecord struct {
	ValidatorID uint64
	Data ctypes.AttestationData
	Root ctypes.Root
}

type signedRecord struct {
	ValidatorID uint64
	Type string
	Slot uint64
	Incident ctypes.Root
	Root ctypes.Root
}

type historyPayload struct {
	Schema string
	Identity HistoryIdentity
	Signed []signedRecord
	Votes []voteRecord
}

type historyFile struct {
	Payload historyPayload
	Checksum [32]byte
}

type durableHistory struct {
	path string
	identity HistoryIdentity
	lock *os.File
}

var ErrHistoryUnavailable = errors.New("protected signing history unavailable")

func (d *durableHistory) checkIdentity(id uint64) error {
	if id != d.identity.ValidatorID { return ErrInvalidDuty }
	return nil
}

// InitializeHistory is an explicit, one-time provisioning operation for a key
// that has NEVER signed. Existing keys require an independently verified complete
// history. It never replaces an existing file.
func InitializeHistory(path string, id HistoryIdentity) error {
	d, err := lockHistory(path, id)
	if err != nil { return err }
	defer d.close()
	if _, err := os.Lstat(path); !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("%w: history already exists or cannot be inspected", ErrHistoryUnavailable)
	}
	return d.write(historyPayload{Schema: "420-slashing-history-v1", Identity: id}, true)
}

// OpenProtector never creates or resets signing history. The exclusive process
// lock must remain held for the entire lifetime of this protector.
func OpenProtector(path string, id HistoryIdentity) (*Protector, error) {
	d, err := lockHistory(path, id)
	if err != nil { return nil, err }
	p := NewProtector()
	payload, err := d.read()
	if err != nil { d.close(); return nil, err }
	for _, r := range payload.Signed {
		k := messageKey{ValidatorID:r.ValidatorID, Type:r.Type, Slot:r.Slot, Incident:r.Incident}
		var e error
		switch r.Type {
		case "proposal":
			if r.Incident != (ctypes.Root{}) { e = ErrInvalidDuty } else { e=p.CheckAndRecordProposal(r.ValidatorID,r.Slot,r.Root) }
		case "recovery":
			if r.Slot != 0 { e=ErrInvalidDuty } else { e=p.CheckAndRecordRecovery(r.ValidatorID,r.Incident,r.Root) }
		default: e=ErrInvalidDuty
		}
		if e != nil || r.ValidatorID != id.ValidatorID || p.signed[k] != r.Root {
			d.close(); return nil, fmt.Errorf("%w: invalid stored duty", ErrHistoryUnavailable)
		}
	}
	for _, v := range payload.Votes {
		if v.ValidatorID != id.ValidatorID || v.Root != v.Data.HashTreeRoot() || p.CheckAndRecordVote(v.ValidatorID,v.Data) != nil {
			d.close(); return nil, fmt.Errorf("%w: invalid stored vote", ErrHistoryUnavailable)
		}
	}
	p.disk=d
	return p,nil
}

func lockHistory(path string, id HistoryIdentity) (*durableHistory,error) {
	if path=="" || id.ChainID==0 || id.Genesis==(ctypes.Root{}) || id.PublicKey==(ctypes.BLSPubkey{}) {
		return nil,ErrInvalidDuty
	}
	abs,err:=filepath.Abs(path);if err!=nil{return nil,err}
	// Reject aliased directory paths and symlinks. Operators must use a private
	// directory on a local filesystem with durable fsync and flock semantics.
	dir:=filepath.Dir(abs)
	resolved,err:=filepath.EvalSymlinks(dir);if err!=nil||resolved!=dir{return nil,ErrHistoryUnavailable}
	st,err:=os.Stat(dir);if err!=nil||!st.IsDir()||st.Mode().Perm()&0077!=0{return nil,ErrHistoryUnavailable}
	f,err:=os.OpenFile(abs+".lock",os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW,0600)
	if err!=nil{return nil,err}
	st,err=f.Stat();if err!=nil||!st.Mode().IsRegular()||st.Mode().Perm()&0077!=0{f.Close();return nil,ErrHistoryUnavailable}
	if err=syscall.Flock(int(f.Fd()),syscall.LOCK_EX|syscall.LOCK_NB);err!=nil{f.Close();return nil,fmt.Errorf("%w: already locked: %v",ErrHistoryUnavailable,err)}
	return &durableHistory{path:abs,identity:id,lock:f},nil
}

func(d *durableHistory)close() error { return d.lock.Close() }

// Close permanently disables this instance before releasing its exclusive lock.
func(p *Protector)Close()error{
	p.mu.Lock();defer p.mu.Unlock()
	p.failed=ErrHistoryUnavailable
	if p.disk==nil{return nil}
	e:=p.disk.close();p.disk=nil;return e
}

func(d *durableHistory)read()(historyPayload,error){
	var h historyFile
	f,e:=os.OpenFile(d.path,os.O_RDONLY|syscall.O_NOFOLLOW,0)
	if e!=nil{return h.Payload,fmt.Errorf("%w: %v",ErrHistoryUnavailable,e)}
	defer f.Close()
	st,e:=f.Stat();if e!=nil||!st.Mode().IsRegular()||st.Mode().Perm()&0077!=0{return h.Payload,ErrHistoryUnavailable}
	raw,e:=io.ReadAll(f);if e!=nil{return h.Payload,e}
	dec:=json.NewDecoder(bytes.NewReader(raw));dec.DisallowUnknownFields()
	if e=dec.Decode(&h);e!=nil{return h.Payload,ErrHistoryUnavailable}
	if e=dec.Decode(new(any));e!=io.EOF{return h.Payload,ErrHistoryUnavailable}
	b,e:=json.Marshal(h.Payload)
	if e!=nil||sha256.Sum256(b)!=h.Checksum||h.Payload.Schema!="420-slashing-history-v1"||h.Payload.Identity!=d.identity{return h.Payload,ErrHistoryUnavailable}
	return h.Payload,nil
}

func(d *durableHistory)write(p historyPayload, initialize bool)error{
	b,e:=json.Marshal(p);if e!=nil{return e}
	raw,e:=json.Marshal(historyFile{Payload:p,Checksum:sha256.Sum256(b)});if e!=nil{return e}
	dir:=filepath.Dir(d.path)
	tmp,e:=os.CreateTemp(dir,".slashing-");if e!=nil{return e}
	defer os.Remove(tmp.Name());defer tmp.Close()
	if _,e=tmp.Write(raw);e!=nil{return e};if e=tmp.Sync();e!=nil{return e};if e=tmp.Close();e!=nil{return e}
	if initialize { e=os.Link(tmp.Name(),d.path) } else { e=os.Rename(tmp.Name(),d.path) }
	if e!=nil{return e}
	f,e:=os.Open(dir);if e!=nil{return e};defer f.Close()
	return f.Sync()
}

// CheckAndRecordVote derives the protected root from the full attestation,
// checking both slot and target checkpoint double votes and strict surrounds.
func(p *Protector)CheckAndRecordVote(id uint64,data ctypes.AttestationData)error{
	p.mu.Lock();defer p.mu.Unlock()
	if p.failed!=nil{return p.failed}
	if p.disk!=nil{if e:=p.disk.checkIdentity(id);e!=nil{return e}}
	if data.Source.Slot>=data.Target.Slot||data.Target.Slot>data.Slot||data.BlockRoot==(ctypes.Root{})||data.Target.Root==(ctypes.Root{})||data.Source.Root==(ctypes.Root{}){return ErrInvalidDuty}
	root:=data.HashTreeRoot()
	for _,v:=range p.votes{
		if v.ValidatorID!=id{continue}
		if v.Data==data{return nil}
		if v.Data.Slot==data.Slot||v.Data.Target.Slot==data.Target.Slot{return ErrDoubleAttestation}
		if (v.Data.Source.Slot<data.Source.Slot&&data.Target.Slot<v.Data.Target.Slot)||(data.Source.Slot<v.Data.Source.Slot&&v.Data.Target.Slot<data.Target.Slot){return ErrSurroundVote}
	}
	p.votes=append(p.votes,voteRecord{ValidatorID:id,Data:data,Root:root})
	return p.persistLocked()
}

func(p *Protector)persistLocked()error{
	if p.disk==nil{return nil}
	h:=historyPayload{Schema:"420-slashing-history-v1",Identity:p.disk.identity,Votes:p.votes}
	for k,r:=range p.signed{h.Signed=append(h.Signed,signedRecord{ValidatorID:k.ValidatorID,Type:k.Type,Slot:k.Slot,Incident:k.Incident,Root:r})}
	sort.Slice(h.Signed,func(i,j int)bool{
		a,b:=h.Signed[i],h.Signed[j];if a.Type!=b.Type{return a.Type<b.Type};if a.Slot!=b.Slot{return a.Slot<b.Slot};return bytes.Compare(a.Incident[:],b.Incident[:])<0
	})
	// Check the current durable file has not vanished or changed before replacing it.
	if _,e:=p.disk.read();e!=nil{p.failed=fmt.Errorf("%w: %v",ErrHistoryUnavailable,e);return p.failed}
	if e:=p.disk.write(h,false);e!=nil{p.failed=fmt.Errorf("%w: %v",ErrHistoryUnavailable,e);return p.failed}
	return nil
}
