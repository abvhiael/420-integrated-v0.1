"""Public, credential-free live acceptance checks; never create accounts/send mail.
The TLS client uses the system trust store and validates hostnames. No cookie,
body, or certificate identifiers are printed. This is not a device/mail audit.
"""
import http.client
import json
import ssl
from http.cookies import SimpleCookie
from urllib.parse import urlsplit

HOST = "auth.420integrated.org"
DEFAULT = "four20id.onrender.com"
ORIGIN = "https://" + HOST
FLOW = "__Host-420id-acceptance"
TLS = ssl.create_default_context()
failed = []


def request(host, path, *, secure=True, headers=None, method="GET", body=None):
    conn = (http.client.HTTPSConnection(host, context=TLS, timeout=100)
            if secure else http.client.HTTPConnection(host, timeout=100))
    try:
        conn.request(method, path, body=body, headers=headers or {})
        res = conn.getresponse()
        data = res.read(131072)
        return res.status, res.headers, data
    finally:
        conn.close()


def check(name, fn):
    try:
        result = fn()
        if not result:
            raise ValueError("unexpected response")
        print("PASS " + name, flush=True)
    except Exception as exc:
        failed.append(name)
        # Never print request/response bodies, headers, cookies, or exception data.
        print("FAIL " + name + " (" + type(exc).__name__ + ")", flush=True)


def redirect(headers, status):
    target = urlsplit(headers.get("Location", ""))
    return status in (301, 302, 307, 308) and target.scheme == "https" and target.netloc == HOST


def http_redirect(extra=None):
    status, headers, _ = request(HOST, "/", secure=False, headers=extra)
    return redirect(headers, status)


def health():
    status, _, body = request(HOST, "/healthz")
    return status == 200 and json.loads(body) == {"ready": True}


def headers_and_cookie():
    status, headers, _ = request(HOST, "/")
    cookie = SimpleCookie()
    for value in headers.get_all("Set-Cookie", []):
        cookie.load(value)
    item = cookie.get(FLOW)
    csp = headers.get("Content-Security-Policy", "")
    return (
        status == 200
        and "no-store" in headers.get("Cache-Control", "").lower()
        and headers.get("X-Content-Type-Options", "").lower() == "nosniff"
        and headers.get("X-Frame-Options", "").upper() == "DENY"
        and headers.get("Referrer-Policy", "") == "no-referrer"
        and "max-age=31536000" in headers.get("Strict-Transport-Security", "")
        and all(d in csp for d in ("default-src 'none'", "script-src 'self'",
                                    "frame-ancestors 'none'", "form-action 'self'"))
        and item is not None and bool(item["secure"]) and bool(item["httponly"])
        and item["samesite"].lower() == "strict" and item["path"] == "/"
        and not item["domain"]
    )


def wrong_origin():
    status, headers, _ = request(HOST, "/")
    if status != 200:
        return False
    cookie = SimpleCookie()
    for value in headers.get_all("Set-Cookie", []):
        cookie.load(value)
    item = cookie[FLOW]
    status, headers, _ = request(
        HOST, "/v1/passkey/start", method="POST", body="{}",
        headers={"Cookie": item.key + "=" + item.coded_value,
                 "Origin": "https://example.invalid", "Content-Type": "application/json"}
    )
    return status == 403 and not headers.get("Access-Control-Allow-Origin")


def default_denied():
    for path in ("/", "/acceptance.mjs", "/v1/passkey/start"):
        status, _, _ = request(DEFAULT, path, headers={"X-Forwarded-Proto": "https"})
        if status not in (403, 404):
            return False
    return True


def trusted_proxy_probe():
    # A valid HTTPS request remains usable despite a false client header only
    # if ingress normalizes the value; this complements the HTTP spoof test.
    status, _, _ = request(HOST, "/", headers={"X-Forwarded-Proto": "http"})
    return status == 200


if __name__ == "__main__":
    check("trusted HTTPS DNS/certificate and DB readiness", health)
    check("HTTP redirects to canonical HTTPS", http_redirect)
    check("HTTP cannot bypass TLS with spoofed forwarded proto",
          lambda: http_redirect({"X-Forwarded-Proto": "https"}))
    check("deployed security headers and flow cookie attributes", headers_and_cookie)
    check("different-origin POST denied with browser cookie", wrong_origin)
    check("default hostname application paths denied", default_denied)
    check("HTTPS ingress normalizes false forwarded proto", trusted_proxy_probe)
    if failed:
        raise SystemExit("Live ingress qualification incomplete: " + ", ".join(failed))
