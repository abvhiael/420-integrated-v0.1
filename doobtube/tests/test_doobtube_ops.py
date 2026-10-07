import http.client
import json
from pathlib import Path
import tempfile
import threading
import socket
import unittest

from doobtube.ops.config import NonProductionConfig
from doobtube.ops.server import create_server, runtime_config

class DoobTubeOpsTests(unittest.TestCase):
    def test_nonproduction_config_rejects_non_loopback(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"bad.json"
            p.write_text(json.dumps({
                "schema":"doobtube-nonproduction-v1","production":False,
                "bind":{"host":"0.0.0.0","port":8420},
                "runtime":{"chainId":420,"network":"dev","databasePath":"x.sqlite","webRoot":"doobtube/web/dist"},
                "dependencies":{}
            }))
            with self.assertRaises(ValueError): NonProductionConfig.load(p)

    def test_production_true_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/"bad.json"
            p.write_text(json.dumps({
                "schema":"doobtube-nonproduction-v1","production":True,
                "bind":{"host":"127.0.0.1","port":8420},
                "runtime":{"chainId":420,"network":"dev","databasePath":"x.sqlite","webRoot":"doobtube/web/dist"}
            }))
            with self.assertRaises(ValueError): NonProductionConfig.load(p)

    def test_runtime_config_is_explicitly_nonproduction_and_dependencies_unresolved(self):
        cfg=NonProductionConfig("127.0.0.1",8420,420,"development","x.sqlite","doobtube/web/dist")
        r=runtime_config(cfg)
        self.assertIsNone(r["site"]["productionOrigin"])
        self.assertEqual(r["services"]["media"]["serviceId"],"420/service/media/v1")
        self.assertIsNone(r["services"]["media"]["baseUrl"])
        self.assertIn("NONPRODUCTION",r["execution"]["status"])

    def test_loopback_server_serves_health_readiness_web_and_rejects_writes(self):
        root=Path("doobtube/web/dist")
        self.assertTrue((root/"index.html").exists(),"web build must exist before ops test")
        with tempfile.TemporaryDirectory() as td:
            sock=socket.socket();sock.bind(("127.0.0.1",0));port=sock.getsockname()[1];sock.close()
            cfg=NonProductionConfig("127.0.0.1",port,420,"development",str(Path(td)/"db.sqlite"),str(root))
            server=create_server(cfg)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                conn=http.client.HTTPConnection(cfg.host,cfg.port,timeout=3)
                conn.request("GET","/v1/health");resp=conn.getresponse();body=json.loads(resp.read());self.assertEqual(resp.status,200);self.assertEqual(body["data"]["status"],"ok")
                conn.request("GET","/v1/readiness");resp=conn.getresponse();body=json.loads(resp.read());self.assertEqual(resp.status,503);self.assertEqual(body["data"]["status"],"not_ready")
                conn.request("GET","/");resp=conn.getresponse();data=resp.read();self.assertEqual(resp.status,200);self.assertIn(b"DoobTube",data)
                conn.request("POST","/v1/control/rebuild",body=b"{}");resp=conn.getresponse();body=json.loads(resp.read());self.assertEqual(resp.status,501);self.assertEqual(body["error"]["code"],"NONPRODUCTION_AUTH_NOT_CONFIGURED")
            finally:
                server.shutdown();server.backend.close();server.server_close();thread.join(timeout=2)

if __name__=="__main__": unittest.main()
