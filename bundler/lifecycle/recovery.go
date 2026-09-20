package lifecycle

import (
	"errors"
	"sort"
	"strings"
	"time"
)

type PendingSubmission struct {
	UserOpHash string
	EntryPoint string
	StartedAt time.Time
}

type RecoverySnapshot struct {
	Pending []PendingSubmission
	Submissions []Submission
}

func (s *Store) BeginSubmission(userOpHash,entryPoint string,startedAt time.Time) error {
	if !hash32(userOpHash) || !address(entryPoint) || startedAt.IsZero(){return errors.New("invalid submission intent")}
	hash:=strings.ToLower(userOpHash)
	s.mu.Lock()
	defer s.mu.Unlock()
	if _,ok:=s.submissions[hash];ok{return nil}
	if s.pending==nil{s.pending=map[string]PendingSubmission{}}
	if existing,ok:=s.pending[hash];ok{
		if existing.EntryPoint!=strings.ToLower(entryPoint){return errors.New("conflicting submission intent")}
		return nil
	}
	s.pending[hash]=PendingSubmission{UserOpHash:hash,EntryPoint:strings.ToLower(entryPoint),StartedAt:startedAt.UTC()}
	return nil
}

func (s *Store) AbortSubmission(userOpHash string){
	s.mu.Lock();defer s.mu.Unlock()
	delete(s.pending,strings.ToLower(userOpHash))
}

func (s *Store) HasSubmissionOrPending(userOpHash string) bool {
	hash:=strings.ToLower(userOpHash)
	s.mu.RLock();defer s.mu.RUnlock()
	if _,ok:=s.submissions[hash];ok{return true}
	_,ok:=s.pending[hash]
	return ok
}

func (s *Store) SnapshotRecovery() RecoverySnapshot {
	s.mu.RLock();defer s.mu.RUnlock()
	out:=RecoverySnapshot{}
	for _,v:=range s.pending{out.Pending=append(out.Pending,v)}
	for _,v:=range s.submissions{out.Submissions=append(out.Submissions,v)}
	sort.Slice(out.Pending,func(i,j int)bool{return out.Pending[i].UserOpHash<out.Pending[j].UserOpHash})
	sort.Slice(out.Submissions,func(i,j int)bool{return out.Submissions[i].UserOpHash<out.Submissions[j].UserOpHash})
	return out
}

func (s *Store) RestoreRecovery(snapshot RecoverySnapshot) error {
	nextPending:=map[string]PendingSubmission{}
	nextSubmissions:=map[string]Submission{}
	for _,v:=range snapshot.Pending{
		if !hash32(v.UserOpHash)||!address(v.EntryPoint)||v.StartedAt.IsZero(){return errors.New("invalid pending recovery entry")}
		h:=strings.ToLower(v.UserOpHash)
		if _,ok:=nextPending[h];ok{return errors.New("duplicate pending recovery entry")}
		nextPending[h]=PendingSubmission{UserOpHash:h,EntryPoint:strings.ToLower(v.EntryPoint),StartedAt:v.StartedAt.UTC()}
	}
	for _,v:=range snapshot.Submissions{
		if !hash32(v.UserOpHash)||!hash32(v.TransactionHash)||!address(v.EntryPoint)||v.SubmittedAt.IsZero(){return errors.New("invalid submission recovery entry")}
		h:=strings.ToLower(v.UserOpHash)
		if _,ok:=nextSubmissions[h];ok{return errors.New("duplicate submission recovery entry")}
		if _,ok:=nextPending[h];ok{return errors.New("recovery entry cannot be pending and submitted")}
		nextSubmissions[h]=Submission{UserOpHash:h,TransactionHash:strings.ToLower(v.TransactionHash),EntryPoint:strings.ToLower(v.EntryPoint),SubmittedAt:v.SubmittedAt.UTC()}
	}
	s.mu.Lock();defer s.mu.Unlock()
	s.pending=nextPending
	s.submissions=nextSubmissions
	return nil
}
