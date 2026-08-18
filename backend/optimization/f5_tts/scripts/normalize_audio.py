#!/usr/bin/env python3
"""Apply the browser's attenuation-only peak normalization to a WAV file."""

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--ceiling-db", type=float, default=-1.0)
    args = parser.parse_args()
    audio, sample_rate = sf.read(args.input, dtype="float32", always_2d=True)
    ceiling = 10 ** (args.ceiling_db / 20)
    peak = float(np.max(np.abs(audio)))
    gain = min(1.0, ceiling / peak) if peak else 1.0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(args.output, audio * gain, sample_rate, subtype="FLOAT", format="WAVEX")
    print(f"peak={peak:.6f} gain={gain:.6f} output_peak={peak * gain:.6f}")


if __name__ == "__main__":
    main()
