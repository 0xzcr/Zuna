#!/usr/bin/env python3
"""Score arbitrary TTS candidates listed in a JSON manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from transformers import AutoFeatureExtractor, WavLMForXVector

from score_run import SPEAKER_MODEL, edit_distance, embedding, words


def resolve(base: Path, value: str) -> Path:
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (base / path).resolve()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text())
    base = manifest_path.parent
    feature_extractor = AutoFeatureExtractor.from_pretrained(SPEAKER_MODEL)
    speaker_model = WavLMForXVector.from_pretrained(SPEAKER_MODEL).eval()
    reference_embeddings = {}
    results = []

    for candidate in manifest["samples"]:
        reference = resolve(base, candidate["reference_audio"])
        sample = resolve(base, candidate["sample"])
        transcript = resolve(base, candidate["transcript"]).read_text().strip()
        if reference not in reference_embeddings:
            reference_embeddings[reference] = embedding(
                reference, feature_extractor, speaker_model
            )
        similarity = float(
            embedding(sample, feature_extractor, speaker_model)
            @ reference_embeddings[reference]
        )
        expected_words = words(candidate["expected_text"])
        actual_words = words(transcript)
        errors = edit_distance(expected_words, actual_words)
        audio, sample_rate = sf.read(sample, always_2d=True)
        absolute = np.abs(audio)
        result = {
            **{key: candidate[key] for key in ("voice", "profile", "sample")},
            "transcript": transcript,
            "word_errors": errors,
            "word_count": len(expected_words),
            "wer": errors / len(expected_words),
            "speaker_cosine_similarity": similarity,
            "audio": {
                "sample_rate": sample_rate,
                "channels": audio.shape[1],
                "duration_seconds": audio.shape[0] / sample_rate,
                "peak": float(absolute.max()),
                "rms": float(np.sqrt(np.mean(np.square(audio)))),
                "clipped_samples": int(np.count_nonzero(absolute >= 0.999)),
            },
        }
        results.append(result)
        print(
            f"{candidate['voice']}/{candidate['profile']}: "
            f"WER={result['wer']:.3f} speaker={similarity:.3f}"
        )

    output = {
        "speaker_model": SPEAKER_MODEL,
        "summary": {
            "samples": len(results),
            "mean_wer": float(np.mean([item["wer"] for item in results])),
            "exact_transcripts": sum(item["wer"] == 0 for item in results),
            "mean_speaker_cosine_similarity": float(
                np.mean([item["speaker_cosine_similarity"] for item in results])
            ),
            "unclipped_samples": sum(item["audio"]["clipped_samples"] == 0 for item in results),
        },
        "samples": results,
    }
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(output["summary"], indent=2))


if __name__ == "__main__":
    main()
