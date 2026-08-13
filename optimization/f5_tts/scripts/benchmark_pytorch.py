#!/usr/bin/env python3
"""Run a reproducible, persistent-model PyTorch baseline for the Zuna voices."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import resource
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from f5_tts.api import F5TTS


class Tee:
    def __init__(self, *streams):
        self.streams = streams

    def write(self, value: str) -> int:
        for stream in self.streams:
            stream.write(value)
        return len(value)

    def flush(self) -> None:
        for stream in self.streams:
            stream.flush()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--f5-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path("optimization/f5_tts/runs"))
    return parser.parse_args()


def json_write(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def git_revision(root: Path) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def sync(device: str) -> None:
    if device == "mps":
        torch.mps.synchronize()
    elif device.startswith("cuda"):
        torch.cuda.synchronize()


def memory_snapshot(device: str) -> dict[str, int]:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform != "darwin":
        rss *= 1024
    result = {"peak_rss_bytes": int(rss)}
    if device == "mps":
        result.update(
            mps_current_allocated_bytes=int(torch.mps.current_allocated_memory()),
            mps_driver_allocated_bytes=int(torch.mps.driver_allocated_memory()),
        )
    elif device.startswith("cuda"):
        result.update(
            cuda_current_allocated_bytes=int(torch.cuda.memory_allocated()),
            cuda_peak_allocated_bytes=int(torch.cuda.max_memory_allocated()),
        )
    return result


def audio_metrics(path: Path) -> dict[str, float | int]:
    audio, sample_rate = sf.read(path, always_2d=True)
    absolute = np.abs(audio)
    return {
        "sample_rate": sample_rate,
        "channels": audio.shape[1],
        "samples": audio.shape[0],
        "duration_seconds": audio.shape[0] / sample_rate,
        "peak": float(absolute.max()),
        "rms": float(np.sqrt(np.mean(np.square(audio)))),
        "clipped_samples": int(np.count_nonzero(absolute >= 0.999)),
    }


def main() -> None:
    args = parse_args()
    config_path = args.config.resolve()
    f5_root = args.f5_root.resolve()
    config = json.loads(config_path.read_text())
    checkpoint = f5_root / config["checkpoint"]
    if not checkpoint.is_file():
        raise FileNotFoundError(checkpoint)

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + config["name"]
    run_dir = args.output_root.resolve() / run_id
    samples_dir = run_dir / "samples"
    samples_dir.mkdir(parents=True)
    shutil.copy2(config_path, run_dir / "config.json")
    log = (run_dir / "benchmark.log").open("w", buffering=1)
    sys.stdout = Tee(sys.__stdout__, log)
    sys.stderr = Tee(sys.__stderr__, log)

    environment = {
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version,
        "torch": torch.__version__,
        "device": config["device"],
        "mps_available": torch.backends.mps.is_available(),
        "zuna_git_revision": git_revision(Path.cwd()),
        "f5_tts_git_revision": git_revision(f5_root),
        "checkpoint": str(checkpoint),
        "checkpoint_bytes": checkpoint.stat().st_size,
        "checkpoint_sha256": sha256(checkpoint),
    }
    json_write(run_dir / "environment.json", environment)

    device = config["device"]
    print(f"Run: {run_id}")
    print(f"Checkpoint: {checkpoint}")
    print(f"Device: {device}")
    print("Loading persistent F5-TTS model...")
    load_memory_before = memory_snapshot(device)
    sync(device)
    started = time.perf_counter()
    model = F5TTS(model=config["model"], ckpt_file=str(checkpoint), device=device)
    sync(device)
    load_seconds = time.perf_counter() - started
    load_memory_after = memory_snapshot(device)
    print(f"Model loaded in {load_seconds:.3f}s")

    metrics = {
        "status": "running",
        "run_id": run_id,
        "load_seconds": load_seconds,
        "memory_before_load": load_memory_before,
        "memory_after_load": load_memory_after,
        "samples": [],
    }
    json_write(run_dir / "metrics.json", metrics)

    variants = config.get(
        "variants",
        [
            {
                "name": f"nfe{config['nfe_step']}-cfg{config['cfg_strength']}",
                "nfe_step": config["nfe_step"],
                "cfg_strength": config["cfg_strength"],
            }
        ],
    )
    for variant in variants:
        for voice_name, voice in config["voices"].items():
            reference_audio = f5_root / voice["reference_audio"]
            reference_info = sf.info(reference_audio)
            reference_seconds = reference_info.frames / reference_info.samplerate
            for profile in config["profiles"]:
                for iteration in range(1, config["iterations"] + 1):
                    sample_name = (
                        f"{variant['name']}-{voice_name}-{profile['name']}-iter-{iteration:02d}.wav"
                    )
                    output = samples_dir / sample_name
                    print(
                        f"\n[{variant['name']}/{voice_name}/{profile['name']}/"
                        f"iteration-{iteration}] generating..."
                    )
                    sync(device)
                    started = time.perf_counter()
                    model.infer(
                        ref_file=str(reference_audio),
                        ref_text=voice["reference_text"],
                        gen_text=profile["text"],
                        show_info=lambda message: print(f"  {message}"),
                        progress=None,
                        cfg_strength=variant["cfg_strength"],
                        nfe_step=variant["nfe_step"],
                        sway_sampling_coef=config["sway_sampling_coef"],
                        fix_duration=reference_seconds + profile["target_seconds"],
                        file_wave=str(output),
                        seed=config["seed"],
                    )
                    sync(device)
                    elapsed = time.perf_counter() - started
                    audio = audio_metrics(output)
                    record = {
                        "variant": variant["name"],
                        "nfe_step": variant["nfe_step"],
                        "cfg_strength": variant["cfg_strength"],
                        "voice": voice_name,
                        "profile": profile["name"],
                        "iteration": iteration,
                        "expected_text": profile["text"],
                        "reference_seconds": reference_seconds,
                        "output": str(output.relative_to(run_dir)),
                        "generation_seconds": elapsed,
                        "rtf": elapsed / audio["duration_seconds"],
                        "audio": audio,
                        "memory": memory_snapshot(device),
                    }
                    metrics["samples"].append(record)
                    json_write(run_dir / "metrics.json", metrics)
                    print(
                        f"  {audio['duration_seconds']:.3f}s audio in {elapsed:.3f}s "
                        f"(RTF {record['rtf']:.3f})"
                    )

    metrics["status"] = "complete"
    metrics["completed_at"] = datetime.now(timezone.utc).isoformat()
    json_write(run_dir / "metrics.json", metrics)
    latest = args.output_root.resolve().parent / "latest-run.txt"
    latest.write_text(os.path.relpath(run_dir, Path.cwd()) + os.linesep)
    print(f"\nComplete: {run_dir}")


if __name__ == "__main__":
    main()
