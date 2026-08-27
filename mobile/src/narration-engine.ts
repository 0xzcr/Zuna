export type NarrationBackend = 'kokoro' | 'sarvam';

export type NarrationRequest = {
  text: string;
  voiceId: string;
  backend: NarrationBackend;
};

export interface NarrationEngine {
  warm(): Promise<void>;
  generate(request: NarrationRequest): Promise<{ audioPath: string; durationSeconds: number }>;
}

/**
 * Native ONNX integration point for Kokoro-82M.
 * The app must not silently substitute a different cloud or device engine here.
 */
export class KokoroEngine implements NarrationEngine {
  async warm() { /* onnxruntime-react-native will load one session per app session */ }

  async generate(_request: NarrationRequest) {
    throw new Error('Kokoro ONNX runtime is not configured in this build.');
  }
}
