package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/420integrated/420-integrated/events/model"
	locationmodel "github.com/420integrated/420-integrated/location/model"
)

const schemaVersion="420-events-store-v1"

var (
	ErrNotFound=errors.New("event not found")
	ErrExists=errors.New("event already exists")
	ErrVersion=errors.New("event version conflict")
)

type snapshot struct { Schema string `json:"schema"`; Events []model.Event `json:"events"` }

type FileStore struct {
	mu sync.RWMutex
	path string
	items map[string]model.Event
}

func OpenFileStore(path string)(*FileStore,error){
	path=strings.TrimSpace(path)
	if path=="" { return nil,errors.New("event repository path is required") }
	s:=&FileStore{path:path,items:map[string]model.Event{}}
	if err:=s.load(); err!=nil { return nil,err }
	return s,nil
}

func (s *FileStore) Ready(context.Context) error {
	s.mu.RLock(); defer s.mu.RUnlock()
	if strings.TrimSpace(s.path)=="" { return errors.New("event repository path is not configured") }
	info,err:=os.Stat(filepath.Dir(s.path))
	if err!=nil { return fmt.Errorf("event repository parent unavailable: %w",err) }
	if !info.IsDir(){ return errors.New("event repository parent is not a directory") }
	return nil
}

func (s *FileStore) Create(event model.Event)(model.Event,error){
	if err:=event.Validate(); err!=nil { return model.Event{},err }
	s.mu.Lock(); defer s.mu.Unlock()
	if _,ok:=s.items[event.ID]; ok { return model.Event{},ErrExists }
	s.items[event.ID]=model.CloneEvent(event)
	if err:=s.persistLocked(); err!=nil { delete(s.items,event.ID); return model.Event{},err }
	return model.CloneEvent(event),nil
}

func (s *FileStore) Get(id string)(model.Event,error){
	s.mu.RLock(); defer s.mu.RUnlock()
	event,ok:=s.items[strings.TrimSpace(id)]
	if !ok { return model.Event{},ErrNotFound }
	return model.CloneEvent(event),nil
}

func (s *FileStore) Update(event model.Event,expectedVersion uint32)(model.Event,error){
	if err:=event.Validate(); err!=nil { return model.Event{},err }
	s.mu.Lock(); defer s.mu.Unlock()
	current,ok:=s.items[event.ID]
	if !ok { return model.Event{},ErrNotFound }
	if current.Version!=expectedVersion || event.Version!=expectedVersion+1 { return model.Event{},ErrVersion }
	if current.CreatedAt!=event.CreatedAt || current.Organizer!=event.Organizer { return model.Event{},errors.New("event immutable fields changed") }
	before:=current
	s.items[event.ID]=model.CloneEvent(event)
	if err:=s.persistLocked(); err!=nil { s.items[event.ID]=before; return model.Event{},err }
	return model.CloneEvent(event),nil
}

func (s *FileStore) ListAll() []model.Event {
	s.mu.RLock(); defer s.mu.RUnlock()
	out:=make([]model.Event,0,len(s.items))
	for _,event:=range s.items { out=append(out,model.CloneEvent(event)) }
	sort.Slice(out,func(i,j int)bool{return out[i].ID<out[j].ID})
	return out
}

func (s *FileStore) ListByOrganizer(organizer locationmodel.SubjectRef) []model.Event {
	s.mu.RLock(); defer s.mu.RUnlock()
	out:=[]model.Event{}
	for _,event:=range s.items {
		if event.Organizer==organizer { out=append(out,model.CloneEvent(event)) }
	}
	sort.Slice(out,func(i,j int)bool{
		if !out[i].StartAt.Equal(out[j].StartAt){ return out[i].StartAt.Before(out[j].StartAt) }
		return out[i].ID<out[j].ID
	})
	return out
}

func (s *FileStore) load() error {
	parent:=filepath.Dir(s.path)
	if err:=os.MkdirAll(parent,0o700); err!=nil { return fmt.Errorf("create event repository directory: %w",err) }
	payload,err:=os.ReadFile(s.path)
	if errors.Is(err,os.ErrNotExist){ return s.persistLocked() }
	if err!=nil { return fmt.Errorf("read event repository: %w",err) }
	if len(payload)==0 { return errors.New("event repository is empty/corrupt") }
	var snap snapshot
	if err:=json.Unmarshal(payload,&snap); err!=nil { return fmt.Errorf("decode event repository: %w",err) }
	if snap.Schema!=schemaVersion { return fmt.Errorf("unsupported event repository schema %q",snap.Schema) }
	for _,event:=range snap.Events {
		if err:=event.Validate(); err!=nil { return fmt.Errorf("invalid persisted event %q: %w",event.ID,err) }
		if _,exists:=s.items[event.ID]; exists { return fmt.Errorf("duplicate persisted event id %q",event.ID) }
		s.items[event.ID]=model.CloneEvent(event)
	}
	return nil
}

func (s *FileStore) persistLocked() error {
	events:=make([]model.Event,0,len(s.items))
	for _,event:=range s.items { events=append(events,model.CloneEvent(event)) }
	sort.Slice(events,func(i,j int)bool{return events[i].ID<events[j].ID})
	payload,err:=json.MarshalIndent(snapshot{Schema:schemaVersion,Events:events},"","  ")
	if err!=nil { return fmt.Errorf("encode event repository: %w",err) }
	payload=append(payload,byte(10))
	parent:=filepath.Dir(s.path)
	tmp,err:=os.CreateTemp(parent,".events-*.tmp")
	if err!=nil { return fmt.Errorf("create event repository temp file: %w",err) }
	tmpName:=tmp.Name(); defer os.Remove(tmpName)
	if err:=tmp.Chmod(0o600); err!=nil { tmp.Close(); return err }
	if _,err:=tmp.Write(payload); err!=nil { tmp.Close(); return err }
	if err:=tmp.Sync(); err!=nil { tmp.Close(); return err }
	if err:=tmp.Close(); err!=nil { return err }
	if err:=os.Rename(tmpName,s.path); err!=nil { return err }
	return os.Chmod(s.path,0o600)
}
