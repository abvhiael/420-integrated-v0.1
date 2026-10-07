from datetime import datetime, timedelta, timezone
import os, tempfile, unittest

from doobtube.api.persistence import Store
from doobtube.media import *
from doobtube.media.security import MediaRejected, ManifestRejected, ScannerRejected, ProviderRejected, UnsafeEndpoint

class Scanner:
    def __init__(self, verdict="CLEAN"): self.verdict=verdict
    def scan(self,item): return ScanResult(self.verdict,"scanner-1" if self.verdict=="CLEAN" else "scanner-1")

class Media:
    def __init__(self):
        self.controller=("0xabc",False); self.fail_start=False; self.process_result=None
    def prepare_upload(self,item,key):
        return UploadPlan(item.asset_id,"obj","manifest",0,"root",item.size_bytes,"commit",
                          "https://upload.example/video","upload-1",key)
    def process(self,request):
        if self.process_result: return self.process_result
        return ProcessingResult(request.media_job_id,"out-1","opaque-output",request.expected_provider_id,
                                request.profile_id,True,request.deadline-timedelta(seconds=1))
    def livestream_start(self,spec):
        if self.fail_start: raise RuntimeError("transport interrupted")
        return "active"
    def livestream_stop(self,session_id,controller_ref): return "closed"
    def stream_controller(self,stream_ref): return self.controller

def resolver(host):
    values={"upload.example":["93.184.216.34"],"cdn.example":["93.184.216.34"],
            "live.example":["93.184.216.34"],"evil.example":["127.0.0.1"]}
    return values.get(host,["93.184.216.34"])

class MediaIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.store=Store(os.path.join(self.tmp.name,"db.sqlite"))
        self.media=Media()
        self.now=datetime(2026,10,7,3,0,tzinfo=timezone.utc)
        self.svc=MediaIntegration(self.store,self.media,Scanner(),resolver=resolver,now=lambda:self.now)
        self.item=UploadInspection("asset-1","video/mp4",1024,"a"*64,"source-ref")
        self.plan=self.svc.prepare_upload(self.item,"idem-1")
        self.manifest=StorageManifest("obj","manifest",0,"root",1024,"commit",True,True,True,1)

    def tearDown(self): self.store.close(); self.tmp.cleanup()

    def test_clean_upload_and_canonical_ready(self):
        self.assertEqual(self.plan.asset_id,"asset-1")
        self.assertEqual(self.svc.confirm_ready(self.plan,self.manifest),self.manifest)

    def test_malformed_malicious_media_rejected(self):
        bad=[
            UploadInspection("a","image/png",10,"a"*64,"s"),
            UploadInspection("a","video/mp4",0,"a"*64,"s"),
            UploadInspection("a","video/mp4",(8<<30)+1,"a"*64,"s"),
            UploadInspection("a","video/mp4",10,"not-a-digest","s"),
        ]
        for item in bad:
            with self.assertRaises(MediaRejected): self.svc.prepare_upload(item,"k")

    def test_scanner_quarantine_and_reject_fail_closed(self):
        for verdict in ("QUARANTINE","REJECT"):
            svc=MediaIntegration(self.store,self.media,Scanner(verdict),resolver=resolver,now=lambda:self.now)
            with self.assertRaises(ScannerRejected): svc.prepare_upload(self.item,"k-"+verdict)

    def test_ssrf_and_embedded_credentials_denied(self):
        original=self.media.prepare_upload
        for endpoint in ("http://127.0.0.1/x","https://user:pass@upload.example/x","https://evil.example/x","file:///tmp/a"):
            self.media.prepare_upload=lambda item,key,e=endpoint: UploadPlan(item.asset_id,"o","m",0,"r",item.size_bytes,"c",e,"u",key)
            with self.assertRaises((UnsafeEndpoint,MediaRejected)): self.svc.prepare_upload(self.item,"k")
        self.media.prepare_upload=original

    def test_dns_aware_resolution_required(self):
        svc=MediaIntegration(self.store,self.media,Scanner(),resolver=lambda _h:["10.0.0.1"],now=lambda:self.now)
        with self.assertRaises(UnsafeEndpoint): svc.prepare_upload(self.item,"k")

    def test_stale_invalid_manifest_rejected(self):
        bad=[
            StorageManifest("other","manifest",0,"root",1024,"commit",True,True,True,1),
            StorageManifest("obj","manifest",0,"root",1024,"commit",False,True,True,1),
            StorageManifest("obj","manifest",0,"root",1024,"commit",True,False,True,1),
            StorageManifest("obj","manifest",0,"root",1024,"commit",True,True,False,1),
        ]
        for value in bad:
            with self.assertRaises(ManifestRejected): self.svc.confirm_ready(self.plan,value)

    def test_verified_playback_rejects_stale_manifest_and_unsafe_url(self):
        good=PlaybackLocator("asset-1","https://cdn.example/asset.mp4",1,self.now+timedelta(minutes=5))
        self.assertEqual(self.svc.admit_playback(good,self.manifest,self.plan),good.url)
        with self.assertRaises(ManifestRejected):
            self.svc.admit_playback(PlaybackLocator("asset-1",good.url,2,None),self.manifest,self.plan)
        with self.assertRaises(ManifestRejected):
            self.svc.admit_playback(PlaybackLocator("asset-1",good.url,1,self.now-timedelta(seconds=1)),self.manifest,self.plan)
        with self.assertRaises(UnsafeEndpoint):
            self.svc.admit_playback(PlaybackLocator("asset-1","https://evil.example/x",1,None),self.manifest,self.plan)

    def profile(self):
        return ProcessingProfile("profile-h264","ffmpeg","mp4","h264","aac",3600,1<<30,200,128)

    def request(self):
        return ProcessingRequest("job-1","asset-1","opaque-input","profile-h264","provider-1","operator-1",self.now+timedelta(hours=1))

    def provider(self,**kw):
        values=dict(provider_id="provider-1",operator_ref="operator-1",active=True,verified=True,observed_at_epoch=int(self.now.timestamp()))
        values.update(kw); return ProviderSnapshot(**values)

    def test_processing_static_profile_and_resource_bounds(self):
        result=self.svc.process(self.request(),self.profile(),self.provider())
        self.assertTrue(result.verified)
        bad=ProcessingProfile("profile-h264","shell","mp4","h264","aac",3600,1<<30,200,128)
        with self.assertRaises(MediaRejected): self.svc.process(self.request(),bad,self.provider())
        for p in (
            ProcessingProfile("p","ffmpeg","mp4","h264","aac",21601,1<<30,200,128),
            ProcessingProfile("p","ffmpeg","mp4","h264","aac",3600,(8<<30)+1,200,128),
            ProcessingProfile("p","ffmpeg","mp4","h264","aac",3600,1<<30,401,128),
            ProcessingProfile("p","ffmpeg","mp4","h264","aac",3600,1<<30,200,257),
        ):
            with self.assertRaises(MediaRejected): self.svc.process(
                ProcessingRequest("j","a","i",p.profile_id,"provider-1","operator-1",self.now+timedelta(hours=1)),p,self.provider())

    def test_provider_compromise_and_stale_evidence_rejected(self):
        for p in (
            self.provider(active=False), self.provider(verified=False),
            self.provider(provider_id="evil"), self.provider(operator_ref="evil"),
            self.provider(observed_at_epoch=int(self.now.timestamp())-301),
            self.provider(observed_at_epoch=int(self.now.timestamp())+1),
        ):
            with self.assertRaises(ProviderRejected): self.svc.process(self.request(),self.profile(),p)

    def test_processing_result_substitution_and_deadline_rejected(self):
        self.media.process_result=ProcessingResult("other","out","ref","provider-1","profile-h264",True,self.now)
        with self.assertRaises(ProviderRejected): self.svc.process(self.request(),self.profile(),self.provider())
        self.media.process_result=None
        expired=ProcessingRequest("j","a","i","profile-h264","provider-1","operator-1",self.now-timedelta(seconds=1))
        with self.assertRaises(MediaRejected): self.svc.process(expired,self.profile(),self.provider())

    def live_spec(self,**kw):
        values=dict(session_id="s1",stream_ref="stream-1",controller_ref="0xabc",protocol="whip",
                    direction="ingress",endpoint="https://live.example/whip",credential_ref="secret://stream/s1",max_duration_seconds=3600)
        values.update(kw); return LivestreamSpec(**values)

    def test_livestream_secrets_and_ssrf_fail_closed(self):
        with self.assertRaises(UnsafeEndpoint): self.svc.create_livestream(self.live_spec(endpoint="https://evil.example/whip"))
        with self.assertRaises(MediaRejected): self.svc.create_livestream(self.live_spec(credential_ref=""))
        with self.assertRaises(UnsafeEndpoint): self.svc.create_livestream(self.live_spec(endpoint="https://u:p@live.example/whip"))

    def test_livestream_controller_authority_and_recovery(self):
        self.svc.create_livestream(self.live_spec())
        active=self.svc.start_livestream("s1","0xabc")
        self.assertEqual(active.state,"active")
        # simulate process restart with persisted desired-live session
        svc2=MediaIntegration(self.store,self.media,Scanner(),resolver=resolver,now=lambda:self.now)
        recovered=svc2.recover_livestreams()
        self.assertEqual(recovered[0].state,"active")
        self.media.controller=("0xdef",False)
        changed=svc2.recover_livestreams()
        self.assertEqual(changed[0].state,"failed")
        self.assertFalse(changed[0].desired_live)

    def test_interrupted_livestream_retry_is_bounded(self):
        self.svc.create_livestream(self.live_spec())
        self.media.fail_start=True
        for _ in range(3):
            with self.assertRaises(RuntimeError): self.svc.start_livestream("s1","0xabc")
        with self.assertRaises(MediaRejected): self.svc.start_livestream("s1","0xabc")
        row=self.store.get_media_session("s1")
        self.assertEqual(row.reconnect_attempts,3)

if __name__=="__main__": unittest.main()
