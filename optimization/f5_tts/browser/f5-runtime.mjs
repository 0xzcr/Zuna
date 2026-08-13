import { peakNormalize } from './audio-postprocess.mjs';

const FILES = ['F5_Preprocess.onnx', 'F5_Transformer.onnx', 'F5_Decode.onnx'];

function pcm16Wave(buffer, expectedRate) {
  const view = new DataView(buffer);
  if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) throw new Error('Invalid WAV prompt.');
  let offset = 12;
  let format;
  let data;
  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x666d7420) format = { codec: view.getUint16(offset + 8, true), channels: view.getUint16(offset + 10, true), rate: view.getUint32(offset + 12, true), bits: view.getUint16(offset + 22, true) };
    if (id === 0x64617461) data = [offset + 8, size];
    offset += 8 + size + (size & 1);
  }
  if (!format || !data || format.codec !== 1 || format.bits !== 16 || format.rate !== expectedRate) throw new Error(`Prompt must be ${expectedRate} Hz PCM16 WAV.`);
  const frames = data[1] / 2 / format.channels;
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel += 1) sum += view.getInt16(data[0] + (frame * format.channels + channel) * 2, true);
    samples[frame] = sum / format.channels / 32768;
  }
  return samples;
}

function wav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), true));
  return buffer;
}

export class F5Runtime {
  constructor(ort, config, fetcher = globalThis.fetch.bind(globalThis)) {
    this.ort = ort;
    this.config = config;
    this.fetch = fetcher;
  }

  async load(progress = () => {}) {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const options = (providers) => ({ executionProviders: providers, graphOptimizationLevel: 'all' });
      progress('models');
      const adapter = await globalThis.navigator?.gpu?.requestAdapter?.({ powerPreference: 'high-performance' });
      const transformerProvider = this.config.transformerProvider || (adapter?.limits.maxStorageBuffersPerShaderStage >= 11 ? 'webgpu' : 'wasm');
      const transformerExecutionProvider = transformerProvider === 'webgpu' && this.config.forceCpuNodeNames
        ? { name: 'webgpu', forceCpuNodeNames: this.config.forceCpuNodeNames }
        : transformerProvider;
      // ORT Web initializes its shared WASM core lazily, so sessions must be created serially.
      // F5's Gemm shader needs 11 storage buffers; Apple/Chrome currently exposes only 10.
      const transformer = await this.ort.InferenceSession.create(`${this.config.baseUrl}/${FILES[1]}`, options([transformerExecutionProvider]));
      const preprocess = await this.ort.InferenceSession.create(`${this.config.baseUrl}/${FILES[0]}`, options(['wasm']));
      const decode = await this.ort.InferenceSession.create(`${this.config.baseUrl}/${FILES[2]}`, options(['wasm']));
      const [vocabText, ...voiceBuffers] = await Promise.all([
        this.fetch(`${this.config.baseUrl}/vocab.txt`).then((response) => response.text()),
        ...Object.values(this.config.voices).map(({ audio }) => this.fetch(audio).then((response) => response.arrayBuffer())),
      ]);
      this.sessions = { preprocess, transformer, decode };
      this.transformerProvider = transformerProvider;
      this.vocab = new Map(vocabText.split(/\r?\n/).map((token, index) => [token, index]));
      this.voices = Object.fromEntries(Object.keys(this.config.voices).map((name, index) => [name, pcm16Wave(voiceBuffers[index], this.config.sampleRate)]));
      progress('ready');
      return this;
    })();
    return this.ready;
  }

  tokenize(text) {
    return Int32Array.from([...text].map((character) => this.vocab.get(character) || 0));
  }

  async generate(text, voice, targetSeconds, progress = () => {}) {
    await this.load(progress);
    const profile = this.config.voices[voice];
    const audio = this.voices[voice];
    if (!profile || !audio) throw new Error(`Unknown F5 voice: ${voice}`);
    const ids = this.tokenize(profile.text + text);
    const refFrames = Math.floor(audio.length / this.config.hopLength);
    const duration = refFrames + Math.floor(targetSeconds * this.config.sampleRate / this.config.hopLength);
    const maxDuration = Math.max(ids.length + 1, refFrames + 2, duration);
    if (maxDuration > this.config.maxSignalLength) throw new Error('Passage exceeds the exported F5 signal length.');
    progress('preprocess');
    const prepared = await this.sessions.preprocess.run({
      audio: new this.ort.Tensor('float32', audio, [1, 1, audio.length]),
      text_ids: new this.ort.Tensor('int32', ids, [1, ids.length]),
      max_duration: new this.ort.Tensor('int64', BigInt64Array.of(BigInt(maxDuration)), [1]),
    });
    let noise = prepared.noise;
    const constants = Object.fromEntries(['rope_cos', 'rope_sin', 'cat_mel_text', 'cat_mel_text_drop'].map((name) => [name, prepared[name]]));
    for (let step = 0; step < this.config.nfeSteps; step += 1) {
      progress('transformer', step + 1, this.config.nfeSteps);
      const result = await this.sessions.transformer.run({ ...constants, noise, time_step: new this.ort.Tensor('int32', Int32Array.of(step), [1]) });
      if (noise !== prepared.noise) noise.dispose?.();
      noise = result.denoised;
    }
    progress('decode');
    const result = await this.sessions.decode.run({ denoised: noise, ref_signal_len: prepared.ref_signal_len, rms_scale: prepared.rms_scale, ref_mel_tail: prepared.ref_mel_tail });
    const samples = Float32Array.from(await result.output_audio.getData());
    Object.values(prepared).forEach((tensor) => tensor.dispose?.());
    noise.dispose?.(); result.output_audio.dispose?.();
    return wav(peakNormalize(samples).samples, this.config.sampleRate);
  }
}
