package main

import (
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	reeferreview "github.com/420integrated/420-integrated/reefer-review"
)

func run(args []string) error {
	if len(args)<3 {return errors.New("usage: reefer-backup backup <output> label=path... | restore <archive> <new-empty-directory>")}
	key,err:=hex.DecodeString(strings.TrimSpace(os.Getenv("REEFER_REVIEW_BACKUP_KEY_HEX")))
	if err!=nil || len(key)!=32 {return errors.New("REEFER_REVIEW_BACKUP_KEY_HEX must hold an externally managed 256-bit key")}
	switch args[0] {
	case "backup":
		if len(args)<4 {return errors.New("backup requires named source files")}
		sources:=map[string]string{}
		for _,arg:=range args[2:] {
			name,path,found:=strings.Cut(arg,"=")
			if !found || name=="" || path=="" {return errors.New("source argument must be label=path")}
			if _,ok:=sources[name];ok{return errors.New("duplicate backup label")}
			sources[name]=path
		}
		blob,err:=reeferreview.CreateEncryptedBackup(sources,key)
		if err!=nil{return err}
		file,err:=os.OpenFile(args[1],os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600)
		if err!=nil{return err}
		if _,err=file.Write(blob);err!=nil{_ =file.Close();_ =os.Remove(args[1]);return err}
		if err=file.Sync();err!=nil{_ =file.Close();_ =os.Remove(args[1]);return err}
		return file.Close()
	case "restore":
		if len(args)!=3{return errors.New("restore requires archive and new destination")}
		info,err:=os.Stat(args[1])
		if err!=nil{return err}
		if !info.Mode().IsRegular() || info.Size()>180<<20{return errors.New("archive size or file type rejected")}
		blob,err:=os.ReadFile(args[1])
		if err!=nil{return err}
		return reeferreview.RestoreEncryptedBackup(blob,key,args[2])
	default:
		return fmt.Errorf("unknown command %q",args[0])
	}
}

func main(){
	if err:=run(os.Args[1:]);err!=nil{log.Fatal(err)}
}
