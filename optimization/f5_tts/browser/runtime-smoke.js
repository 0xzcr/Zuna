import * as ort from '../../../node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs';
import { F5Runtime } from './f5-runtime.mjs?v=9';

ort.env.wasm.wasmPaths = '../../../node_modules/onnxruntime-web/dist/';
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
const log = document.querySelector('#log');
const config = {
  baseUrl: '../../../.local/models/fp16-nfe8', sampleRate: 24000, hopLength: 256, nfeSteps: 8, maxSignalLength: 4096,
  voices: {
    female: { audio: '../assets/voice-prompts/female.wav', text: 'You begin to pull away from Mars. ' },
    male: { audio: '../assets/voice-prompts/male.wav', text: 'the words on the page came alive. ' },
  },
};
if (new URLSearchParams(location.search).has('fp32')) {
  config.baseUrl = '../../../.local/models/fp32-nfe32';
  config.transformerProvider = 'webgpu';
  config.forceCpuNodeNames = ['/f5_transformer/input_embed/proj/MatMul', '/f5_transformer/input_embed/proj/Add'];
}

try {
  const runtime = new F5Runtime(ort, config);
  const started = performance.now();
  const wav = await runtime.generate('Beyond the window, gentle rain moves through the trees.', 'female', 4, (stage, step, total) => { log.textContent += `${stage}${step ? ` ${step}/${total}` : ''}\n`; });
  window.smokeWav = wav;
  window.smokeResult = { status: 'pass', seconds: (performance.now() - started) / 1000, wavBytes: wav.byteLength };
} catch (error) {
  window.smokeResult = { status: 'fail', message: String(error), stack: error?.stack };
}
log.textContent += JSON.stringify(window.smokeResult, null, 2);
