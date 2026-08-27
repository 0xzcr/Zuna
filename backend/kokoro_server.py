#!/usr/bin/env python3
"""Local Kokoro-82M web runtime for the Zuna website.

The model and voice pack stay on the user's machine. The browser only receives generated WAV
audio for the current passage; no document text is sent to a hosted TTS vendor.
"""

import argparse
import io
import json
import os
import re
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("KOKORO_MODEL_DIR", ROOT / "kokoro_models"))
MODEL = MODEL_DIR / "kokoro-v1.0.int8.onnx"
VOICES = MODEL_DIR / "voices-v1.0.bin"
LANGUAGES = {
    "af": "en-us", "am": "en-us", "bf": "en-gb", "bm": "en-gb", "ef": "es", "em": "es",
    "ff": "fr-fr", "hf": "hi", "hm": "hi", "if": "it", "im": "it", "jf": "ja", "jm": "ja",
    "pf": "pt-br", "pm": "pt-br", "zf": "cmn", "zm": "cmn",
}


class App:
    def __init__(self):
        self.tts = None
        self.lock = threading.Lock()

    def engine(self):
        if self.tts is None:
            if not MODEL.is_file() or not VOICES.is_file():
                raise RuntimeError("Kokoro model files are missing; run backend/setup-kokoro.sh")
            self.tts = Kokoro(str(MODEL), str(VOICES))
        return self.tts

    def voices(self):
        if not VOICES.is_file():
            return []
        import numpy as np
        with np.load(VOICES) as data:
            return sorted(str(name) for name in data.files)

    def synthesize(self, payload):
        text = str(payload.get("text", "")).strip()
        voice = str(payload.get("voice", ""))
        if not text or len(text) > 12_000:
            raise ValueError("Text must contain 1–12,000 characters")
        if voice not in self.voices():
            raise ValueError("Choose a valid Kokoro voice")
        speed = max(0.6, min(1.4, float(payload.get("speed", 1.0))))
        expression = max(0.0, min(1.0, float(payload.get("expressiveness", 0.5))))
        sentence_pause = max(0.0, min(0.8, float(payload.get("sentence_pause", 0.25)))) + expression * 0.12
        clause_pause = 0.06 + expression * 0.10
        with self.lock:
            samples, rate = self.engine().create(text, voice=voice, speed=speed, lang=LANGUAGES.get(voice[:2], "en-us"), sentence_pause=sentence_pause, clause_pause=clause_pause)
        output = io.BytesIO()
        sf.write(output, samples, rate, format="WAV", subtype="PCM_16")
        return output.getvalue()

    def synthesize_chapter(self, payload):
        text = str(payload.get("text", "")).strip()
        if not text or len(text) > 1_000_000:
            raise ValueError("Chapter must contain 1–1,000,000 characters")
        parts, current = [], ""
        for sentence in re.split(r"(?<=[.!?…])\s+", text):
            if current and len(current) + len(sentence) + 1 > 11_000:
                parts.append(current)
                current = ""
            current = f"{current} {sentence}".strip()
        if current:
            parts.append(current)
        audio = [self.synthesize({**payload, "text": part}) for part in parts]
        output = io.BytesIO()
        with wave.open(io.BytesIO(audio[0]), "rb") as first, wave.open(output, "wb") as wav:
            wav.setnchannels(first.getnchannels()); wav.setsampwidth(first.getsampwidth()); wav.setframerate(first.getframerate()); wav.writeframes(first.readframes(first.getnframes()))
            for raw in audio[1:]:
                with wave.open(io.BytesIO(raw), "rb") as part:
                    wav.writeframes(part.readframes(part.getnframes()))
        return output.getvalue()


APP = App()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args)

    def cors_headers(self):
        origin = self.headers.get("Origin")
        allowed = {item.strip() for item in os.environ.get("KOKORO_ALLOWED_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173").split(",")}
        if origin == "null" or origin in allowed:
            return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Vary": "Origin"}
        return {}

    def send_json(self, value, status=200):
        body = json.dumps(value).encode()
        self.send_response(status)
        for key, value in self.cors_headers().items(): self.send_header(key, value)
        self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        for key, value in self.cors_headers().items(): self.send_header(key, value)
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/api/voices": self.send_json(APP.voices()); return
        self.send_json({"error": "Route not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/synthesize": self.send_json({"error": "Route not found"}, 404); return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > 64 * 1024: raise ValueError("Request is too large")
            payload = json.loads(self.rfile.read(size))
            audio = APP.synthesize(payload)
            self.send_response(200)
            for key, value in self.cors_headers().items(): self.send_header(key, value)
            self.send_header("Content-Type", "audio/wav"); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(audio))); self.end_headers(); self.wfile.write(audio)
        except Exception as exc:
            if isinstance(exc, RuntimeError): APP.tts = None
            self.send_json({"error": str(exc)}, 400)


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--port", type=int, default=int(os.environ.get("KOKORO_PORT", "8766"))); args = parser.parse_args()
    print(f"Found {len(APP.voices())} Kokoro voice(s) in {MODEL_DIR}")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__": main()
