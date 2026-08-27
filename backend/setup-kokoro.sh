#!/usr/bin/env bash
set -euo pipefail

backend_dir="$(cd "$(dirname "$0")" && pwd)"
model_dir="$backend_dir/kokoro_models"
venv_dir="$backend_dir/.venv"
mkdir -p "$model_dir"
python3 -m venv "$venv_dir"
"$venv_dir/bin/python" -m pip install -r "$backend_dir/requirements-kokoro.txt"
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx -o "$model_dir/kokoro-v1.0.int8.onnx"
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin -o "$model_dir/voices-v1.0.bin"
echo "Kokoro model and 54-voice pack are ready. Run: $venv_dir/bin/python $backend_dir/kokoro_server.py"
