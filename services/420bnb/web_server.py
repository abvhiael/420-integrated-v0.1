"""Serve the single reviewed public UI; no directory listing or private files."""
import base64
import hashlib
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ASSET_TYPES = {".webp": "image/webp", ".png": "image/png"}
APPROVED_ASSETS = ["420bnb-header.webp","420bnb-hero-lockup.webp","420bnb-emblem.webp","420bnb-official-original.webp","favicon-32.png","favicon-180.png"]


def policy(html):
    scripts = re.findall(rb"<script(?:\s[^>]*)?>(.*?)</script>", html, re.S)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s).digest()).decode() + "'" for s in scripts]
    return ("default-src 'self'; script-src " + " ".join(hashes)
            + "; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:;"
            + " connect-src 'self'; object-src 'none'; base-uri 'none';"
            + " frame-ancestors 'none'; form-action 'self'")


class UI(BaseHTTPRequestHandler):
    html = b""
    csp = ""

    def respond(self, head=False):
        path = urlsplit(self.path).path
        valid = path in ("/", "/index.html")
        asset_name = path.removeprefix("/assets/") if path.startswith("/assets/") else ""
        asset_ok = asset_name in APPROVED_ASSETS
        body = self.html if valid else (Path("assets", asset_name).read_bytes() if asset_ok else b"Not found")
        self.send_response(200 if valid or asset_ok else 404)
        self.send_header("Content-Type", "text/html; charset=utf-8" if valid else (ASSET_TYPES[Path(asset_name).suffix] if asset_ok else "text/plain"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store" if valid else "public, max-age=3600" if asset_ok else "no-store")
        self.send_header("Content-Security-Policy", self.csp)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def do_GET(self):
        self.respond()

    def do_HEAD(self):
        self.respond(True)

    def log_message(self, *_):
        # No arbitrary request path, query, bearer token or source address in logs.
        return


if __name__ == "__main__":
    UI.html = Path("index.html").read_bytes()
    UI.csp = policy(UI.html)
    ThreadingHTTPServer(("0.0.0.0", 8080), UI).serve_forever()
