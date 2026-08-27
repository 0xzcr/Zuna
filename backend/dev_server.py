#!/usr/bin/env python3
"""Serve Zuna and proxy browser-safe requests to the local Kokoro runtime."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
KOKORO_ORIGIN = "http://127.0.0.1:8766"
ROUTES = {
    ("GET", "/kokoro/api/voices"),
    ("POST", "/kokoro/api/synthesize"),
}


class ZunaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if ("GET", self.path) in ROUTES:
            self.proxy_to_kokoro()
        else:
            super().do_GET()

    def do_POST(self):
        if ("POST", self.path) in ROUTES:
            self.proxy_to_kokoro()
        else:
            self.send_error(404)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def proxy_to_kokoro(self):
        body = None
        if self.command == "POST":
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.send_error(400)
                return
            if length < 0:
                self.send_error(400)
                return
            if length > 1_000_000:
                self.send_error(413)
                return
            body = self.rfile.read(length)

        request = Request(
            KOKORO_ORIGIN + self.path.removeprefix("/kokoro"),
            data=body,
            method=self.command,
            headers={"Content-Type": self.headers.get("Content-Type", "application/json")},
        )
        try:
            with urlopen(request, timeout=120) as response:
                self.send_proxy_response(response.status, response.headers, response.read())
        except HTTPError as error:
            self.send_proxy_response(error.code, error.headers, error.read())
        except (URLError, TimeoutError):
            payload = json.dumps({"error": "Local Kokoro runtime is unavailable"}).encode()
            self.send_proxy_response(502, {"Content-Type": "application/json"}, payload)

    def send_proxy_response(self, status, headers, body):
        self.send_response(status)
        self.send_header("Content-Type", headers.get("Content-Type", "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print("Zuna website: http://127.0.0.1:4173/frontend/")
    ThreadingHTTPServer(("127.0.0.1", 4173), ZunaHandler).serve_forever()
