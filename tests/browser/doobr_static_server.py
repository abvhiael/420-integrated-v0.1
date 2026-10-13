"""Loopback-only browser test server for two independently root-hosted sites.

Each deployed site owns '/', so root-relative assets must resolve against the
originating site's directory. Never use this test server for deployment.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[2] / "web"
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self,path):
  route=urlsplit(path).path
  if route.startswith("/doobr/"):
   return str(ROOT / "doobr" / route.removeprefix("/doobr/"))
  if route.startswith("/travel/"):
   return str(ROOT / "travel" / route.removeprefix("/travel/"))
  if route=="/":
   return str(ROOT / "doobr" / "index.html")
  referer=urlsplit(self.headers.get("Referer","")).path
  site="travel" if referer.startswith("/travel/") else "doobr"
  relative=route.lstrip("/")
  if ".." in Path(relative).parts:
   return str(ROOT / "__invalid__")
  return str(ROOT / site / relative)
 def end_headers(self):
  self.send_header("Cache-Control","no-store")
  super().end_headers()

if __name__=="__main__":
 ThreadingHTTPServer(("127.0.0.1",8769),Handler).serve_forever()
