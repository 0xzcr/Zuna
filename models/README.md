# Local F5 browser assets

The application expects the selected model package at:

```text
models/f5/fp16-nfe8/
  F5_Preprocess.onnx
  F5_Transformer.onnx.part-00.bin ... part-07.bin
  F5_Decode.onnx
  vocab.txt
models/f5/prompts/
  female.wav
  male.wav
```

The transformer is split into 90 MiB parts because Vercel rejects individual files over
100 MiB. These large model files are intentionally not committed. Stage them from the
validated external checkpoint before running or deploying the app:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  optimization/f5_tts/scripts/stage_browser_assets.py \
  --output models/f5 \
  --vocab /Users/umangsharma/Desktop/F5-TTS/src/f5_tts/infer/examples/vocab.txt
```
