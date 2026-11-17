package systemcall

import (
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestSequenceJournalFaults(t *testing.T){
 path:=filepath.Join(t.TempDir(),"seq.json")
 s:=FileSequenceStore{Path:path}
 m:=SequenceManager{Store:s}
 a:=SequenceAnchor{ChainID:420,ExecutionBlock:100,BlockHash:[32]byte{1},LastSequence:9}
 if e:=s.Store(a);e!=nil{t.Fatal(e)}
 raw,e:=os.ReadFile(path);if e!=nil{t.Fatal(e)}
 for name,bad:=range map[string]string{"truncated":"{","corrupted":strings.Replace(string(raw),"\"lastSequence\": 9","\"lastSequence\": 8",1),"unknown":strings.Replace(string(raw),"{","{\"extra\":true,",1),"trailing":string(raw)+"{}","legacy":strings.Replace(string(raw),"sequence-v2","sequence-v1",1)}{
 t.Run(name,func(t *testing.T){if e:=os.WriteFile(path,[]byte(bad),0600);e!=nil{t.Fatal(e)};if _,e:=m.RequireCanonicalParent(a);e==nil{t.Fatal("invalid journal accepted")}})
 }
 if e=os.Remove(path);e!=nil{t.Fatal(e)}
 if _,e=m.RequireCanonicalParent(a);e==nil{t.Fatal("missing journal accepted")}
 if e=s.Store(a);e!=nil{t.Fatal(e)}
 // An obstructed destination must be reported as a failed write.
 bad:=FileSequenceStore{Path:filepath.Dir(path)}
 if e=bad.Store(a);e==nil{t.Fatal("write failure ignored")}
 if got,ok,e:=s.Load();e!=nil||!ok||got!=a{t.Fatalf("original state changed: %v %v %v",got,ok,e)}
}
