package moderation

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

type Action string
type State string
type TargetKind string
type Reason string

const (
	ActionReport            Action = "REPORT"
	ActionHide              Action = "HIDE"
	ActionBlock             Action = "BLOCK"
	ActionMute              Action = "MUTE"
	ActionSuspend           Action = "SUSPEND"
	ActionAppeal            Action = "APPEAL"
	ActionModeratorDecision Action = "MODERATOR_DECISION"
	ActionRestore           Action = "RESTORE"
	ActionLock              Action = "LOCK"

	StateOpen      State = "OPEN"
	StateHidden    State = "HIDDEN"
	StateLocked    State = "LOCKED"
	StateSuspended State = "SUSPENDED"
	StateAppealed  State = "APPEALED"
	StateResolved  State = "RESOLVED"
	StateRestored  State = "RESTORED"

	TargetPost    TargetKind = "POST"
	TargetComment TargetKind = "COMMENT"
	TargetUser    TargetKind = "USER"
)

var (
	ErrInvalidInput     = errors.New("invalid input")
	ErrUnauthorized     = errors.New("unauthorized")
	ErrNotFound         = errors.New("not found")
	ErrInvalidTransition = errors.New("invalid transition")
	ErrAlreadyExists    = errors.New("already exists")
	ErrIdempotencyConflict = errors.New("idempotency conflict")
)

type CommunityAuthority interface {
	IsActiveMember(communityID, actorID model.ObjectID) bool
	HasRole(communityID, actorID model.ObjectID, role model.RoleID) bool
}

type ContentResolver interface {
	TargetCommunity(kind TargetKind, targetID model.ObjectID) (model.ObjectID, model.ObjectID, bool)
}

type Record struct {
	ID             model.ObjectID
	CaseID         model.ObjectID
	CommunityID    model.ObjectID
	TargetKind     TargetKind
	TargetID       model.ObjectID
	Action         Action
	Reason         Reason
	ActorID        model.ObjectID
	AffectedID     model.ObjectID
	ParentRecordID model.ObjectID
	PreviousState  State
	ResultState    State
	BodyRef        string
	BodySHA256     string
	Version        uint64
	CreatedAt      time.Time
}

type Case struct {
	ID          model.ObjectID
	CommunityID model.ObjectID
	TargetKind  TargetKind
	TargetID    model.ObjectID
	AffectedID  model.ObjectID
	State       State
	Locked      bool
	Hidden      bool
	Suspended   bool
	Version     uint64
	OpenedAt    time.Time
	UpdatedAt   time.Time
	LastRecordID model.ObjectID
}

type relationshipKey struct {
	Actor  model.ObjectID
	Target model.ObjectID
}

type idempotencyRecord struct {
	Fingerprint string
	ResultID    model.ObjectID
}

type Service struct {
	mu sync.RWMutex

	authority CommunityAuthority
	content   ContentResolver
	now       func() time.Time

	cases      map[model.ObjectID]Case
	records    map[model.ObjectID]Record
	caseLog    map[model.ObjectID][]model.ObjectID
	targetCase map[string]model.ObjectID
	blocked    map[relationshipKey]bool
	muted      map[relationshipKey]bool
	suspended  map[string]bool
	idempotency map[string]idempotencyRecord
}

func NewService(authority CommunityAuthority, content ContentResolver) (*Service, error) {
	if authority == nil || content == nil {
		return nil, ErrInvalidInput
	}
	return &Service{
		authority: authority,
		content: content,
		now: func() time.Time { return time.Now().UTC() },
		cases: make(map[model.ObjectID]Case),
		records: make(map[model.ObjectID]Record),
		caseLog: make(map[model.ObjectID][]model.ObjectID),
		targetCase: make(map[string]model.ObjectID),
		blocked: make(map[relationshipKey]bool),
		muted: make(map[relationshipKey]bool),
		suspended: make(map[string]bool),
		idempotency: make(map[string]idempotencyRecord),
	}, nil
}

func (s *Service) SetClockForTest(now func() time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.now = now
}

type OpenCaseRequest struct {
	RecordID       model.ObjectID
	CaseID         model.ObjectID
	CommunityID    model.ObjectID
	TargetKind     TargetKind
	TargetID       model.ObjectID
	Reason         Reason
	BodyRef        string
	BodySHA256     string
	IdempotencyKey string
}

func (s *Service) Report(actor model.ObjectID, req OpenCaseRequest) (Record, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validID(actor) || !validID(req.RecordID) || !validID(req.CaseID) || !validID(req.CommunityID) ||
		!validTargetKind(req.TargetKind) || !validID(req.TargetID) || !validReason(req.Reason) ||
		!validBody(req.BodyRef, req.BodySHA256) || !validKey(req.IdempotencyKey) {
		return Record{}, ErrInvalidInput
	}
	if !s.authority.IsActiveMember(req.CommunityID, actor) {
		return Record{}, ErrUnauthorized
	}
	var communityID model.ObjectID
	var affectedID model.ObjectID
	var ok bool
	if req.TargetKind == TargetUser {
		communityID = req.CommunityID
		affectedID = req.TargetID
		ok = s.authority.IsActiveMember(req.CommunityID, req.TargetID)
	} else {
		communityID, affectedID, ok = s.resolveTarget(req.TargetKind, req.TargetID)
	}
	if !ok || communityID != req.CommunityID {
		return Record{}, ErrNotFound
	}
	fp := fmt.Sprintf("report|%s|%s|%s|%s|%s", req.CaseID, req.CommunityID, req.TargetKind, req.TargetID, req.Reason)
	if r, hit, err := s.idempotent(actor, ActionReport, req.IdempotencyKey, fp); hit || err != nil {
		return r, err
	}
	if _, exists := s.cases[req.CaseID]; exists {
		return Record{}, ErrAlreadyExists
	}
	if _, exists := s.records[req.RecordID]; exists {
		return Record{}, ErrAlreadyExists
	}
	if _, exists := s.targetCase[targetKey(req.CommunityID, req.TargetKind, req.TargetID)]; exists {
		return Record{}, ErrAlreadyExists
	}
	now := s.now().UTC()
	c := Case{
		ID:req.CaseID, CommunityID:req.CommunityID, TargetKind:req.TargetKind, TargetID:req.TargetID,
		AffectedID:affectedID, State:StateOpen, Version:1, OpenedAt:now, UpdatedAt:now, LastRecordID:req.RecordID,
	}
	r := Record{
		ID:req.RecordID, CaseID:req.CaseID, CommunityID:req.CommunityID, TargetKind:req.TargetKind,
		TargetID:req.TargetID, Action:ActionReport, Reason:req.Reason, ActorID:actor, AffectedID:affectedID,
		PreviousState:"", ResultState:StateOpen, BodyRef:req.BodyRef, BodySHA256:req.BodySHA256, Version:1, CreatedAt:now,
	}
	s.cases[c.ID]=c
	s.records[r.ID]=r
	s.caseLog[c.ID]=[]model.ObjectID{r.ID}
	s.targetCase[targetKey(req.CommunityID, req.TargetKind, req.TargetID)]=c.ID
	s.remember(actor,ActionReport,req.IdempotencyKey,fp,r.ID)
	return r,nil
}

type ModerateRequest struct {
	RecordID       model.ObjectID
	CaseID         model.ObjectID
	Action         Action
	Reason         Reason
	BodyRef        string
	BodySHA256     string
	IdempotencyKey string
}

func (s *Service) Moderate(actor model.ObjectID, req ModerateRequest) (Record,error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validID(actor)||!validID(req.RecordID)||!validID(req.CaseID)||!validModeratorAction(req.Action)||
		!validReason(req.Reason)||!validBody(req.BodyRef,req.BodySHA256)||!validKey(req.IdempotencyKey) {
		return Record{},ErrInvalidInput
	}
	c,ok:=s.cases[req.CaseID]
	if !ok { return Record{},ErrNotFound }
	if !s.isModerator(c.CommunityID,actor) { return Record{},ErrUnauthorized }
	fp:=fmt.Sprintf("moderate|%s|%s|%s",req.CaseID,req.Action,req.Reason)
	if r,hit,err:=s.idempotent(actor,req.Action,req.IdempotencyKey,fp);hit||err!=nil{return r,err}
	if _,exists:=s.records[req.RecordID];exists{return Record{},ErrAlreadyExists}

	prev:=c.State
	switch req.Action {
	case ActionHide:
		if c.Hidden { return Record{},ErrInvalidTransition }
		c.Hidden=true
		c.State=StateHidden
	case ActionLock:
		if c.Locked { return Record{},ErrInvalidTransition }
		c.Locked=true
		c.State=StateLocked
	case ActionSuspend:
		if c.TargetKind!=TargetUser || c.Suspended { return Record{},ErrInvalidTransition }
		c.Suspended=true
		c.State=StateSuspended
		s.suspended[userScopeKey(c.CommunityID,c.TargetID)]=true
	case ActionRestore:
		if !c.Hidden && !c.Locked && !c.Suspended { return Record{},ErrInvalidTransition }
		c.Hidden=false
		c.Locked=false
		if c.Suspended {
			delete(s.suspended,userScopeKey(c.CommunityID,c.TargetID))
			c.Suspended=false
		}
		c.State=StateRestored
	case ActionModeratorDecision:
		if c.State!=StateAppealed { return Record{},ErrInvalidTransition }
		c.State=StateResolved
	default:
		return Record{},ErrInvalidInput
	}
	now:=s.now().UTC()
	c.Version++
	c.UpdatedAt=now
	c.LastRecordID=req.RecordID
	r:=Record{
		ID:req.RecordID,CaseID:c.ID,CommunityID:c.CommunityID,TargetKind:c.TargetKind,TargetID:c.TargetID,
		Action:req.Action,Reason:req.Reason,ActorID:actor,AffectedID:c.AffectedID,ParentRecordID:s.lastRecord(c.ID),
		PreviousState:prev,ResultState:c.State,BodyRef:req.BodyRef,BodySHA256:req.BodySHA256,Version:c.Version,CreatedAt:now,
	}
	s.cases[c.ID]=c
	s.appendRecord(r)
	s.remember(actor,req.Action,req.IdempotencyKey,fp,r.ID)
	return r,nil
}

type AppealRequest struct {
	RecordID       model.ObjectID
	CaseID         model.ObjectID
	Reason         Reason
	BodyRef        string
	BodySHA256     string
	IdempotencyKey string
}

func (s *Service) Appeal(actor model.ObjectID, req AppealRequest) (Record,error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validID(actor)||!validID(req.RecordID)||!validID(req.CaseID)||!validReason(req.Reason)||
		!validBody(req.BodyRef,req.BodySHA256)||!validKey(req.IdempotencyKey) {
		return Record{},ErrInvalidInput
	}
	c,ok:=s.cases[req.CaseID]
	if !ok{return Record{},ErrNotFound}
	if actor!=c.AffectedID{return Record{},ErrUnauthorized}
	if c.State!=StateHidden && c.State!=StateLocked && c.State!=StateSuspended && c.State!=StateResolved {
		return Record{},ErrInvalidTransition
	}
	fp:=fmt.Sprintf("appeal|%s|%s",req.CaseID,req.Reason)
	if r,hit,err:=s.idempotent(actor,ActionAppeal,req.IdempotencyKey,fp);hit||err!=nil{return r,err}
	if _,exists:=s.records[req.RecordID];exists{return Record{},ErrAlreadyExists}
	prev:=c.State
	now:=s.now().UTC()
	c.State=StateAppealed
	c.Version++
	c.UpdatedAt=now
	c.LastRecordID=req.RecordID
	r:=Record{
		ID:req.RecordID,CaseID:c.ID,CommunityID:c.CommunityID,TargetKind:c.TargetKind,TargetID:c.TargetID,
		Action:ActionAppeal,Reason:req.Reason,ActorID:actor,AffectedID:c.AffectedID,ParentRecordID:s.lastRecord(c.ID),
		PreviousState:prev,ResultState:StateAppealed,BodyRef:req.BodyRef,BodySHA256:req.BodySHA256,Version:c.Version,CreatedAt:now,
	}
	s.cases[c.ID]=c
	s.appendRecord(r)
	s.remember(actor,ActionAppeal,req.IdempotencyKey,fp,r.ID)
	return r,nil
}

func (s *Service) Block(actor,target model.ObjectID,idempotencyKey string)(Record,error){
	return s.relationshipAction(actor,target,ActionBlock,idempotencyKey)
}

func (s *Service) Mute(actor,target model.ObjectID,idempotencyKey string)(Record,error){
	return s.relationshipAction(actor,target,ActionMute,idempotencyKey)
}

func (s *Service) relationshipAction(actor,target model.ObjectID,action Action,key string)(Record,error){
	s.mu.Lock()
	defer s.mu.Unlock()
	if !validID(actor)||!validID(target)||actor==target||!validKey(key){return Record{},ErrInvalidInput}
	fp:=fmt.Sprintf("%s|%s",action,target)
	if r,hit,err:=s.idempotent(actor,action,key,fp);hit||err!=nil{return r,err}
	rkey:=relationshipKey{Actor:actor,Target:target}
	store:=s.blocked
	if action==ActionMute{store=s.muted}
	if store[rkey]{return Record{},ErrAlreadyExists}
	store[rkey]=true
	now:=s.now().UTC()
	id:=model.ObjectID(fmt.Sprintf("%s:%s:%s",strings.ToLower(string(action)),actor,target))
	r:=Record{ID:id,Action:action,TargetKind:TargetUser,TargetID:target,ActorID:actor,AffectedID:target,ResultState:StateOpen,Version:1,CreatedAt:now}
	s.records[id]=r
	s.remember(actor,action,key,fp,id)
	return r,nil
}

func (s *Service) Unblock(actor,target model.ObjectID) error {
	s.mu.Lock();defer s.mu.Unlock()
	key:=relationshipKey{Actor:actor,Target:target}
	if !s.blocked[key]{return ErrNotFound}
	delete(s.blocked,key)
	return nil
}

func (s *Service) Unmute(actor,target model.ObjectID) error {
	s.mu.Lock();defer s.mu.Unlock()
	key:=relationshipKey{Actor:actor,Target:target}
	if !s.muted[key]{return ErrNotFound}
	delete(s.muted,key)
	return nil
}

func (s *Service) Case(caseID model.ObjectID)(Case,bool){s.mu.RLock();defer s.mu.RUnlock();c,ok:=s.cases[caseID];return c,ok}

func (s *Service) Records(caseID model.ObjectID)[]Record{
	s.mu.RLock();defer s.mu.RUnlock()
	ids:=s.caseLog[caseID]
	out:=make([]Record,0,len(ids))
	for _,id:=range ids{out=append(out,s.records[id])}
	return out
}

func (s *Service) CanRead(communityID,viewerID,authorID model.ObjectID,kind TargetKind,targetID model.ObjectID) bool {
	s.mu.RLock();defer s.mu.RUnlock()
	if s.blocked[relationshipKey{Actor:authorID,Target:viewerID}] || s.blocked[relationshipKey{Actor:viewerID,Target:authorID}] {
		return false
	}
	if caseID,ok:=s.targetCase[targetKey(communityID,kind,targetID)];ok{
		c:=s.cases[caseID]
		if c.Hidden && viewerID!=authorID && !s.isModeratorLocked(communityID,viewerID){return false}
	}
	return true
}

func (s *Service) CanWrite(communityID,actorID model.ObjectID,kind TargetKind,targetID model.ObjectID) bool {
	s.mu.RLock();defer s.mu.RUnlock()
	if s.suspended[userScopeKey(communityID,actorID)]{return false}
	if caseID,ok:=s.targetCase[targetKey(communityID,kind,targetID)];ok{
		c:=s.cases[caseID]
		if c.Locked || c.Hidden {return false}
	}
	return true
}

func (s *Service) IsMuted(actor,target model.ObjectID) bool {
	s.mu.RLock();defer s.mu.RUnlock()
	return s.muted[relationshipKey{Actor:actor,Target:target}]
}

func (s *Service) IsBlocked(actor,target model.ObjectID) bool {
	s.mu.RLock();defer s.mu.RUnlock()
	return s.blocked[relationshipKey{Actor:actor,Target:target}]
}

func (s *Service) IsSuspended(communityID,actor model.ObjectID)bool{
	s.mu.RLock();defer s.mu.RUnlock()
	return s.suspended[userScopeKey(communityID,actor)]
}

func (s *Service) isModerator(communityID,actor model.ObjectID)bool{
	return s.authority.IsActiveMember(communityID,actor) &&
		(s.authority.HasRole(communityID,actor,model.RoleModerator)||s.authority.HasRole(communityID,actor,model.RoleAdmin))
}

func (s *Service) isModeratorLocked(communityID,actor model.ObjectID)bool{
	return s.authority.IsActiveMember(communityID,actor) &&
		(s.authority.HasRole(communityID,actor,model.RoleModerator)||s.authority.HasRole(communityID,actor,model.RoleAdmin))
}

func (s *Service) resolveTarget(kind TargetKind,id model.ObjectID)(model.ObjectID,model.ObjectID,bool){
	if kind==TargetUser{
		return "",id,true
	}
	return s.content.TargetCommunity(kind,id)
}

func (s *Service) appendRecord(r Record){
	s.records[r.ID]=r
	s.caseLog[r.CaseID]=append(s.caseLog[r.CaseID],r.ID)
}

func (s *Service) lastRecord(caseID model.ObjectID)model.ObjectID{
	ids:=s.caseLog[caseID]
	if len(ids)==0{return ""}
	return ids[len(ids)-1]
}

func (s *Service) idempotent(actor model.ObjectID,action Action,key,fingerprint string)(Record,bool,error){
	rec,ok:=s.idempotency[idempotencyKey(actor,action,key)]
	if !ok{return Record{},false,nil}
	if rec.Fingerprint!=fingerprint{return Record{},false,ErrIdempotencyConflict}
	return s.records[rec.ResultID],true,nil
}

func (s *Service) remember(actor model.ObjectID,action Action,key,fingerprint string,id model.ObjectID){
	s.idempotency[idempotencyKey(actor,action,key)]=idempotencyRecord{Fingerprint:fingerprint,ResultID:id}
}

func validID(id model.ObjectID)bool{return id.Valid()}
func validTargetKind(k TargetKind)bool{return k==TargetPost||k==TargetComment||k==TargetUser}
func validModeratorAction(a Action)bool{return a==ActionHide||a==ActionSuspend||a==ActionModeratorDecision||a==ActionRestore||a==ActionLock}
func validReason(r Reason)bool{return strings.TrimSpace(string(r))!=""&&len(r)<=128}
func validBody(ref,hash string)bool{
	ref=strings.TrimSpace(ref);hash=strings.TrimSpace(hash)
	if ref==""&&hash==""{return true}
	return ref!=""&&hash!=""&&len(ref)<=2048&&len(hash)==64
}
func validKey(k string)bool{return k!=""&&len(k)<=128&&strings.TrimSpace(k)==k}
func targetKey(c model.ObjectID,k TargetKind,id model.ObjectID)string{return fmt.Sprintf("%s|%s|%s",c,k,id)}
func userScopeKey(c,u model.ObjectID)string{return fmt.Sprintf("%s|%s",c,u)}
func idempotencyKey(a model.ObjectID,action Action,key string)string{return fmt.Sprintf("%s|%s|%s",a,action,key)}
