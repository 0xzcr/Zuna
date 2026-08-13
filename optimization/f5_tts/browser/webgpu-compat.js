import * as ort from '../../../node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs';

const status = document.querySelector('#status');
const output = document.querySelector('#log');
const started = performance.now();

function log(message) {
  output.textContent += `${message}\n`;
}

async function load(name, providers) {
  const graphStarted = performance.now();
  const path = `../../../.local/models/fp16-nfe8/${name}.onnx`;
  log(`Loading ${name} with ${providers.join(', ')}…`);
  const session = await ort.InferenceSession.create(path, {
    executionProviders: providers,
    graphOptimizationLevel: 'all',
  });
  const elapsed = performance.now() - graphStarted;
  log(`${name}: ready in ${(elapsed / 1000).toFixed(3)}s`);
  return { session, elapsed };
}

try {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable');
  ort.env.logLevel = 'warning';
  ort.env.wasm.numThreads = 1;
  ort.env.webgpu.powerPreference = 'high-performance';
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter was returned');
  log(`WebGPU adapter: ${adapter.info?.device || adapter.info?.description || 'available'}`);

  const transformer = await load('F5_Transformer', ['webgpu']);
  const preprocess = await load('F5_Preprocess', ['wasm']);
  const decode = await load('F5_Decode', ['wasm']);
  const result = {
    status: 'pass',
    ortVersion: '1.27.0',
    webgpu: true,
    transformerLoadSeconds: transformer.elapsed / 1000,
    preprocessLoadSeconds: preprocess.elapsed / 1000,
    decodeLoadSeconds: decode.elapsed / 1000,
    totalSeconds: (performance.now() - started) / 1000,
  };
  window.compatibilityResult = result;
  log(JSON.stringify(result, null, 2));
  status.textContent = 'PASS';
} catch (error) {
  const result = { status: 'fail', message: String(error), stack: error?.stack };
  window.compatibilityResult = result;
  log(JSON.stringify(result, null, 2));
  status.textContent = 'FAIL';
}
