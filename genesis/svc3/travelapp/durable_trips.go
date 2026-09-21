package travelapp

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "os"
 "path/filepath"
 "sort"
 "strings"
 "sync"
 "syscall"
 "time"
)

// DurableTripStore is a single-process, local-disk development/staging store.
// It is NOT a distributed database or a substitute for production multi-node
// storage. The exclusive lock is retained for the lifetime of this instance.
// The filesystem must provide atomic same-directory rename and durable fsync.
type DurableTripStore struct {
 mu sync.Mutex
 dir string
 lock *os.File
 trips map[string]Trip
 closed bool
}

type tripSnapshot struct {
 Version int `json:"version"`
 Trips []Trip `json:"trips"`
}

const maxTripSnapshotBytes int64 = 8 << 20

// OpenDurableTripStore requires an existing private directory. It refuses
// symlinked directories, shared permissions and concurrent writer instances.
func OpenDurableTripStore(dir string) (*DurableTripStore,error) {
 if dir=="" {return nil,errors.New("trip directory required")}
 dir,err:=filepath.Abs(dir);if err!=nil{return nil,err}
 info,err:=os.Lstat(dir);if err!=nil{return nil,err}
 if !info.IsDir()||info.Mode()&os.ModeSymlink!=0||info.Mode().Perm()&0077!=0 {return nil,errors.New("trip directory must be private and not a symlink")}
 lockPath:=filepath.Join(dir,"trips.lock")
 // Linux CI/deployment: O_NOFOLLOW disallows a preexisting lock symlink.
 fd,err:=syscall.Open(lockPath,syscall.O_CREAT|syscall.O_RDWR|syscall.O_NOFOLLOW,0600)
 if err!=nil{return nil,fmt.Errorf("open trip lock: %w",err)}
 lock:=os.NewFile(uintptr(fd),lockPath)
 if err:=lock.Chmod(0600);err!=nil {lock.Close();return nil,err}
 if err:=syscall.Flock(fd,syscall.LOCK_EX|syscall.LOCK_NB);err!=nil {lock.Close();return nil,fmt.Errorf("trip directory already in use: %w",err)}
 store:=&DurableTripStore{dir:dir,lock:lock,trips:map[string]Trip{}}
 if err:=store.load();err!=nil {store.Close();return nil,err}
 return store,nil
}

func (s *DurableTripStore) load() error {
 path:=filepath.Join(s.dir,"trips.json")
 info,err:=os.Lstat(path)
 if errors.Is(err,os.ErrNotExist){return nil};if err!=nil{return err}
 if !info.Mode().IsRegular()||info.Mode().Perm()&0077!=0||info.Size()>maxTripSnapshotBytes {return errors.New("unsafe trip snapshot")}
 fd,err:=syscall.Open(path,syscall.O_RDONLY|syscall.O_NOFOLLOW,0);if err!=nil{return err}
 file:=os.NewFile(uintptr(fd),path);defer file.Close()
 decoder:=json.NewDecoder(io.LimitReader(file,maxTripSnapshotBytes+1));decoder.DisallowUnknownFields()
 var snap tripSnapshot
 if err:=decoder.Decode(&snap);err!=nil{return fmt.Errorf("decode trip snapshot: %w",err)}
 var extra any
 if err:=decoder.Decode(&extra);!errors.Is(err,io.EOF){return errors.New("trailing trip snapshot data")}
 if snap.Version!=1 {return errors.New("unsupported trip snapshot version")}
 for _,t:=range snap.Trips {
  if err:=validateTrip(t);err!=nil||t.CreatedAt.IsZero()||t.UpdatedAt.Before(t.CreatedAt)||t.UpdatedAt.IsZero(){return errors.New("invalid persisted trip")}
  if _,exists:=s.trips[t.ID];exists{return errors.New("duplicate persisted trip")}
  s.trips[t.ID]=copyTrip(t)
 }
 return nil
}

func (s *DurableTripStore) requireOpen()error {if s==nil||s.closed{return errors.New("trip store closed")};return nil}

// persistLocked does not mutate s.trips until a complete snapshot has been
// written, synced and atomically renamed. Any failure leaves the prior map.
func (s *DurableTripStore) persistLocked(next map[string]Trip)error {
 ids:=make([]string,0,len(next));for id:=range next {ids=append(ids,id)};sort.Strings(ids)
 snap:=tripSnapshot{Version:1,Trips:make([]Trip,0,len(ids))}
 for _,id:=range ids {snap.Trips=append(snap.Trips,copyTrip(next[id]))}
 payload,err:=json.Marshal(snap);if err!=nil{return err}
 if int64(len(payload))>maxTripSnapshotBytes{return errors.New("trip storage capacity exceeded")}
 tmp,err:=os.CreateTemp(s.dir,".trips-*.tmp");if err!=nil{return err}
 name:=tmp.Name();defer os.Remove(name)
 if err=tmp.Chmod(0600);err!=nil {tmp.Close();return err}
 if _,err=tmp.Write(payload);err!=nil {tmp.Close();return err}
 if err=tmp.Sync();err!=nil {tmp.Close();return err}
 if err=tmp.Close();err!=nil{return err}
 if err=os.Rename(name,filepath.Join(s.dir,"trips.json"));err!=nil{return err}
 dirFile,err:=os.Open(s.dir);if err!=nil{return err};err=dirFile.Sync();closeErr:=dirFile.Close();if err!=nil{return err};if closeErr!=nil{return closeErr}
 s.trips=next
 return nil
}

func (s *DurableTripStore) Create(ctx context.Context,owner string,trip Trip)(Trip,error) {
 if err:=ctx.Err();err!=nil{return Trip{},err}
 if strings.TrimSpace(owner)==""{return Trip{},ErrTripUnauthorized}
 trip.OwnerID=owner;if trip.Visibility==""{trip.Visibility=TripPrivate}
 if err:=validateTrip(trip);err!=nil{return Trip{},err}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return Trip{},err}
 if _,exists:=s.trips[trip.ID];exists{return Trip{},ErrTripConflict}
 now:=time.Now().UTC();trip.CreatedAt=now;trip.UpdatedAt=now
 next:=make(map[string]Trip,len(s.trips)+1);for id,t:=range s.trips{next[id]=t};next[trip.ID]=copyTrip(trip)
 if err:=s.persistLocked(next);err!=nil{return Trip{},err}
 return copyTrip(trip),nil
}

func (s *DurableTripStore) ListOwned(ctx context.Context,owner string)([]Trip,error) {
 if err:=ctx.Err();err!=nil{return nil,err};if strings.TrimSpace(owner)==""{return nil,ErrTripUnauthorized}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return nil,err}
 out:=make([]Trip,0);for _,t:=range s.trips{if t.OwnerID==owner{out=append(out,copyTrip(t))}}
 sort.Slice(out,func(i,j int)bool{return out[i].ID<out[j].ID});return out,nil
}
func (s *DurableTripStore) GetOwned(ctx context.Context,owner,id string)(Trip,error) {
 if err:=ctx.Err();err!=nil{return Trip{},err};if strings.TrimSpace(owner)==""{return Trip{},ErrTripUnauthorized}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return Trip{},err}
 t,ok:=s.trips[id];if !ok||t.OwnerID!=owner{return Trip{},ErrTripNotFound};return copyTrip(t),nil
}
func (s *DurableTripStore) Replace(ctx context.Context,owner string,nextTrip Trip)(Trip,error) {
 if err:=ctx.Err();err!=nil{return Trip{},err};if strings.TrimSpace(owner)==""{return Trip{},ErrTripUnauthorized}
 nextTrip.OwnerID=owner;if err:=validateTrip(nextTrip);err!=nil{return Trip{},err}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return Trip{},err}
 old,ok:=s.trips[nextTrip.ID];if !ok||old.OwnerID!=owner{return Trip{},ErrTripNotFound}
 nextTrip.CreatedAt=old.CreatedAt;nextTrip.UpdatedAt=time.Now().UTC()
 next:=make(map[string]Trip,len(s.trips));for id,t:=range s.trips{next[id]=t};next[nextTrip.ID]=copyTrip(nextTrip)
 if err:=s.persistLocked(next);err!=nil{return Trip{},err};return copyTrip(nextTrip),nil
}
func (s *DurableTripStore) Delete(ctx context.Context,owner,id string)error {
 if err:=ctx.Err();err!=nil{return err};if strings.TrimSpace(owner)==""{return ErrTripUnauthorized}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return err}
 t,ok:=s.trips[id];if !ok||t.OwnerID!=owner{return ErrTripNotFound}
 next:=make(map[string]Trip,len(s.trips)-1);for key,value:=range s.trips{if key!=id{next[key]=value}}
 return s.persistLocked(next)
}
// Public projection intentionally excludes PRIVATE and UNLISTED. Consumers
// must re-resolve PUBLIC references against current publication permissions.
func (s *DurableTripStore) ListPublic(ctx context.Context)([]Trip,error) {
 if err:=ctx.Err();err!=nil{return nil,err}
 s.mu.Lock();defer s.mu.Unlock();if err:=s.requireOpen();err!=nil{return nil,err}
 out:=make([]Trip,0);for _,t:=range s.trips{if t.Visibility==TripPublic{out=append(out,copyTrip(t))}}
 sort.Slice(out,func(i,j int)bool{return out[i].ID<out[j].ID});return out,nil
}
func (s *DurableTripStore) Close()error {
 if s==nil{return nil};s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil};s.closed=true
 if s.lock==nil{return nil}
 err:=syscall.Flock(int(s.lock.Fd()),syscall.LOCK_UN);closeErr:=s.lock.Close();if err!=nil{return err};return closeErr
}

var _ TripRepository = (*DurableTripStore)(nil)
