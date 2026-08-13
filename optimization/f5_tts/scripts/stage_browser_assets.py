#!/usr/bin/env python3
"""Stage the selected external ONNX package and compact prompts for static hosting."""

import argparse
import json
import shutil
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("dist/models/f5"))
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    selected = json.loads((repo / "optimization/f5_tts/phases/05-quantization/selected.json").read_text())
    model = Path(selected["artifact_root"])
    target = args.output / "fp16-nfe8"
    target.mkdir(parents=True, exist_ok=True)
    for path in model.glob("*.onnx"):
        shutil.copy2(path, target / path.name)
    shutil.copy2("/Users/umangsharma/Desktop/F5-TTS/src/f5_tts/infer/examples/vocab.txt", target / "vocab.txt")
    prompts = args.output / "prompts"
    prompts.mkdir(parents=True, exist_ok=True)
    for path in (repo / "optimization/f5_tts/assets/voice-prompts").glob("*.wav"):
        shutil.copy2(path, prompts / path.name)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
