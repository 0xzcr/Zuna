#!/usr/bin/env python3
"""Stage the selected external ONNX package and compact prompts for static hosting."""

import argparse
import json
import shutil
from pathlib import Path

CHUNK_BYTES = 90 * 1024 * 1024


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("backend/models/f5"))
    parser.add_argument("--vocab", type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[4]
    selected = json.loads((repo / "backend/optimization/f5_tts/phases/05-quantization/selected.json").read_text())
    model = Path(selected["artifact_root"])
    target = args.output / "fp16-nfe8"
    target.mkdir(parents=True, exist_ok=True)
    for path in model.glob("*.onnx"):
        if path.name == "F5_Transformer.onnx":
            with path.open("rb") as source:
                index = 0
                while chunk := source.read(CHUNK_BYTES):
                    (target / f"{path.name}.part-{index:02d}.bin").write_bytes(chunk)
                    index += 1
        else:
            shutil.copy2(path, target / path.name)
    shutil.copy2(args.vocab, target / "vocab.txt")
    prompts = args.output / "prompts"
    prompts.mkdir(parents=True, exist_ok=True)
    for path in (repo / "backend/optimization/f5_tts/assets/voice-prompts").glob("*.wav"):
        shutil.copy2(path, prompts / path.name)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
