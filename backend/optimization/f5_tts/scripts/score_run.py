#!/usr/bin/env python3
"""Score saved benchmark samples without rerunning F5-TTS inference."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import torchaudio
from transformers import AutoFeatureExtractor, WavLMForXVector


SPEAKER_MODEL = "microsoft/wavlm-base-plus-sv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--f5-root", type=Path, required=True)
    return parser.parse_args()


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text.lower())


def edit_distance(expected: list[str], actual: list[str]) -> int:
    previous = list(range(len(actual) + 1))
    for row, expected_word in enumerate(expected, 1):
        current = [row]
        for column, actual_word in enumerate(actual, 1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[column] + 1,
                    previous[column - 1] + (expected_word != actual_word),
                )
            )
        previous = current
    return previous[-1]


def load_audio(path: Path, target_rate: int = 16000) -> torch.Tensor:
    audio, sample_rate = sf.read(path, dtype="float32", always_2d=True)
    waveform = torch.from_numpy(audio.mean(axis=1))
    if sample_rate != target_rate:
        waveform = torchaudio.functional.resample(waveform, sample_rate, target_rate)
    return waveform


def embedding(
    path: Path, feature_extractor: AutoFeatureExtractor, model: WavLMForXVector
) -> torch.Tensor:
    waveform = load_audio(path)
    inputs = feature_extractor(waveform.numpy(), sampling_rate=16000, return_tensors="pt")
    with torch.inference_mode():
        vector = model(**inputs).embeddings[0]
    return torch.nn.functional.normalize(vector, dim=0)


def main() -> None:
    args = parse_args()
    run = args.run.resolve()
    f5_root = args.f5_root.resolve()
    config = json.loads((run / "config.json").read_text())
    metrics = json.loads((run / "metrics.json").read_text())
    if metrics["status"] != "complete":
        raise RuntimeError(f"Benchmark is not complete: {metrics['status']}")

    latest_iteration = max(sample["iteration"] for sample in metrics["samples"])
    samples = [sample for sample in metrics["samples"] if sample["iteration"] == latest_iteration]

    print(f"Loading speaker model: {SPEAKER_MODEL}")
    feature_extractor = AutoFeatureExtractor.from_pretrained(SPEAKER_MODEL)
    speaker_model = WavLMForXVector.from_pretrained(SPEAKER_MODEL).eval()
    references = {
        voice: embedding(f5_root / value["reference_audio"], feature_extractor, speaker_model)
        for voice, value in config["voices"].items()
    }

    scored = []
    for sample in samples:
        wav = run / sample["output"]
        transcript_path = run / "asr" / f"{wav.stem}.txt"
        if not transcript_path.is_file():
            raise FileNotFoundError(transcript_path)
        transcript = transcript_path.read_text().strip()
        expected_words = words(sample["expected_text"])
        actual_words = words(transcript)
        errors = edit_distance(expected_words, actual_words)
        similarity = float(
            torch.dot(embedding(wav, feature_extractor, speaker_model), references[sample["voice"]])
        )
        record = {
            "voice": sample["voice"],
            "profile": sample["profile"],
            "sample": sample["output"],
            "expected_text": sample["expected_text"],
            "transcript": transcript,
            "word_errors": errors,
            "word_count": len(expected_words),
            "wer": errors / len(expected_words),
            "speaker_cosine_similarity": similarity,
            "audio_integrity": {
                "sample_rate_24000": sample["audio"]["sample_rate"] == 24000,
                "mono": sample["audio"]["channels"] == 1,
                "non_silent": sample["audio"]["rms"] > 0.005,
                "unclipped": sample["audio"]["clipped_samples"] == 0,
            },
        }
        scored.append(record)
        print(
            f"{sample['voice']}/{sample['profile']}: "
            f"WER={record['wer']:.3f} speaker={similarity:.3f}"
        )

    quality = {
        "speaker_model": SPEAKER_MODEL,
        "iteration_scored": latest_iteration,
        "summary": {
            "samples": len(scored),
            "mean_wer": float(np.mean([sample["wer"] for sample in scored])),
            "exact_transcripts": sum(sample["wer"] == 0 for sample in scored),
            "mean_speaker_cosine_similarity": float(
                np.mean([sample["speaker_cosine_similarity"] for sample in scored])
            ),
            "audio_integrity_passes": sum(
                all(sample["audio_integrity"].values()) for sample in scored
            ),
        },
        "samples": scored,
    }
    (run / "quality.json").write_text(json.dumps(quality, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(quality["summary"], indent=2))


if __name__ == "__main__":
    main()
