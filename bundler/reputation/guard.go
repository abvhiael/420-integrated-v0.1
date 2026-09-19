package reputation

import (
	"errors"
	"net"
	"strings"
	"sync"
	"time"
)

var (
	ErrSourceRateLimited = errors.New("peer source rate limited")
	ErrSenderRateLimited = errors.New("UserOperation sender rate limited")
	ErrSourceBackoff = errors.New("peer source temporarily backed off")
)

type Config struct {
	Window time.Duration
	MaxRequestsPerSource int
	MaxFailuresPerSource int
	MaxRequestsPerSender int
	Backoff time.Duration
	MaxEntries int
}

func (c Config) Validate() error {
	if c.Window<=0{return errors.New("reputation window must be positive")}
	if c.MaxRequestsPerSource<=0{return errors.New("max requests per source must be positive")}
	if c.MaxFailuresPerSource<=0{return errors.New("max failures per source must be positive")}
	if c.MaxFailuresPerSource>c.MaxRequestsPerSource{return errors.New("max failures cannot exceed max source requests")}
	if c.MaxRequestsPerSender<=0{return errors.New("max requests per sender must be positive")}
	if c.Backoff<=0{return errors.New("backoff must be positive")}
	if c.MaxEntries<=0{return errors.New("max entries must be positive")}
	return nil
}

type bucket struct {
	WindowStart time.Time
	Requests int
	Failures int
	BackoffUntil time.Time
	LastSeen time.Time
}

type Guard struct {
	mu sync.Mutex
	cfg Config
	sources map[string]bucket
	senders map[string]bucket
}

func New(cfg Config)(*Guard,error){
	if err:=cfg.Validate();err!=nil{return nil,err}
	return &Guard{cfg:cfg,sources:map[string]bucket{},senders:map[string]bucket{}},nil
}

func SourceKey(remoteAddr string)(string,error){
	host,_,err:=net.SplitHostPort(strings.TrimSpace(remoteAddr))
	if err!=nil{return "",errors.New("invalid remote address")}
	ip:=net.ParseIP(host)
	if ip==nil{return "",errors.New("remote address is not an IP")}
	return ip.String(),nil
}

func (g *Guard) Allow(source,sender string,now time.Time) error {
	if source=="" || sender=="" || now.IsZero(){return errors.New("source, sender and time are required")}
	source=strings.ToLower(source)
	sender=strings.ToLower(sender)
	g.mu.Lock()
	defer g.mu.Unlock()
	g.pruneLocked(now)

	sb:=g.roll(g.sources[source],now)
	if sb.BackoffUntil.After(now){return ErrSourceBackoff}
	if sb.Requests>=g.cfg.MaxRequestsPerSource{
		sb.BackoffUntil=now.Add(g.cfg.Backoff).UTC()
		sb.LastSeen=now.UTC()
		g.sources[source]=sb
		return ErrSourceRateLimited
	}
	tb:=g.roll(g.senders[sender],now)
	if tb.Requests>=g.cfg.MaxRequestsPerSender{
		tb.LastSeen=now.UTC()
		g.senders[sender]=tb
		return ErrSenderRateLimited
	}
	sb.Requests++
	sb.LastSeen=now.UTC()
	tb.Requests++
	tb.LastSeen=now.UTC()
	g.sources[source]=sb
	g.senders[sender]=tb
	g.enforceBoundsLocked()
	return nil
}

func (g *Guard) Failure(source string,now time.Time) {
	if source=="" || now.IsZero(){return}
	source=strings.ToLower(source)
	g.mu.Lock()
	defer g.mu.Unlock()
	g.pruneLocked(now)
	b:=g.roll(g.sources[source],now)
	b.Failures++
	b.LastSeen=now.UTC()
	if b.Failures>=g.cfg.MaxFailuresPerSource{
		b.BackoffUntil=now.Add(g.cfg.Backoff).UTC()
	}
	g.sources[source]=b
	g.enforceBoundsLocked()
}

func (g *Guard) roll(b bucket,now time.Time)bucket{
	if b.WindowStart.IsZero() || !now.Before(b.WindowStart.Add(g.cfg.Window)){
		return bucket{WindowStart:now.UTC(),BackoffUntil:b.BackoffUntil,LastSeen:now.UTC()}
	}
	return b
}

func (g *Guard) pruneLocked(now time.Time){
	cutoff:=now.Add(-(g.cfg.Window+g.cfg.Backoff))
	for k,b:=range g.sources{
		if b.LastSeen.Before(cutoff) && !b.BackoffUntil.After(now){delete(g.sources,k)}
	}
	for k,b:=range g.senders{
		if b.LastSeen.Before(cutoff){delete(g.senders,k)}
	}
}

func (g *Guard) enforceBoundsLocked(){
	for len(g.sources)>g.cfg.MaxEntries{
		var oldest string
		var oldestAt time.Time
		for k,b:=range g.sources{
			if oldest=="" || b.LastSeen.Before(oldestAt){oldest=k;oldestAt=b.LastSeen}
		}
		delete(g.sources,oldest)
	}
	for len(g.senders)>g.cfg.MaxEntries{
		var oldest string
		var oldestAt time.Time
		for k,b:=range g.senders{
			if oldest=="" || b.LastSeen.Before(oldestAt){oldest=k;oldestAt=b.LastSeen}
		}
		delete(g.senders,oldest)
	}
}
