export const DEFAULT_CEILING = 10 ** (-1 / 20); // -1 dBFS

export function peakNormalize(samples, ceiling = DEFAULT_CEILING) {
  if (!(samples instanceof Float32Array) || !(ceiling > 0 && ceiling <= 1)) {
    throw new TypeError('peakNormalize expects Float32Array samples and a ceiling in (0, 1].');
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak <= ceiling) return { samples, gain: 1, peak };
  const gain = ceiling / peak;
  const normalized = new Float32Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) normalized[index] = samples[index] * gain;
  return { samples: normalized, gain, peak };
}
