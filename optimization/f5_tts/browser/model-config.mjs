export const F5_MODEL = {
  baseUrl: '/models/f5/fp16-nfe8',
  sampleRate: 24000,
  hopLength: 256,
  nfeSteps: 8,
  maxSignalLength: 4096,
  transformerParts: Array.from({ length: 8 }, (_, index) => `F5_Transformer.onnx.part-${String(index).padStart(2, '0')}.bin`),
  voices: {
    female: { audio: '/models/f5/prompts/female.wav', text: 'You begin to pull away from Mars. ' },
    male: { audio: '/models/f5/prompts/male.wav', text: 'the words on the page came alive. ' },
  },
};
