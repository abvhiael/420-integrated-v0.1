package replay

import (
  "context"
  "strings"
  "testing"
)

func TestLaunchpadRealEventContractToNotificationsReplay(t *testing.T) {
  // Topics are Keccak event signatures from LaunchpadCrowdfundingIntegration420.
  topic := "0x4eb83f152568db723c84ad661f3eb23bf181fbd52e5a3f098c02f32ec76d133c"
  sale := "0x"+strings.Repeat("11",32)
  contract := "0x"+strings.Repeat("42",20)
  event := EventEnvelope{
    StreamVersion:StreamVersion, ID:"launchpad-event-1", Source:"protocol", Topic:topic,
    Protocol:"420Launchpad", EventName:"NotificationPublished", ObjectKey:sale,
    Provenance:Provenance{ChainID:"420", BlockNumber:"17",BlockHash:"0x"+strings.Repeat("aa",32),
      TransactionHash:"0x"+strings.Repeat("bb",32), LogIndex:2,ContractAddress:contract},
    Authoritative:false,
  }
  stream:=&fakeStream{batch:EventBatch{StreamVersion:StreamVersion,Events:[]EventEnvelope{event},NextCursor:"after-launchpad"}}
  store:=NewMemoryCheckpointStore()
  h:=&fakeHandler{}
  processor,err:=NewProcessor(420,stream,store,h)
  if err!=nil{t.Fatal(err)}
  cp,err:=processor.ReplayOnce(context.Background())
  if err!=nil{t.Fatal(err)}
  if cp.Cursor!="after-launchpad"||len(h.events)!=1||h.events[0]!="launchpad-event-1"{
    t.Fatalf("Launchpad notification delivery lost or became authoritative: %+v events=%v",cp,h.events)
  }
  for _,kind:=range []string{"retracted","superseded","finalized"}{
    signal:=CanonicalSignal{ID:"signal-"+kind,Kind:kind,EventID:event.ID,ChainID:"420",
      BlockNumber:"17",BlockHash:event.Provenance.BlockHash,Authoritative:false}
    if err:=processor.ApplyCanonicalSignal(context.Background(),signal);err!=nil{t.Fatal(err)}
  }
  if len(h.signals)!=3{t.Fatalf("reorg/finality presentation updates lost: %v",h.signals)}
  cp2,_,_:=store.Load(420)
  if cp2.Cursor!="after-launchpad"{t.Fatal("canonical update silently rewrote delivery cursor")}
  event.Provenance.ChainID="421"
  stream.batch.Events=[]EventEnvelope{event}
  stream.batch.NextCursor="poisoned"
  if _,err:=processor.ReplayOnce(context.Background());err==nil{t.Fatal("cross-chain Launchpad alert accepted")}
  cp3,_,_:=store.Load(420)
  if cp3.Cursor!="after-launchpad"{t.Fatal("cross-chain alert moved checkpoint")}
}
