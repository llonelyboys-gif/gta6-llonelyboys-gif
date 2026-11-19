// All sound is synthesized with WebAudio — no audio files, no network. An engine hum
// that follows the car, a two-tone siren that swells with the nearest police car, one-shot
// effects, and a quiet bass-and-pad loop. Everything starts on the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A lazy bass line in A minor, one note every 0.22 s, with a soft pad underneath.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (note) tone(note, 0.24, 'triangle', 0.05);
      if (musicStep % 16 === 0) tone(220, 1.6, 'sine', 0.02, 164.81);
    }, 220);
  }

  return {
    /** Call from any user gesture; also (re)starts the music loop. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    get ready() { return started; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() { return muted; },
    /** Engine pitch follows speed; siren swells with the nearest police car. */
    update(dt, speed, sirenNear) {
      if (!ctx) return;
      const target = speed > 20 ? 0.045 + Math.min(0.05, Math.abs(speed) / 9000) : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      const base = 52 + Math.abs(speed) * 0.11;
      engineOsc.frequency.setTargetAtTime(base, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(base * 1.5 + 3, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + Math.abs(speed) * 0.9, ctx.currentTime, 0.1);
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 880 : 660, ctx.currentTime, 0.05);
      }
      sirenGain.gain.setTargetAtTime(muted ? 0 : sirenNear ? 0.035 : 0, ctx.currentTime, 0.2);
    },
    shot() { noise(0.14, 0.35, 2600); tone(190, 0.09, 'square', 0.16, 70); },
    hit() { tone(140, 0.12, 'sawtooth', 0.2, 60); },
    crash() { noise(0.3, 0.4, 700); tone(70, 0.25, 'sine', 0.3, 40); },
    explosion() { noise(0.9, 0.55, 500); tone(55, 0.8, 'sine', 0.4, 28); },
    pickup() { tone(660, 0.09, 'sine', 0.2); window.setTimeout(() => tone(990, 0.12, 'sine', 0.2), 80); },
    cash() { tone(880, 0.08, 'sine', 0.18); window.setTimeout(() => tone(1318, 0.14, 'sine', 0.18), 70); },
    enter() { tone(300, 0.08, 'triangle', 0.2, 420); },
    wanted() { tone(520, 0.16, 'square', 0.12, 780); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.16, 'triangle', 0.2), i * 95)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'sawtooth', 0.14), i * 140)); },
    repair() { tone(440, 0.1, 'triangle', 0.2, 660); },
    click() { tone(700, 0.05, 'square', 0.12); },
  };
}
