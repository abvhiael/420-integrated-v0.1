
//go:build libp2p
// +build libp2p

package libp2ptransport

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	libp2p "github.com/libp2p/go-libp2p"
	pubsub "github.com/libp2p/go-libp2p-pubsub"
	host "github.com/libp2p/go-libp2p/core/host"

	base "github.com/420integrated/420-integrated/consensus/p2p"
)

type Transport struct {
	host host.Host
	ps *pubsub.PubSub
	nodeID uint64
	mu sync.Mutex
	topics map[base.Topic]*pubsub.Topic
	handlers map[base.Topic][]base.Handler
}

func New(ctx context.Context,nodeID uint64,listenAddrs ...string)(*Transport,error){
	opts:=[]libp2p.Option{}
	for _,a:=range listenAddrs { opts=append(opts,libp2p.ListenAddrStrings(a)) }
	h,err:=libp2p.New(opts...)
	if err!=nil{return nil,err}
	ps,err:=pubsub.NewGossipSub(ctx,h)
	if err!=nil{h.Close();return nil,err}
	return &Transport{host:h,ps:ps,nodeID:nodeID,topics:map[base.Topic]*pubsub.Topic{},handlers:map[base.Topic][]base.Handler{}},nil
}

func (t *Transport) Subscribe(topic base.Topic,h base.Handler){
	t.mu.Lock(); defer t.mu.Unlock()
	t.handlers[topic]=append(t.handlers[topic],h)
}

func (t *Transport) Start(ctx context.Context) error {
	for _,topic:=range []base.Topic{
		base.TopicBlock,base.TopicAttestation,base.TopicQC,base.TopicHeartbeat,
		base.TopicStatus,base.TopicRandomness,base.TopicEvidence,base.TopicRecovery,
	}{
		pt,err:=t.ps.Join(string(topic)); if err!=nil{return err}
		sub,err:=pt.Subscribe(); if err!=nil{return err}
		t.topics[topic]=pt
		go func(tp base.Topic,s *pubsub.Subscription){
			for {
				msg,err:=s.Next(ctx); if err!=nil{return}
				var env base.Envelope
				if json.Unmarshal(msg.Data,&env)!=nil{continue}
				t.mu.Lock(); hs:=append([]base.Handler(nil),t.handlers[tp]...); t.mu.Unlock()
				for _,h:=range hs { go h(ctx,env) }
			}
		}(topic,sub)
	}
	return nil
}

func (t *Transport) Publish(ctx context.Context,env base.Envelope) error {
	t.mu.Lock(); tp:=t.topics[env.Topic]; t.mu.Unlock()
	if tp==nil{return fmt.Errorf("topic not joined: %s",env.Topic)}
	env.From=t.nodeID
	raw,err:=json.Marshal(env); if err!=nil{return err}
	return tp.Publish(ctx,raw)
}
func (t *Transport) Close() error { return t.host.Close() }
