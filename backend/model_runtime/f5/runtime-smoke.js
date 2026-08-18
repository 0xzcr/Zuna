import * as ort from '../../../node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs';
import { F5Runtime } from './f5-runtime.mjs';

ort.env.wasm.wasmPaths = '../../../node_modules/onnxruntime-web/dist/';
ort.env.wasm.numThreads = Math.min(8, navigator.hardwareConcurrency || 1);
const log = document.querySelector('#log');
const config = {
  baseUrl: '/backend/models/f5/fp16-nfe8', sampleRate: 24000, hopLength: 256, nfeSteps: 8, maxSignalLength: 4096,
  voices: {
    female: { audio: '/backend/models/f5/prompts/female.wav', text: 'You begin to pull away from Mars. ' },
    male: { audio: '/backend/models/f5/prompts/male.wav', text: 'the words on the page came alive. ' },
  },
};

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
