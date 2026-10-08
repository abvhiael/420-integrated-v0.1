package reeferreview

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
)

const backupSchema = "420-reefer-review-backup-v1"
const backupMaxFileSize int64 = 32 << 20
const backupMaxTotalSize int64 = 128 << 20

var backupNamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

type backupRecord struct {
	SHA256 [32]byte `json:"sha256"`
	Data []byte `json:"data"`
}
type backupPayload struct {
	Schema string `json:"schema"`
	Files map[string]backupRecord `json:"files"`
}

// CreateEncryptedBackup makes an authenticated, bounded backup of explicitly
// selected durable local files. Keys are external: never persist them in the archive.
// Remote 420 Storage provider objects must be backed up by their own qualified provider.
func CreateEncryptedBackup(sources map[string]string, key []byte) ([]byte,error) {
	if len(key)!=32 || len(sources)==0 || len(sources)>32 {return nil,ErrInvalidInput}
	payload:=backupPayload{Schema:backupSchema,Files:make(map[string]backupRecord)}
	var total int64
	for label,path:=range sources {
		if !backupNamePattern.MatchString(label) || path=="" {return nil,ErrInvalidInput}
		info,err:=os.Lstat(path)
		if err!=nil{return nil,err}
		if !info.Mode().IsRegular() || info.Size()>backupMaxFileSize {return nil,ErrInvalidInput}
		total+=info.Size()
		if total>backupMaxTotalSize {return nil,ErrInvalidInput}
		file,err:=os.Open(path)
		if err!=nil{return nil,err}
		data,readErr:=io.ReadAll(io.LimitReader(file,backupMaxFileSize+1))
		closeErr:=file.Close()
		if readErr!=nil{return nil,readErr}
		if closeErr!=nil{return nil,closeErr}
		if int64(len(data))>backupMaxFileSize{return nil,ErrInvalidInput}
		payload.Files[label]=backupRecord{SHA256:sha256.Sum256(data),Data:data}
	}
	plain,err:=json.Marshal(payload)
	if err!=nil{return nil,err}
	block,err:=aes.NewCipher(key)
	if err!=nil{return nil,err}
	gcm,err:=cipher.NewGCM(block)
	if err!=nil{return nil,err}
	nonce:=make([]byte,gcm.NonceSize())
	if _,err=rand.Read(nonce);err!=nil{return nil,err}
	out:=append([]byte("RRB1"),nonce...)
	return gcm.Seal(out,nonce,plain,[]byte(backupSchema)),nil
}

// RestoreEncryptedBackup restores into a newly created, empty operator-selected
// directory. It never overwrites live data or follows preexisting path symlinks.
func RestoreEncryptedBackup(blob,key []byte,dest string) error {
	if len(key)!=32 || len(blob)<4+12+16 || string(blob[:4])!="RRB1" || dest=="" {return ErrInvalidInput}
	block,err:=aes.NewCipher(key)
	if err!=nil{return err}
	gcm,err:=cipher.NewGCM(block)
	if err!=nil{return err}
	nonceSize:=gcm.NonceSize()
	if len(blob)<4+nonceSize+gcm.Overhead(){return ErrInvalidInput}
	plain,err:=gcm.Open(nil,blob[4:4+nonceSize],blob[4+nonceSize:],[]byte(backupSchema))
	if err!=nil{return fmt.Errorf("%w: archive authentication failed",ErrInvalidInput)}
	var payload backupPayload
	if err=json.Unmarshal(plain,&payload);err!=nil{return ErrInvalidInput}
	if payload.Schema!=backupSchema || len(payload.Files)==0 || len(payload.Files)>32 {return ErrInvalidInput}
	var total int64
	for label,record:=range payload.Files {
		if !backupNamePattern.MatchString(label) || int64(len(record.Data))>backupMaxFileSize {return ErrInvalidInput}
		total+=int64(len(record.Data))
		if total>backupMaxTotalSize || sha256.Sum256(record.Data)!=record.SHA256 {return ErrInvalidInput}
	}
	if err=os.Mkdir(dest,0700);err!=nil{return err}
	rollback:=true
	defer func(){if rollback {_=os.RemoveAll(dest)}}()
	for label,record:=range payload.Files {
		name:=filepath.Join(dest,label)
		f,e:=os.OpenFile(name,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600)
		if e!=nil{return e}
		if _,e=f.Write(record.Data);e!=nil{_ =f.Close();return e}
		if e=f.Sync();e!=nil{_ =f.Close();return e}
		if e=f.Close();e!=nil{return e}
	}
	d,e:=os.Open(dest)
	if e!=nil{return e}
	defer d.Close()
	if e=d.Sync();e!=nil{return e}
	rollback=false
	return nil
}

var _ = errors.Is
