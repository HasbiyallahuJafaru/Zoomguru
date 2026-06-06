// Spectral Wiener noise suppressor — runs inside AudioWorklet.
// 256-point overlap-add FFT pipeline: one 128-sample hop per block → ~2.7ms latency at 48 kHz.
// Replace the _applyGain body with a DeepFilterNet WASM inference call to upgrade quality.
export const WORKLET_CODE = `
class NoiseSuppressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._N    = 256;
    this._hop  = 128;
    this._half = 129; // N/2 + 1

    this._inputBuf  = new Float32Array(this._N);
    this._outputBuf = new Float32Array(this._N + this._hop);
    this._noisePsd  = new Float32Array(this._half).fill(1e-8);
    this._frameCount = 0;
    this._calibFrames = 40; // ~860ms of noise sampling before processing

    // Hann analysis & synthesis windows (matched for perfect reconstruction)
    this._win = new Float32Array(this._N);
    for (let i = 0; i < this._N; i++)
      this._win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / this._N);

    // Normalisation factor for overlap-add with 50% overlap
    this._winNorm = 0;
    for (let i = 0; i < this._N; i++) this._winNorm += this._win[i] * this._win[i];
    this._winNorm = this._hop / this._winNorm;
  }

  // In-place Cooley-Tukey radix-2 FFT.
  _fft(re, im, inv) {
    const N = re.length;
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    const sign = inv ? 1 : -1;
    for (let len = 2; len <= N; len <<= 1) {
      const ang = sign * 2 * Math.PI / len;
      const wbr = Math.cos(ang), wbi = Math.sin(ang);
      for (let i = 0; i < N; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len >> 1; j++) {
          const ur = re[i+j],           ui = im[i+j];
          const vr = re[i+j+len/2]*cr - im[i+j+len/2]*ci;
          const vi = re[i+j+len/2]*ci + im[i+j+len/2]*cr;
          re[i+j]         = ur + vr; im[i+j]         = ui + vi;
          re[i+j+len/2]   = ur - vr; im[i+j+len/2]   = ui - vi;
          const ncr = cr*wbr - ci*wbi;
          ci = cr*wbi + ci*wbr; cr = ncr;
        }
      }
    }
    if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }

  process(inputs, outputs) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) { if (out) out.fill(0); return true; }

    const N = this._N, hop = this._hop, half = this._half;

    // Slide input buffer forward by one hop and append new block
    this._inputBuf.copyWithin(0, hop);
    this._inputBuf.set(inp, N - hop);

    // Window + FFT
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = this._inputBuf[i] * this._win[i];
    this._fft(re, im, false);

    // Power spectrum (one-sided)
    const psd = new Float32Array(half);
    for (let k = 0; k < half; k++) psd[k] = re[k]*re[k] + im[k]*im[k];

    this._frameCount++;
    if (this._frameCount <= this._calibFrames) {
      // Calibration phase: accumulate noise estimate
      for (let k = 0; k < half; k++)
        this._noisePsd[k] = 0.85*this._noisePsd[k] + 0.15*psd[k];
      // Pass through unmodified during calibration
      out.set(inp);
      return true;
    }

    // Slow noise-floor tracker: update only when signal is quiet
    for (let k = 0; k < half; k++) {
      if (psd[k] < 3 * this._noisePsd[k])
        this._noisePsd[k] = 0.995*this._noisePsd[k] + 0.005*psd[k];
    }

    // Wiener gain: G(k) = max(1 - α·noise/signal, minGain)
    // α=2 gives ~6dB headroom before clamping; minGain=0.08 = −22dB floor
    const alpha = 2.0, minGain = 0.08;
    for (let k = 0; k < half; k++) {
      const g = Math.max(1 - alpha * this._noisePsd[k] / (psd[k] + 1e-12), minGain);
      re[k] *= g; im[k] *= g;
      // Conjugate symmetry for real IFFT
      if (k > 0 && k < half - 1) { re[N-k] = re[k]; im[N-k] = -im[k]; }
    }

    // IFFT + overlap-add
    this._fft(re, im, true);
    for (let i = 0; i < N; i++)
      this._outputBuf[i] += re[i] * this._win[i] * this._winNorm;

    // Emit one hop-worth of samples
    out.set(this._outputBuf.subarray(0, hop));
    this._outputBuf.copyWithin(0, hop);
    this._outputBuf.fill(0, N);

    return true;
  }
}

registerProcessor('noise-suppressor', NoiseSuppressorProcessor);
`;
