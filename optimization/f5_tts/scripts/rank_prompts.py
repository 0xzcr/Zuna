#!/usr/bin/env python3
"""Rank dataset clips by speaker similarity to a canonical reference."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import soundfile as sf
import torch
from transformers import AutoFeatureExtractor, WavLMForXVector

from score_run import SPEAKER_MODEL, embedding


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--canonical", type=Path, required=True)
    parser.add_argument("--max-seconds", type=float, default=3.5)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    feature_extractor = AutoFeatureExtractor.from_pretrained(SPEAKER_MODEL)
    model = WavLMForXVector.from_pretrained(SPEAKER_MODEL).eval()
    canonical = embedding(args.canonical.resolve(), feature_extractor, model)
    candidates = []
    with args.metadata.open(newline="") as source:
        for row in csv.DictReader(source, delimiter="|"):
            path = Path(row["audio_file"])
            info = sf.info(path)
            duration = info.frames / info.samplerate
            if duration > args.max_seconds:
                continue
            similarity = float(embedding(path, feature_extractor, model) @ canonical)
            candidates.append(
                {
                    "audio": str(path),
                    "text": row["text"],
                    "duration_seconds": duration,
                    "canonical_speaker_cosine_similarity": similarity,
                }
            )
    candidates.sort(key=lambda item: item["canonical_speaker_cosine_similarity"], reverse=True)
    result = {
        "speaker_model": SPEAKER_MODEL,
        "canonical": str(args.canonical.resolve()),
        "max_seconds": args.max_seconds,
        "candidates": candidates,
    }
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    for candidate in candidates[:10]:
        print(
            f"{candidate['canonical_speaker_cosine_similarity']:.3f} "
            f"{candidate['duration_seconds']:.2f}s {Path(candidate['audio']).name} | "
            f"{candidate['text']}"
        )


if __name__ == "__main__":
    main()
