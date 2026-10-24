/** Original, entirely synthesized arcade soundtrack. No network or audio assets. */
export class SoundEngine {
  constructor() {
    this.muted = false;
    this.playing = false;
    this.boosting = false;
    this.supported = true;
    this.ctx = null;
    this._disposed = false;
    this._unlocking = null;
    this._timer = null;
    this._voices = new Set();
    this._step = 0;
    this._nextStep = 0;
    this._lastTurn = -1;
    this._lastEat = -1;
  }

  /** Call directly from the first pointer/keyboard gesture. Failure is non-fatal. */
  async unlock() {
    if (this._disposed || !this.supported) return false;
    if (this._unlocking) return this._unlocking;
    this._unlocking = this._open();
    try { return await this._unlocking; }
    finally { this._unlocking = null; }
  }

  async _open() {
    try {
      if (!this.ctx) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) { this.supported = false; return false; }
        this.ctx = new AudioContext();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        const compressor = c.createDynamicsCompressor();
        compressor.threshold.value = -15;
        compressor.knee.value = 16;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;
        this.master.connect(compressor);
        compressor.connect(c.destination);
        this.effects = c.createGain();
        this.effects.gain.value = 0.7;
        this.effects.connect(this.master);
        this.music = c.createGain();
        this.music.gain.value = 0;
        this.music.connect(this.master);

        // A short stereo echo adds space without smearing steering cues.
        this.echoSend = c.createGain();
        this.echoSend.gain.value = 0.15;
        const echo = c.createDelay(1);
        echo.delayTime.value = 60 / 104 / 2;
        const feedback = c.createGain();
        feedback.gain.value = 0.2;
        const echoFilter = c.createBiquadFilter();
        echoFilter.type = 'lowpass';
        echoFilter.frequency.value = 2400;
        this.echoSend.connect(echo);
        echo.connect(echoFilter);
        echoFilter.connect(feedback);
        feedback.connect(echo);
        echoFilter.connect(this.master);

        this._noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const samples = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      if (this.ctx.state !== 'running') return false;
      if (this.playing && !this.muted) this._startMusic();
      return true;
    } catch {
      // An autoplay denial can be retried by the next gesture.
      return false;
    }
  }

  setMuted(value) {
    this.muted = !!value;
    if (!this.ctx || this._disposed) return;
    this._ramp(this.master.gain, this.muted ? 0 : 0.55, 0.04);
    if (this.muted) this._stopMusic();
    else if (this.playing && this.ctx.state === 'running') this._startMusic();
  }

  setPlaying(value) {
    this.playing = !!value;
    if (this.playing && !this.muted && this.ctx?.state === 'running') this._startMusic();
    else this._stopMusic();
  }

  setBoost(value) {
    this.boosting = !!value;
    if (this.ctx && this.playing && !this.muted) {
      this._ramp(this.music.gain, this.boosting ? 0.25 : 0.19, 0.12);
    }
  }

  play(name, value = 1) {
    if (this._disposed || this.muted || this.ctx?.state !== 'running') return;
    const t = this.ctx.currentTime + 0.008;
    const v = Number.isFinite(value) ? value : 1;
    switch (name) {
      case 'eat': {
        if (t - this._lastEat < 0.035) break;
        this._lastEat = t;
        const scale = [0, 3, 7, 10, 12, 15, 19, 22];
        const note = 72 + scale[Math.max(0, Math.floor(v) - 1) % scale.length];
        this._tone(note, t, 0.18, 0.16, { echo: true, end: note + 0.7 });
        this._tone(note + 12, t + 0.035, 0.14, 0.055, { type: 'triangle', pan: 0.15 });
        this._noise(t, 0.045, 0.025, 6000);
        break;
      }
      case 'golden':
        [72, 79, 84, 86, 91, 96].forEach((n, i) =>
          this._tone(n, t + i * 0.047, 0.32, 0.095, { echo: true, pan: (i % 2 ? 1 : -1) * 0.3 }));
        this._tone(48, t, 0.4, 0.12, { type: 'triangle' });
        this._noise(t, 0.2, 0.07, 4800);
        break;
      case 'turn':
        if (t - this._lastTurn < 0.065) break;
        this._lastTurn = t;
        this._tone(86, t, 0.035, 0.022, { end: 70 });
        break;
      case 'boost':
        this._noise(t, 0.34, 0.1, 900, 6200);
        this._tone(38, t, 0.25, 0.1, { type: 'sawtooth', end: 62, filter: 1200 });
        this._tone(74, t + 0.045, 0.26, 0.06, { end: 86, echo: true });
        break;
      case 'death':
        this._stopMusic();
        this._noise(t, 0.44, 0.2, 2500, 150);
        this._tone(43, t, 0.72, 0.22, { type: 'sawtooth', end: 20, filter: 900 });
        [67, 63, 58].forEach((n, i) =>
          this._tone(n, t + i * 0.11, 0.3, 0.07, { type: 'triangle', echo: true }));
        break;
      case 'start':
        [48, 60, 67, 72, 79, 84].forEach((n, i) =>
          this._tone(n, t + i * 0.065, 0.32, 0.085, { echo: true, type: i < 2 ? 'triangle' : 'sine' }));
        break;
      case 'countdown':
        this._tone(v <= 0 ? 84 : 72, t, v <= 0 ? 0.3 : 0.12, 0.11, { echo: v <= 0 });
        break;
      case 'pause':
        this._tone(79, t, 0.12, 0.07);
        this._tone(72, t + 0.07, 0.2, 0.06);
        break;
      case 'resume':
        this._tone(72, t, 0.12, 0.07);
        this._tone(79, t + 0.07, 0.2, 0.06);
        break;
      case 'level':
        [67, 72, 79, 84].forEach((n, i) =>
          this._tone(n, t + i * 0.07, 0.35, 0.085, { echo: true }));
        break;
      case 'ui':
        this._tone(81, t, 0.055, 0.045, { end: 86 });
        break;
    }
  }

  _ramp(param, target, seconds) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(target, t + seconds);
  }

  _tone(note, when, length, level, opts = {}) {
    if (!this.ctx || this._voices.size > 80) return;
    const c = this.ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const frequency = n => 440 * Math.pow(2, (n - 69) / 12);
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(frequency(note), when);
    if (opts.end !== undefined) osc.frequency.exponentialRampToValueAtTime(frequency(opts.end), when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + Math.min(0.012, length / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    const cleanup = [gain];
    if (opts.filter) {
      const filter = c.createBiquadFilter();
      filter.frequency.value = opts.filter;
      filter.Q.value = 0.8;
      osc.connect(filter); filter.connect(gain); cleanup.push(filter);
    } else osc.connect(gain);
    const destination = opts.music ? this.music : this.effects;
    if (opts.pan && c.createStereoPanner) {
      const pan = c.createStereoPanner();
      pan.pan.value = opts.pan;
      gain.connect(pan); pan.connect(destination); cleanup.push(pan);
    } else gain.connect(destination);
    if (opts.echo) gain.connect(this.echoSend);
    this._track(osc, cleanup);
    osc.start(when);
    osc.stop(when + length + 0.02);
  }

  _noise(when, length, level, cutoff = 5000, endCutoff, music = false) {
    if (!this.ctx || this._voices.size > 80) return;
    const c = this.ctx;
    const source = c.createBufferSource();
    source.buffer = this._noiseBuffer;
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = endCutoff ? 'bandpass' : 'highpass';
    filter.Q.value = endCutoff ? 0.7 : 0.4;
    filter.frequency.setValueAtTime(cutoff, when);
    if (endCutoff) filter.frequency.exponentialRampToValueAtTime(endCutoff, when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(level, when + Math.min(0.015, length / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter); filter.connect(gain); gain.connect(music ? this.music : this.effects);
    this._track(source, [filter, gain]);
    source.start(when, Math.random() * 0.4);
    source.stop(when + length + 0.02);
  }

  _track(node, cleanup) {
    this._voices.add(node);
    node.onended = () => {
      this._voices.delete(node);
      node.disconnect();
      cleanup.forEach(n => n.disconnect());
    };
  }

  _startMusic() {
    if (this._timer !== null || this._disposed) return;
    this._nextStep = this.ctx.currentTime + 0.05;
    this._ramp(this.music.gain, this.boosting ? 0.25 : 0.19, 0.3);
    this._scheduleMusic();
  }

  _stopMusic() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    if (this.ctx && this.music) this._ramp(this.music.gain, 0, 0.065);
  }

  _scheduleMusic() {
    if (this._disposed || !this.playing || this.muted || this.ctx?.state !== 'running') {
      this._timer = null;
      return;
    }
    const c = this.ctx;
    // Never replay a backlog after a suspended or backgrounded browser tab.
    if (this._nextStep < c.currentTime - 0.1) this._nextStep = c.currentTime + 0.03;
    while (this._nextStep < c.currentTime + 0.12) {
      this._musicStep(this._step++, this._nextStep);
      this._nextStep += 60 / 104 / 4;
    }
    this._timer = setTimeout(() => this._scheduleMusic(), 40);
  }

  _musicStep(step, t) {
    const beat = step % 16;
    const root = [45, 41, 48, 43][Math.floor(step / 32) % 4];
    // Original four-chord loop, with ample space for the game's sound effects.
    if (beat % 4 === 0) {
      this._tone(39, t, 0.16, 0.22, { music: true, end: 21 });
      this._tone(root - 12, t + 0.015, 0.23, 0.18, { music: true, type: 'triangle', filter: 500 });
    }
    if (beat === 4 || beat === 12) this._noise(t, 0.085, 0.055, 2200, undefined, true);
    if (beat % 2 === 0 || this.boosting) this._noise(t, 0.028, 0.024, 7500, undefined, true);
    const chord = [0, 7, 12, 15, 19, 15, 12, 7];
    if (beat % 2 === 0) {
      this._tone(root + 24 + chord[(beat / 2) % chord.length], t, 0.18, 0.044, {
        music: true, pan: beat % 4 ? -0.3 : 0.3,
      });
    }
    if (beat === 0) {
      [0, 7, 12].forEach((offset, i) => this._tone(root + 12 + offset, t, 1.8, 0.025, {
        music: true, type: 'triangle', filter: 1000, pan: (i - 1) * 0.4,
      }));
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.playing = false;
    this._stopMusic();
    for (const node of this._voices) {
      try { node.stop(); } catch { /* It may already have finished. */ }
    }
    this._voices.clear();
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
  }
}
