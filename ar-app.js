// ar-app.js
// Table view + game controller for Artifact.

const OPPONENT_NAMES = ["Vega", "Orion", "Lyra", "Nova", "Atlas", "Juno", "Rigel", "Halley",
  "Kepler", "Sagan", "Hubble", "Tereshkova", "Gagarin", "Leavitt", "Ride"];
const PLANET_IMG = BODIES.map(b => `img/${b.key}.webp`);

let GAME_SPEED = 1;
const wait = ms => new Promise(r => setTimeout(r, ms * GAME_SPEED));
const IS_TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
const BACKGROUNDS = {"stars": null, "space": {"title": "The Milky Way panorama", "credit": "ESO/S. Brunier (CC BY 4.0)"}, "core": {"title": "The Milky Way, galactic core", "credit": "ESO/S. Brunier (CC BY 4.0)"}, "cliffs": {"title": "Cosmic Cliffs, Carina Nebula (James Webb)", "credit": "NASA, ESA, CSA, STScI"}, "pillars": {"title": "Pillars of Creation (James Webb)", "credit": "NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI)"}, "orion": {"title": "Orion Nebula (Hubble)", "credit": "NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Orion Treasury Project Team"}, "tarantula": {"title": "Tarantula Nebula (James Webb)", "credit": "NASA, ESA, CSA, STScI, Webb ERO Production Team"}, "westerlund": {"title": "Westerlund 2 (Hubble 25th anniversary)", "credit": "NASA, ESA, the Hubble Heritage Team (STScI/AURA), A. Nota (ESA/STScI) and the Westerlund 2 Science Team"}, "deepfield": {"title": "Hubble Ultra Deep Field", "credit": "NASA and ESA"}};
// Corner button icons (drawn, so they look the same everywhere)
const svgIcon = d => `<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  full: svgIcon('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  exitFull: svgIcon('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  sound: svgIcon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted: svgIcon('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  music: svgIcon('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  musicOff: svgIcon('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/><path d="M3 3l18 18"/>'),
  quit: svgIcon('<path d="M6 6l12 12M18 6L6 18"/>'),
  gear: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
};
let BOARD_STYLE = "orbit";   // "orbit" (planets on an arc) | "panel" (one framed board)
const TABLES = ["stars", "space", "core", "cliffs", "pillars", "orion", "tarantula", "westerlund", "deepfield", "green", "walnut", "marble"];
// Where the other players sit (seat 0 is you, along the bottom).
const SEAT_POS = { 2: [null, "top1"], 3: [null, "top1", "top2"], 4: [null, "top1", "top2", "top3"] };   // all opposite you

// ===== Ambient music, generated live =====
// Slow pad chords drifting through A minor, with the odd soft chime echoing
// off into space.
class AmbientMusic {
  constructor(getCtx) { this.getCtx = getCtx; this.on = false; this.timers = []; this.i = 0; }
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  setup() {
    const ctx = this.getCtx();
    if (!ctx || this.master) return !!ctx;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 2200;
    // a long feedback echo gives it space
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 1600;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    this.bus = ctx.createGain();
    this.bus.connect(lp).connect(this.master);
    this.bus.connect(this.delay);
    dlp.connect(this.master);
    this.master.connect(ctx.destination);
    return true;
  }
  start() {
    if (this.on || !this.setup()) return;
    this.on = true;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(1, now + 3);
    this.chord();
    this.sparkle();
  }
  stop() {
    if (!this.on) return;
    this.on = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1.5);
  }
  voice(freq, t0, dur, gain, type = "sine") {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35);
    g.gain.setValueAtTime(gain, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    g.connect(this.bus);
    for (const det of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    }
  }
  chord() {
    if (!this.on) return;
    const CHORDS = [[45, 52, 57, 60, 64], [41, 48, 55, 57, 64], [43, 50, 55, 59, 62], [40, 47, 55, 59, 62], [38, 45, 53, 57, 60]];
    const ch = CHORDS[this.i++ % CHORDS.length];
    const t0 = this.ctx.currentTime + 0.05, dur = 13;
    ch.forEach((m, k) => this.voice(this.midi(m), t0 + k * 0.25, dur, k === 0 ? 0.035 : 0.022, k === 0 ? "sine" : "triangle"));
    this.timers.push(setTimeout(() => this.chord(), 9000));
  }
  sparkle() {
    if (!this.on) return;
    const NOTES = [69, 72, 74, 76, 79, 81, 84, 86];
    const m = NOTES[Math.floor(Math.random() * NOTES.length)];
    const t0 = this.ctx.currentTime + 0.02;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = this.midi(m);
    o.connect(g).connect(this.bus);
    o.start(t0); o.stop(t0 + 2.7);
    this.timers.push(setTimeout(() => this.sparkle(), 2500 + Math.random() * 6000));
  }
}

// ===== A generated starfield with a gentle twinkle =====
const STARFIELD = {
  canvas: null, ctx: null, stars: [], active: false, raf: 0, last: 0,
  setActive(on) {
    this.active = on;
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.id = "starfield";
      document.body.insertBefore(this.canvas, document.body.firstChild);
      this.ctx = this.canvas.getContext("2d");
      window.addEventListener("resize", () => this.build());
    }
    this.canvas.style.display = on ? "block" : "none";
    if (on) { this.build(); this.loop(); }
  },
  build() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.dpr = dpr;
    // Seeded, so the sky stays the same when the window changes size.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.round(W * H / 2600);
    const tints = ["255,255,255", "255,255,255", "255,255,255", "200,220,255", "170,200,255", "255,240,215", "255,215,180"];
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const big = rnd();
      const r = big > 0.985 ? 1.4 + rnd() * 1.0 : big > 0.9 ? 0.9 + rnd() * 0.5 : 0.35 + rnd() * 0.5;
      this.stars.push({
        x: rnd() * W, y: rnd() * H, r,
        a: r > 1.3 ? 0.85 : 0.25 + rnd() * 0.55,
        c: tints[Math.floor(rnd() * tints.length)],
        tw: rnd() < 0.7 ? 0.45 + rnd() * 0.5 : 0.12,        // twinkle depth
        sp: 0.6 + rnd() * 2.2, ph: rnd() * Math.PI * 2       // speed, phase
      });
    }
    // Backdrop (drawn once): black, with a faint, wispy Milky Way band
    // running from bottom left to top right.
    const bg = document.createElement("canvas");
    bg.width = this.canvas.width; bg.height = this.canvas.height;
    const b = bg.getContext("2d");
    b.fillStyle = "#000";
    b.fillRect(0, 0, bg.width, bg.height);
    b.scale(dpr, dpr);
    // The band: 35 degrees, rising to the right, but not too perfect - the
    // centre line wanders, the width swells and pinches, and the light
    // gathers in clumps with gaps between.
    const ang = 35 * Math.PI / 180;
    const ux = Math.cos(ang), uy = -Math.sin(ang), nx = -uy, ny = ux;
    const len = Math.hypot(W, H) * 1.25;
    const cx = W * 0.47, cy = H * 0.56;
    const x0 = cx - ux * len / 2, y0 = cy - uy * len / 2;
    const width = Math.min(W, H) * 0.15;
    const ph = [rnd() * 6.3, rnd() * 6.3, rnd() * 6.3, rnd() * 6.3];
    const wander = t => width * (0.55 * Math.sin(t * 6.3 * 1.2 + ph[0]) + 0.3 * Math.sin(t * 6.3 * 3.3 + ph[1]));
    const breadth = t => width * (0.75 + 0.35 * Math.sin(t * 6.3 * 1.7 + ph[2]) + 0.15 * Math.sin(t * 6.3 * 5.1 + ph[3]));
    const clumps = Array.from({ length: 9 }, () => ({ c: rnd(), w: 0.03 + rnd() * 0.08, h: 0.4 + rnd() * 0.8 }));
    const density = t => 0.25 + clumps.reduce((a, k) => a + k.h * Math.exp(-((t - k.c) ** 2) / (2 * k.w * k.w)), 0);
    const pickT = () => { for (;;) { const t = rnd(); if (rnd() * 1.6 < density(t)) return t; } };
    const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += rnd(); return (u - 2) / 1.15; };
    const at = (t, off) => {
      const o = wander(t) + off * breadth(t) / width;
      return [x0 + ux * len * t + nx * o, y0 + uy * len * t + ny * o];
    };
    // soft glow: faint, stretched, slightly skewed puffs
    for (let k = 0; k < 300; k++) {
      const t = pickT(), [x, y] = at(t, gauss() * width * 0.65);
      const r = breadth(t) * (0.2 + rnd() * 0.55);
      const warm = Math.max(0, 1 - Math.abs(t - 0.52) * 3);
      const col = rnd() < warm * 0.8 ? "255,225,190" : "190,205,255";
      b.save();
      b.translate(x, y);
      b.rotate(-ang + (rnd() - 0.5) * 0.7);
      b.scale(1.5 + rnd() * 2, 0.45 + rnd() * 0.3);
      const g = b.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${col},${(0.014 + rnd() * 0.024).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = g;
      b.fillRect(-r, -r, 2 * r, 2 * r);
      b.restore();
    }
    // ragged dark dust lanes
    for (let k = 0; k < 90; k++) {
      const t = pickT(), [x, y] = at(t, gauss() * width * 0.3);
      const r = breadth(t) * (0.08 + rnd() * 0.28);
      b.save();
      b.translate(x, y);
      b.rotate(-ang + (rnd() - 0.5) * 0.9);
      b.scale(2 + rnd() * 3, 0.3 + rnd() * 0.3);
      const g = b.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(0,0,0,${(0.2 + rnd() * 0.3).toFixed(2)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = g;
      b.fillRect(-r, -r, 2 * r, 2 * r);
      b.restore();
    }
    // the haze of faint stars, thickest where the light gathers
    const dust = Math.round(W * H / 50);
    for (let k = 0; k < dust; k++) {
      const t = pickT(), off = gauss() * width * 0.55, [x, y] = at(t, off);
      const a = (0.05 + rnd() * 0.3) * Math.exp(-(off * off) / (width * width));
      b.fillStyle = `rgba(${rnd() < 0.3 ? "255,235,210" : "215,225,255"},${a.toFixed(3)})`;
      b.fillRect(x, y, 0.6 + rnd() * 0.6, 0.6 + rnd() * 0.6);
    }
    this.backdrop = bg;
    this.draw(performance.now());
  },
  draw(t) {
    const c = this.ctx, d = this.dpr;
    c.drawImage(this.backdrop, 0, 0);
    const s = t / 1000;
    for (const st of this.stars) {
      // two waves at different speeds: a less regular, more starlike flicker
      const w = 0.65 * Math.sin(s * st.sp + st.ph) + 0.35 * Math.sin(s * st.sp * 2.7 + st.ph * 1.7);
      const k = 1 - st.tw * (0.5 + 0.5 * w);
      const a = st.a * k;
      c.fillStyle = `rgba(${st.c},${a.toFixed(3)})`;
      c.beginPath();
      c.arc(st.x * d, st.y * d, st.r * d, 0, Math.PI * 2);
      c.fill();
      if (st.r > 1.3) {   // bright stars get a soft glow and a faint cross
        const g = c.createRadialGradient(st.x * d, st.y * d, 0, st.x * d, st.y * d, st.r * 5 * d);
        g.addColorStop(0, `rgba(${st.c},${(a * 0.35).toFixed(3)})`); g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect((st.x - st.r * 5) * d, (st.y - st.r * 5) * d, st.r * 10 * d, st.r * 10 * d);
        c.fillStyle = `rgba(${st.c},${(a * 0.25).toFixed(3)})`;
        c.fillRect((st.x - st.r * 4) * d, (st.y - 0.25) * d, st.r * 8 * d, 0.5 * d);
        c.fillRect((st.x - 0.25) * d, (st.y - st.r * 4) * d, 0.5 * d, st.r * 8 * d);
      }
    }
  },
  loop() {
    cancelAnimationFrame(this.raf);
    if (!this.active) return;
    const tick = now => {
      if (!this.active) return;
      if (now - this.last > 50) { this.last = now; this.draw(now); }   // ~20 fps is plenty
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
};

class Controller {
  constructor() {
    this.game = new ArtifactGame();
    this.ai = { easy: new ArtifactAI("easy"), medium: new ArtifactAI("medium"), hard: new ArtifactAI("hard") };
    this.playerName = "Player";
    this.numPlayers = 2;
    this.difficulty = "easy";
    this.target = 100;
    this.helpers = true;
    this.names = [];
    this.epoch = 0;
    this.mode = "idle";       // idle | draw | play | peek | move | scan | busy | over
    this.sel = new Set();
    this.fresh = new Set();
    this.doing = {};          // seat -> short text of what they're doing
    this.tut = null;
    this.soundMuted = true;
    this.audioCtx = null;
    this.sfx = { place: new Audio("card-place-2.ogg"), shove: new Audio("card-shove-2.ogg") };
    this.sfx.place.volume = 0.8;
    this.sfx.shove.volume = 0.45;

    try {
      const g = k => localStorage.getItem(k);
      if (g("ar_soundMuted") != null) this.soundMuted = g("ar_soundMuted") === "1";
      this.playerName = g("ar_playerName") || this.playerName;
      if (["2", "3", "4"].includes(g("ar_players"))) this.numPlayers = +g("ar_players");
      if (["easy", "medium", "hard"].includes(g("ar_difficulty"))) this.difficulty = g("ar_difficulty");
      if (["100", "200"].includes(g("ar_target"))) this.target = +g("ar_target");
      this.helpers = g("ar_helpers") !== "off";
      if (g("ar_speed") === "fast") GAME_SPEED = 0.5;
      this.musicOn = g("ar_music") !== "off";
      if (["orbit", "panel"].includes(g("ar_board"))) BOARD_STYLE = g("ar_board");
    } catch (e) { /* ignore */ }

    this.dom = {
      game: document.getElementById("game"),
      track: document.getElementById("track"),
      opps: document.getElementById("opps"),
      sets: document.getElementById("sets"),
      me: null,
      deck: document.getElementById("deck-pile"),
      discard: document.getElementById("discard-pile"),
      status: document.getElementById("status"),
      buttons: document.getElementById("action-buttons"),
      hand: document.getElementById("hand"),
      popup: document.getElementById("popup")
    };

    if (this.musicOn === undefined) this.musicOn = true;
    this.music = new AmbientMusic(() => this.ensureAudioContext());
    this.applySoundMuted();
    this.applyFullscreenUi();
    this.bindTable();
    this.bindQuit();
    this.bindStart();
    this.bindKeys();
    document.getElementById("log-toggle").addEventListener("click", e => {
      const open = document.body.classList.toggle("show-log");
      e.currentTarget.innerHTML = open ? "Log ▼" : "Log ▲";
      const list = document.querySelector("#game-log .log-list");
      if (open && list) list.scrollTop = list.scrollHeight;
    });
    this.bindSettings();
    this.hookLog();
    const stats = document.getElementById("stats");
    document.getElementById("btn-stats").addEventListener("click", () => this.showStats());
    document.getElementById("btn-stats-close").addEventListener("click", () => { stats.style.display = "none"; });
    document.getElementById("btn-stats-reset").addEventListener("click", () => {
      if (confirm("Reset all your stats?")) { try { localStorage.removeItem("ar_stats"); } catch (e) { /* ignore */ } this.showStats(); }
    });
    stats.addEventListener("click", e => { if (e.target === stats) stats.style.display = "none"; });
    document.getElementById("btn-hint-top").addEventListener("click", e => { e.currentTarget.blur(); this.showHint(); });
    const credits = document.getElementById("credits");
    document.getElementById("btn-credits").addEventListener("click", () => { credits.style.display = "flex"; });
    document.getElementById("btn-credits-close").addEventListener("click", () => { credits.style.display = "none"; });
    credits.addEventListener("click", e => { if (e.target === credits) credits.style.display = "none"; });
    this.layout();
    this.game.newGame(this.numPlayers);
    this.game.startHand();
    this.game.phase = "idle";
    this.pickNames();
    this.render();
  }

  // ---------------------------------------------------- in-game settings
  // The Look & feel controls (and Helpers) move into this panel while it's
  // open, so they're the very same controls as on the start screen.
  bindSettings() {
    const btn = document.getElementById("btn-settings"), box = document.getElementById("settings");
    const body = box.querySelector(".settings-body");
    const look = document.querySelector('.tab-pane[data-pane="look"]'), helpers = document.getElementById("helpers-row");
    const homeLook = look.parentNode, lookNext = look.nextSibling;
    const homeHelp = helpers.parentNode, helpNext = helpers.nextSibling;
    btn.innerHTML = ICONS.gear;
    const open = () => {
      btn.blur();
      body.appendChild(helpers);
      body.appendChild(look);
      look.classList.add("in-settings");
      box.style.display = "flex";
    };
    const close = () => {
      box.style.display = "none";
      look.classList.remove("in-settings");
      homeLook.insertBefore(look, lookNext);
      homeHelp.insertBefore(helpers, helpNext);
    };
    btn.addEventListener("click", () => (box.style.display === "flex" ? close() : open()));
    document.getElementById("btn-settings-close").addEventListener("click", close);
    box.addEventListener("click", e => { if (e.target === box) close(); });
  }

  // ---------------------------------------------------- game log

  log(html, cls = "") {
    const list = document.querySelector("#game-log .log-list");
    if (!list) return;
    const row = document.createElement("div");
    row.className = "log-row " + cls;
    row.innerHTML = html;
    list.appendChild(row);
    while (list.children.length > 120) list.removeChild(list.firstChild);
    list.scrollTop = list.scrollHeight;
  }

  clearLog() { const l = document.querySelector("#game-log .log-list"); if (l) l.innerHTML = ""; }

  // Hook the rules engine so every action is logged, whoever makes it.
  hookLog() {
    const g = this.game, self = this;
    const who = p => `<b class="${p === 0 ? "me" : ""}">${self.escape(self.name(p))}</b>`;
    const body = loc => BODIES[loc].name;
    const wrap = (name, fn) => { const orig = g[name].bind(g); g[name] = (...a) => { const r = orig(...a); try { fn(r, ...a); } catch (e) { /* ignore */ } return r; }; };
    wrap("draw", (card, p, from) => {
      if (!card) return;
      self.log(`${who(p)} ${from === "discard" ? `took the <i>${self.escape(card.label)}</i> from the discard` : "drew from the deck"}`);
    });
    wrap("playCards", (res, p) => {
      if (!res) return;
      self.log(`${who(p)} ${res.kind === "meld" ? "set" : "laid off"} ${res.count} × ${body(res.loc)}` +
        (res.close ? ` <span class="x2">close pass</span>` : "") + ` <span class="pts">+${res.count * (res.close ? 4 : 2)}</span>`, res.close ? "close" : "");
      if (res.peek && res.peek.captured) self.log(`${who(p)} captured <span class="art">Artifact ${res.peek.card.name}</span> <span class="pts">+10</span>`, "big");
    });
    wrap("resolvePeek", (ok, p, take) => { if (ok && take) self.log(`${who(p)} took the hidden card`); });
    wrap("moveProbe", (ok, p) => { if (ok) self.log(`probe → ${body(g.probe)}`, "probe"); });
    wrap("useMission", (res, p, id, action, arg) => {
      if (!res) return;
      const what = action === "draw2" ? "drew 2" : action === "salvage" ? "took a card from the discard" : `looked under ${body(arg)}`;
      self.log(`${who(p)} <span class="mc">Mission Control</span>: ${what}`);
    });
    wrap("discardCard", (res, p) => {
      if (!res) return;
      self.log(`${who(p)} discarded <i>${self.escape(res.card.label)}</i>`, "end");
      if (res.handOver) {
        const info = g.endInfo;
        self.log(info.reason === "out" ? `${who(info.outPlayer)} went out <span class="pts">+${info.probe + 1}</span>` : "The deck ran out", "big");
      }
    });
  }

  name(p) { return p === 0 ? (this.playerName.trim() || "Player") : this.names[p - 1]; }

  pickNames() {
    const pool = OPPONENT_NAMES.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    this.names = pool;
  }

  // =====================================================
  // ======================= Layout ======================
  // =====================================================

  // A card table: the board (track, deck, discard) in the middle, your hand
  // along the bottom, the other players round the edges (just a name and
  // a fan of card backs) and everyone's sets in a compact panel on the right.
  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const r = document.documentElement.style;
    const pad = Math.max(6, Math.round(H * 0.012));
    const gap = Math.max(5, Math.round(H * 0.01));
    const n = this.game.numPlayers || this.numPlayers;
    const pos = SEAT_POS[n];
    const hasLeft = pos.includes("left");
    r.setProperty("--card-scale", String(Math.min(1.4, Math.max(0.6, H / 720))));
    const ctrl = document.getElementById("controls");
    const cr = ctrl ? ctrl.getBoundingClientRect() : { height: 40 };
    const ctrlH = cr.height + 12;
    // Phones on their side: a compact table. Opponents sit across the top
    // beside the corner buttons with the turn prompt floating under them, the buttons
    // move to the foot of the right-hand column, Sets and Log share that
    // column as tabs, and the cards grow so they're big enough to tap.
    const compact = W > H && H <= 500;
    document.body.classList.toggle("compact", compact);
    // Hint sits just left of the corner buttons.
    const hb = document.getElementById("btn-hint-top");
    const hintW = hb && hb.offsetWidth ? hb.offsetWidth : 70;
    const ctrlLeft = ctrl && cr.width ? cr.left : W - 240;

    const setsW = compact ? Math.round(Math.max(170, W * 0.2)) : Math.round(Math.max(200, W * 0.21));
    const leftW = hasLeft ? Math.round(W * 0.11) : 0;
    const topH = compact ? Math.round(Math.max(ctrlH, H * 0.2)) : Math.round(H * (W / H < 1.6 ? 0.17 : 0.2));
    const handH = compact ? Math.round(H * 0.28) : Math.round(H * 0.21);
    const seatFont = Math.round(Math.max(11, Math.min(16, H * 0.022)));
    const headH = compact ? 26 : Math.round(seatFont * 1.7);

    // Cards: the hand is a fan along the bottom; deck and discard sit small
    // in the bottom-left corner.
    let ch = Math.round(H * (compact ? 0.28 : 0.15)), cw = Math.round(ch / 1.5);
    const pw = Math.max(34, Math.round(cw * (compact ? 0.82 : 1.05)));
    const pilesW = 2 * pw + 3 * pad;
    const handX = pilesW + 2 * pad, handW = W - setsW - handX - 2 * pad - (compact ? Math.round(cw * 0.35) : 0);   // phones: the tilted end card clears the buttons

    // Board: what's left in the middle.
    const bx0 = leftW + 2 * pad, bx1 = W - setsW - 2 * pad;
    // Prompt + buttons sit just above your hand, above where raised cards reach.
    // (On a phone they sit at the foot of the right-hand column instead, and
    // the hand dips off the bottom edge.)
    const dockH = compact ? Math.round(H * 0.4) : Math.round(Math.max(64, H * 0.085));
    const dockTop = compact ? H - dockH - pad : H - handH - Math.round(ch * 0.32) - dockH;
    // (Phones: the turn prompt floats over the gap under the opponents.)
    const stripH = 0;
    const by0 = topH + pad, by1 = compact ? H - Math.round(ch * 0.98) - pad : dockTop - pad;
    const tw = Math.min((bx1 - bx0) / N_BODIES, 118);
    const fill = compact ? 0.97 : 0.74, tall = compact ? 2.15 : W / H < 1.6 ? 3.1 : 2.4;   // phones and tablets: taller, narrower spaces
    // Orbit style: the planets sit on a gentle arc, so the outer ones dip lower.
    // (Phones: only as tall as the name, picture and number need.)
    const tf0 = Math.round(Math.max(9, Math.min(14, tw * 0.13)));
    const want = compact ? tw * 1.8 + tf0 * 3.5 + 12 : tw * tall;
    const arcH = BOARD_STYLE === "orbit" ? Math.round(Math.min(want, (by1 - by0) * fill) * (compact ? 0.12 : 0.16)) : 0;
    const trackH = Math.round(Math.min(want, (by1 - by0) * fill)) - arcH;
    const boardW = Math.round(tw * N_BODIES), boardH = trackH + arcH;
    const board = { left: Math.round((bx0 + bx1 - boardW) / 2), top: Math.round(by0 + Math.max(0, (by1 - by0 - boardH) * 0.6)), width: boardW, height: boardH };
    const sw = Math.round(Math.min(tw * 0.78, Math.max(pw, tw * 0.6)));   // hidden cards: at least as wide as the deck
    const tipH = Math.round(sw * 0.62);                              // how much of them shows
    const spaceH = trackH - tipH;                                    // the board itself
    const tok = Math.round(compact ? Math.min(tw * 0.56, spaceH * 0.32) : Math.min(tw * 0.66, spaceH * 0.38));        // the probe token
    const tf = Math.round(Math.max(9, Math.min(14, tw * 0.13)));
    const pl = Math.round(Math.min(tw * 0.82, spaceH - tok * (compact ? 0.45 : 0.78) - tf * (compact ? 3.5 : 3.8) - (compact ? 8 : 14)));   // the token overlaps the plinth's edge

    // Opponents
    const topX0 = bx0, topX1 = compact ? Math.min(W - setsW - 2 * pad, ctrlLeft - hintW - 3 * pad) : W - setsW - 2 * pad;
    // Opponents share the top edge, evenly spaced.
    const nOpp = n - 1, slotW = (topX1 - topX0) / nOpp;
    const slot = k => ({ left: Math.round(topX0 + k * slotW), top: pad, width: Math.round(slotW), height: topH - pad });
    const boxes = {
      top1: slot(0), top2: slot(1), top3: slot(2),
      left: { left: pad, top: topH + pad, width: leftW, height: H - handH - topH - 2 * pad }
    };
    // The logo heads the right-hand column, under the corner buttons.
    const logoH = Math.round(setsW / 2.46);
    const logo = { left: W - setsW - pad, top: ctrlH, width: setsW, height: logoH };
    const setsTop = ctrlH + logoH + 2 * pad;
    // Bottom of the right column: the game log.
    const logH = Math.round(Math.max(140, H * 0.3));
    const logBtnH = compact ? 32 : 0;
    const sets = compact
      ? { left: W - setsW - pad, top: ctrlH, width: setsW, height: dockTop - ctrlH - pad }
      : { left: W - setsW - pad, top: setsTop, width: setsW, height: H - setsTop - logH - 2 * pad };
    // (Phones: the log slides up over the column from a Log button at its foot.)
    const logBox = compact ? { left: W - setsW - pad, top: ctrlH, width: setsW, height: H - ctrlH - logBtnH - 2 * pad } : { left: W - setsW - pad, top: H - logH - pad, width: setsW, height: logH };

    const set = (k, v) => r.setProperty(k, typeof v === "number" ? v + "px" : v);
    set("--pad", pad); set("--gap", gap);
    set("--st-l", bx0); set("--st-t", topH); set("--st-w", bx1 - bx0); set("--st-h", stripH);
    set("--cw", cw); set("--ch", ch); set("--tw", tw); set("--pl", pl); set("--sw", sw); set("--pw", pw);
    set("--track-h", trackH); set("--hand-h", handH); set("--arc", arcH);
    document.body.classList.toggle("board-orbit", BOARD_STYLE === "orbit");
    document.body.classList.toggle("board-panel", BOARD_STYLE !== "orbit");
    set("--space-h", spaceH); set("--tok", tok);
    set("--fch", Math.max(26, Math.round(Math.min(topH - headH - 8, leftW ? leftW * 0.7 : 999))));
    set("--smh", Math.round(Math.max(compact ? 40 : 34, Math.min(58, H * 0.068))));   // set cards in the panel
    set("--tile-font", Math.round(Math.max(9, Math.min(14, tw * 0.13))));
    set("--seat-font", seatFont);
    set("--chip-font", Math.round(Math.max(10, Math.min(14, H * 0.019))));
    set("--status-font", compact ? 14 : Math.round(Math.max(12, Math.min(17, H * 0.022))));
    set("--btn-font", compact ? 15 : Math.round(Math.max(12, Math.min(16, H * 0.021))));
    document.body.classList.toggle("faces-large", cw < 64);

    const place = (el, b) => { if (el) Object.assign(el.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" }); };
    place(document.getElementById("board"), board);
    place(this.dom.sets, sets);
    place(document.getElementById("game-log"), logBox);
    place(document.getElementById("side-logo"), logo);
    place(document.getElementById("log-toggle"), { left: W - setsW - pad, top: H - logBtnH - pad, width: setsW, height: logBtnH });
    if (hb) { hb.style.left = "auto"; hb.style.right = Math.round(W - ctrlLeft + 8) + "px"; hb.style.top = (ctrl ? Math.round(cr.top) : 4) + "px"; hb.style.height = Math.round(cr.height || 34) + "px"; }
    const act = document.getElementById("actions");
    place(act, compact
      ? { left: W - setsW - pad, top: dockTop, width: setsW, height: dockH }
      : { left: handX, top: dockTop, width: handW, height: dockH });
    // On a phone the dock grows upwards from the bottom with its text, and the
    // sets panel above it gives way.
    if (act) {
      if (compact) Object.assign(act.style, { top: "auto", bottom: (logBtnH + 2 * pad) + "px", height: "auto", maxHeight: Math.round(H * 0.62) + "px" });
      else act.style.bottom = act.style.maxHeight = "";
      if (!this.dockWatch && window.ResizeObserver) {
        this.dockWatch = new ResizeObserver(() => this.fitDock());
        this.dockWatch.observe(act);
      }
    }
    place(this.dom.hand, { left: handX, top: H - handH, width: handW, height: handH });
    place(document.getElementById("piles"), { left: pad, top: H - Math.round(pw * 1.5) - 22, width: pilesW, height: Math.round(pw * 1.5) + 18 });
    this.L = { arcH, n, W, H, pad, gap, cw, ch, tw, pl, tok, trackH, spaceH, handH, boxes, pos, headH, board, sets, compact };
    this.fitDock();
  }

  // Phones: the sets panel ends just above the dock.
  fitDock() {
    const L = this.L, act = document.getElementById("actions");
    if (!L || !act || !document.body.classList.contains("compact")) return;
    const top = parseFloat(this.dom.sets.style.top) || 0;
    const a = act.getBoundingClientRect();
    this.dom.sets.style.height = Math.max(40, Math.round(a.top - top - L.pad)) + "px";
  }

  // =====================================================
  // ======================= Render ======================
  // =====================================================

  render() {
    if (!this.L || this.L.n !== (this.game.numPlayers || this.numPlayers)) this.layout();
    this.renderTrack();
    this.renderOpps();
    this.renderMe();
    this.renderPiles();
    this.renderHand();
    this.renderActions();
    if (this._spotSel) this.placeSpot(this._spotSel);
  }

  makeCard(card, back = false) {
    const el = document.createElement("div");
    el.className = "acard";
    if (back || !card) { el.classList.add("back"); return el; }
    el.dataset.id = card.id;
    if (card.kind === "body") {
      const b = BODIES[card.loc];
      el.classList.add("body", b.key);
      el.innerHTML =
        `<img class="art" src="${PLANET_IMG[card.loc]}" alt="" draggable="false" style="--f:${relativeSize(card.loc, 0.5).toFixed(3)}">` +
        `<div class="idx"><span class="num">${card.loc + 1}</span></div>` +
        `<div class="cname">${b.name}</div>`;
    } else if (card.kind === "mission") {
      el.classList.add("mission");
      el.innerHTML = `<img class="photo" src="img/mission.webp" alt="" draggable="false"><div class="mc-title">MISSION<br>CONTROL</div>`;
    } else {
      el.classList.add("artifact");
      el.innerHTML = `<img class="art-sym" src="img/artifact-${card.name.toLowerCase()}.webp" alt="${card.name === "Alpha" ? "α" : "β"}" draggable="false"><div class="cname">Artifact ${card.name}</div>`;
    }
    return el;
  }

  renderTrack() {
    const g = this.game, t = this.dom.track;
    t.innerHTML = "";
    const scanning = this.mode === "scan";
    BODIES.forEach((b, i) => {
      const tile = document.createElement("div");
      tile.className = "tile " + b.key + (g.probe === i ? " probe-here" : "");
      tile.dataset.loc = i;
      if (BOARD_STYLE === "orbit") {
        const u = (i / (N_BODIES - 1)) * 2 - 1;
        tile.style.transform = `translateY(${Math.round(this.L.arcH * u * u)}px)`;
      }
      const slot = g.slots ? g.slots[i] : null;
      const seen = g.known && g.known[0] ? g.known[0][i] : null;
      let slotHtml = `<div class="slot empty"></div>`;
      if (slot) {
        let mark = "";
        if (seen && seen === slot) {
          mark = slot.kind === "artifact" ? `<span class="seen art">${slot.name === "Alpha" ? "α" : "β"}</span>`
            : slot.kind === "mission" ? `<span class="seen">MC</span>` : `<span class="seen">${slot.loc + 1}</span>`;
        }
        slotHtml = `<div class="slot hidden" title="${seen === slot ? "You've seen: " + slot.label : "A hidden card"}">${mark}</div>`;
      }
      tile.innerHTML =
        `<div class="space"><div class="tile-name"><span class="nm">${b.name}</span></div>` +
        `<div class="planet-box"><img class="planet" src="${PLANET_IMG[i]}" alt="" draggable="false" style="--f:${relativeSize(i).toFixed(3)}"></div>` +
        `<div class="tile-num">${i + 1}</div></div>` + slotHtml;
      if (scanning && slot) tile.classList.add("clickable", "scan-target");
      t.appendChild(tile);
    });
    if (BOARD_STYLE === "orbit") this.drawOrbit(t);
    const probe = document.createElement("div");
    probe.id = "probe";
    probe.title = "The probe";
    probe.innerHTML = `<img src="img/probe-token.webp" alt="Probe" draggable="false">`;
    t.appendChild(probe);
    this.placeProbe(false);
    if (this.mode === "move") {
      const opts = g.moveOptions();
      const arrows = document.createElement("div");
      arrows.className = "probe-arrows";
      t.appendChild(arrows);
      requestAnimationFrame(() => {
        const tile = t.querySelector(`.tile[data-loc="${g.probe}"]`);
        if (!tile) return;
        const tr = t.getBoundingClientRect(), r = tile.getBoundingClientRect();
        for (const d of opts) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = d < 0 ? "◀" : "▶";
          btn.title = d < 0 ? "Move the probe inward" : "Move the probe outward";
          btn.style.position = "absolute";
          btn.style.top = Math.round(r.top - tr.top + this.L.pl * 0.5 - 19) + "px";
          btn.style.left = Math.round((d < 0 ? r.left - tr.left - 22 : r.right - tr.left - 16)) + "px";
          btn.dataset.dir = d;
          btn.addEventListener("click", e => { e.stopPropagation(); this.humanMove(d); });
          arrows.appendChild(btn);
        }
      });
    }
  }

  // The probe token sits at the foot of its space and slides between them.
  // A dotted orbit through every planet's centre, from the Sun's glow.
  drawOrbit(t) {
    const tr = t.getBoundingClientRect();
    const pts = [...t.querySelectorAll(".tile .planet-box")].map(el => {
      const r = el.getBoundingClientRect();
      return [r.left - tr.left + r.width / 2, r.top - tr.top + r.height / 2];
    });
    if (pts.length < 2) return;
    let d = `M ${pts[0][0] - this.L.tw * 0.6} ${pts[0][1] - this.L.arcH * 0.35} Q ${pts[0][0] - this.L.tw * 0.3} ${pts[0][1]} ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
    }
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "orbit-svg");
    svg.setAttribute("width", tr.width);
    svg.setAttribute("height", tr.height + this.L.arcH);
    svg.innerHTML = `<defs><linearGradient id="orb" x1="0" x2="1"><stop offset="0" stop-color="#ffc85a" stop-opacity="0.9"/><stop offset="0.3" stop-color="#6fd3ff" stop-opacity="0.55"/><stop offset="1" stop-color="#6fd3ff" stop-opacity="0.3"/></linearGradient></defs>` +
      `<path d="${d}" fill="none" stroke="url(#orb)" stroke-width="1.6" stroke-dasharray="2 5" stroke-linecap="round"/>`;
    t.insertBefore(svg, t.firstChild);
  }

  placeProbe(animate = true) {
    const t = this.dom.track, probe = document.getElementById("probe");
    if (!probe) return;
    const tile = t.querySelector(`.tile[data-loc="${this.game.probe}"]`);
    if (!tile) return;
    if (!animate) probe.style.transition = "none";
    const tr = t.getBoundingClientRect(), r = tile.getBoundingClientRect();
    const prev = parseFloat(probe.style.left) || 0;
    const left = Math.round(r.left - tr.left + (r.width - this.L.tok) / 2);
    if (animate && left !== prev) probe.classList.toggle("going-in", left < prev);
    probe.style.left = left + "px";
    probe.style.top = Math.round(r.top - tr.top + this.L.spaceH - this.L.tok * (this.L.compact ? 0.5 : 0.84)) + "px";   // phones: it hangs half off the space
    if (!animate) { probe.getBoundingClientRect(); probe.style.transition = ""; }
  }

  // The cards a player has on the table: one stack per body (close-pass
  // cards glow cyan with a ×2 badge), then captured Artifacts.
  meldsEl(p) {
    const g = this.game;
    const box = document.createElement("div");
    box.className = "melds";
    if (!g.table) return box;
    g.table[p].forEach((t, loc) => {
      const n = t.normal + t.close;
      if (!n) return;
      const m = document.createElement("div");
      m.className = "meld";
      m.dataset.loc = loc;
      m.dataset.seat = p;
      m.title = `${BODIES[loc].name}: ${t.normal} × 2 points${t.close ? `, ${t.close} close pass × 4 points` : ""}`;
      m.dataset.pts = t.normal * 2 + t.close * 4;
      if (this.newChip && this.newChip.p === p && this.newChip.loc === loc) m.classList.add("new");
      for (let k = 0; k < n; k++) {
        const w = document.createElement("div");
        w.className = "mc" + (k >= t.normal ? " close" : "");
        w.appendChild(this.makeCard(new Card(-1, "body", loc)));
        m.appendChild(w);
      }
      box.appendChild(m);
    });
    g.captured[p].forEach(a => {
      const m = document.createElement("div");
      m.className = "meld art";
      const w = document.createElement("div");
      w.className = "mc";
      w.appendChild(this.makeCard(a));
      m.appendChild(w);
      box.appendChild(m);
    });
    return box;
  }

  // An opponent's hand: a little fan of card backs.
  fanEl(n) {
    const f = document.createElement("div");
    f.className = "fan";
    const show = Math.min(n, 12);
    for (let i = 0; i < show; i++) {
      const c = this.makeCard(null, true);
      const t = show > 1 ? i / (show - 1) - 0.5 : 0;
      c.style.setProperty("--a", (t * 34).toFixed(1) + "deg");
      c.style.setProperty("--x", (t * show * 0.16).toFixed(3));
      f.appendChild(c);
    }
    const cnt = document.createElement("div");
    cnt.className = "count";
    cnt.textContent = n;
    f.appendChild(cnt);
    return f;
  }

  // Shrink the overlap (then the cards) until a row of sets fits its box.
  fitMelds(box) {
    let step = 0.62, scale = 1;
    for (let k = 0; k < 14 && box.scrollWidth > box.clientWidth + 1; k++) {
      if (step < 0.86) step += 0.06; else if (scale > 0.5) scale *= 0.9; else break;
      box.style.setProperty("--ov", step.toFixed(2));
      box.style.setProperty("--ms", scale.toFixed(3));
    }
  }

  seatHead(p, compact = false) {
    const g = this.game;
    const handPts = g.table && g.phase !== "handOver" ? g.tablePoints(p) + g.captured[p].length * 10 : 0;
    return `<div class="seat-head"><span class="nm">${this.escape(this.name(p))}</span>` +
      `<span class="score" title="Game score"><b>${g.scores[p] || 0}</b> pts</span>` +
      (handPts ? `<span class="hand-pts" title="Points on the table this hand">+${handPts} this hand</span>` : "") + `</div>`;
  }

  renderOpps() {
    const g = this.game, box = this.dom.opps, L = this.L;
    box.innerHTML = "";
    for (let p = 1; p < g.numPlayers; p++) {
      const where = L.pos[p] || "top";
      const s = document.createElement("div");
      s.className = "pseat at-" + where + (g.phase !== "idle" && g.turn === p && g.phase !== "handOver" ? " active" : "");
      s.dataset.seat = p;
      const b = L.boxes[where];
      Object.assign(s.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" });
      s.innerHTML = this.seatHead(p);
      s.appendChild(this.fanEl(g.hands ? g.hands[p].length : 0));
      if (this.doing[p]) {
        const d = document.createElement("div");
        d.className = "doing-bubble";
        d.textContent = this.doing[p];
        s.appendChild(d);
      }
      box.appendChild(s);
    }
  }

  // Everyone's sets, in a compact panel on the right: you first.
  renderMe() {
    const g = this.game, panel = this.dom.sets;
    panel.innerHTML = "";
    const order = [0];
    for (let p = 1; p < g.numPlayers; p++) order.push(p);
    for (const p of order) {
      const blk = document.createElement("div");
      blk.className = "set-block" + (g.phase !== "idle" && g.turn === p && g.phase !== "handOver" ? " active" : "");
      blk.dataset.seat = p;
      if (p === 0) { blk.id = "me-panel"; this.dom.me = blk; }
      blk.innerHTML = this.seatHead(p, true);
      const melds = this.meldsEl(p);
      if (!melds.children.length) melds.innerHTML = `<span class="empty-note">${p === 0 ? "Your sets go here" : "no sets yet"}</span>`;
      blk.appendChild(melds);
      panel.appendChild(blk);
    }
    this.markTargets();
  }

  // Selected cards that can be laid off light up the matching sets in the
  // panel (click one to lay off); a possible new set lights up your row.
  markTargets() {
    document.querySelectorAll(".meld.target").forEach(m => m.classList.remove("target"));
    if (this.dom.me) this.dom.me.classList.remove("drop-target");
    if (this.mode !== "play" || !this.sel.size) return;
    const g = this.game, ids = [...this.sel];
    if (g.canLayoff(0, ids) && this.tutAllows("layoff", ids)) {
      const loc = g.findCard(0, ids[0]).loc;
      document.querySelectorAll(`.meld[data-loc="${loc}"]`).forEach(m => m.classList.add("target"));
    }
    if (g.canMeld(0, ids) && this.tutAllows("meld", ids) && this.dom.me) this.dom.me.classList.add("drop-target");
  }

  renderPiles() {
    const g = this.game;
    const fill = (pile, card, back, count) => {
      pile.querySelectorAll(".acard, .count").forEach(e => e.remove());
      if (card || back) pile.appendChild(this.makeCard(card, back));
      if (count != null) { const c = document.createElement("div"); c.className = "count"; c.textContent = count; pile.appendChild(c); }
    };
    fill(this.dom.deck, null, g.deck && g.deck.length > 0, g.deck ? g.deck.length : 0);
    fill(this.dom.discard, g.discard ? g.topDiscard() : null, false, null);
    const canDraw = this.mode === "draw";
    this.dom.deck.classList.toggle("can-draw", canDraw && g.deck.length > 0);
    this.dom.discard.classList.toggle("can-draw", canDraw && g.discard.length > 0 && this.tutAllowsDraw("discard"));
    if (canDraw && !this.tutAllowsDraw("deck")) this.dom.deck.classList.remove("can-draw");
    this.dom.deck.classList.toggle("hint-mark", this.hintPile === "deck");
    this.dom.discard.classList.toggle("hint-mark", this.hintPile === "discard");
    this.dom.discard.classList.toggle("can-discard", this.mode === "play" && this.sel.size === 1 && this.game.canDiscard(0));
  }

  sortedHand() {
    const order = c => (c.kind === "body" ? c.loc : c.kind === "mission" ? 20 : 30);
    return this.game.hands ? this.game.hand(0).slice().sort((a, b) => order(a) - order(b) || a.id - b.id) : [];
  }

  // Your hand, fanned: cards spread along a gentle arc.
  renderHand() {
    const box = this.dom.hand;
    box.innerHTML = "";
    const cards = this.sortedHand();
    const W = box.getBoundingClientRect().width || this.L.W;
    const cw = this.L.cw, n = cards.length;
    const step = n > 1 ? Math.min(cw * (this.L.compact ? 0.7 : 0.62), (W - cw * 1.4) / (n - 1)) : 0;
    const spread = Math.min(4.2, 36 / Math.max(1, n - 1));     // degrees between cards
    const x0 = (W - cw - step * (n - 1)) / 2;
    const playable = this.helpers && this.mode === "play" ? this.playableIds() : new Set();
    cards.forEach((c, i) => {
      const el = this.makeCard(c);
      const t = n > 1 ? i - (n - 1) / 2 : 0;
      el.style.left = Math.round(x0 + i * step) + "px";
      el.style.setProperty("--rot", (t * spread).toFixed(2) + "deg");
      el.style.setProperty("--dy", (t * t * 0.6).toFixed(1) + "px");
      el.style.zIndex = String(10 + i);
      if (this.sel.has(c.id)) el.classList.add("sel");
      if (playable.has(c.id)) el.classList.add("playable");
      if (this.fresh.has(c.id)) el.classList.add("fresh");
      box.appendChild(el);
    });
    this.fresh.clear();
  }

  // Cards that could be played right now (in some set or lay-off).
  playableIds() {
    const g = this.game, out = new Set();
    if (g.phase !== "play" || g.turn !== 0) return out;
    const hand = g.hand(0);
    const spare = hand.length - 1;
    const groups = {};
    hand.forEach(c => { if (c.kind === "body") (groups[c.loc] = groups[c.loc] || []).push(c); });
    for (const [loc, cs] of Object.entries(groups)) {
      if ((cs.length >= 3 && spare >= 3) || (g.melded[loc] && spare >= 1)) cs.forEach(c => out.add(c.id));
    }
    if (!g.missionUsed) hand.forEach(c => { if (c.kind === "mission") out.add(c.id); });
    return out;
  }

  updateHintButton() {
    const hb = document.getElementById("btn-hint-top");
    if (!hb) return;
    const g = this.game;
    const usable = !this.tut && g.phase !== "idle" && g.phase !== "handOver" && g.turn === 0 && ["draw", "play", "move"].includes(this.mode);
    hb.disabled = !usable;
    hb.style.display = this.tut || g.phase === "idle" ? "none" : "";
  }

  renderActions() {
    this.updateHintButton();
    const g = this.game, b = this.dom.buttons;
    b.innerHTML = "";
    const add = (label, cls, fn, enabled = true, title = "") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = label;
      if (cls) btn.className = cls;
      btn.disabled = !enabled;
      if (title) btn.title = title;
      btn.addEventListener("click", fn);
      b.appendChild(btn);
      return btn;
    };
    if (g.phase === "idle") { this.setStatus(""); return; }
    if (g.turn !== 0) { this.setStatus(g.phase === "handOver" || (this.L && this.L.compact) ? "" : `${this.escape(this.name(g.turn))} is playing…`); return; }
    if (this.mode === "busy") { this.setStatus(""); return; }

    const hintBtn = () => {};   // the Hint button lives by the corner controls
    if (this.mode === "draw") {
      this.setStatus("Your turn: <b>draw a card</b> from the deck or the discard pile.");
      hintBtn();
      return;
    }
    if (this.mode === "move") {
      this.setStatus("Move the probe one step, <b>◀ inward</b> or <b>outward ▶</b> (the arrows on the track).");
      for (const d of g.moveOptions().slice().sort((a, b) => a - b)) add(d < 0 ? "◀ Inward" : "Outward ▶", "", () => this.humanMove(d), true, d < 0 ? "Left arrow" : "Right arrow").dataset.dir = d;
      hintBtn();
      return;
    }
    if (this.mode === "scan") {
      this.setStatus("<b>Click a planet</b> on the track to look at the card hidden under it.");
      return;
    }
    if (this.mode !== "play") return;

    const ids = [...this.sel];
    const cards = ids.map(id => g.findCard(0, id)).filter(Boolean);
    const allBody = cards.length && cards.every(c => c.kind === "body" && c.loc === cards[0].loc);
    const loc = allBody ? cards[0].loc : -1;
    const close = loc === g.probe;
    const canMeld = g.canMeld(0, ids), canLay = g.canLayoff(0, ids);
    const one = cards.length === 1 ? cards[0] : null;

    if (!cards.length) {
      this.setStatus(`Select cards to play a <b>set</b> of 3+ of one planet, a <b>lay-off</b> onto any set already on the table, or a <b>Mission Control</b> card. Then select one card to <b>discard</b>.`);
    } else if (allBody) {
      const where = BODIES[loc].name, n = cards.length;
      let msg;
      if (canMeld || canLay) {
        msg = `${n} × ${where} as ${canMeld ? "a new set" : "a lay-off"}, ` + (close ? `<b>close pass</b>, 4 points each` : `2 points each`) + ".";
      } else if (g.hand(0).length - n < 1) {
        msg = `${n} × ${where}. You must keep one card to discard.`;
      } else {
        const need = 3 - n;
        msg = `${n} × ${where}. You need ${need} more for a set (no ${where} set is on the table yet).` + (n === 1 ? " Or discard it." : "");
      }
      this.setStatus(msg);
    } else if (one && one.kind === "mission") {
      this.setStatus(g.missionUsed ? "You've already used Mission Control this turn." : "Choose a Mission Control action, or discard the card.");
    } else {
      this.setStatus("Those cards don't go together.");
    }

    if (canMeld) add(`New set${close ? " ×2" : ""} <small>(probe ▶)</small>`, "go", () => this.humanPlay("meld"), this.tutAllows("meld", ids));
    if (canLay) add(`Lay off${close ? " ×2" : ""} <small>(probe ◀▶)</small>`, "go", () => this.humanPlay("layoff"), this.tutAllows("layoff", ids));
    if (one && one.kind === "mission" && g.canUseMission(0, one.id)) {
      add("Draw 2", "mc", () => this.humanMission("draw2"), g.canMissionAction(0, one.id, "draw2") && this.tutAllows("mission", ["draw2"])).dataset.act = "draw2";
      add("Take from discard", "mc", () => this.humanMission("salvage"), g.canMissionAction(0, one.id, "salvage") && this.tutAllows("mission", ["salvage"])).dataset.act = "salvage";
      add("Look under…", "mc", () => this.humanMission("scan"), g.canMissionAction(0, one.id, "scan") && this.tutAllows("mission", ["scan"])).dataset.act = "scan";
    }
    if (one && g.canDiscard(0)) add("Discard ▸ end turn", "discard", () => this.humanDiscard(), this.tutAllows("discard", ids));
    if (cards.length) add("Clear", "quiet", () => { this.clearHint(); this.sel.clear(); this.render(); }, true, "Clear selection (C)");
    hintBtn();
  }

  setStatus(html) { this.dom.status.innerHTML = this.touchWords(this.hintText || html); }

  // On a touch screen you tap, not click.
  touchWords(t) { return IS_TOUCH && t ? String(t).replace(/\bClick\b/g, "Tap").replace(/\bclick\b/g, "tap") : t; }

  clearHint() { this.hintText = null; this.hintPile = null; document.querySelectorAll(".hint-glow").forEach(e => e.remove()); }

  // Hint: what a strong player would do now (it selects the cards for you).
  showHint() {
    if (this.tut || this.game.turn !== 0) return;
    const g = this.game, ai = this.hintAI || (this.hintAI = new ArtifactAI("hard"));
    this.clearHint();
    if (this.mode === "draw") {
      const from = ai.chooseDraw(g, 0);
      this.hintPile = from;
      this.hintText = from === "discard" ? "Hint: take the <b>discard</b>, it helps a set." : "Hint: draw from the <b>deck</b>.";
      this.hintTargets = [from === "discard" ? "#discard-pile" : "#deck-pile"];
    } else if (this.mode === "move") {
      const d = ai.chooseMove(g, 0, g.moveOptions());
      this.hintText = `Hint: move the probe <b>${d < 0 ? "◀ inward" : "outward ▶"}</b>.`;
      this.hintTargets = [`#action-buttons button[data-dir="${d}"]`, `.probe-arrows button[data-dir="${d}"]`, `#track .tile[data-loc="${g.probe + d}"] .space`];
    } else if (this.mode === "play") {
      const a = ai.choosePlay(g, 0);
      this.sel.clear();
      if (a && a.type === "mission") {
        this.sel.add(a.id);
        const what = { draw2: "Draw 2", salvage: "Take from discard", scan: "Look under…" }[a.action];
        this.hintText = `Hint: use <b>Mission Control</b> and try <b>${what}</b>.`;
        this.hintTargets = [`#hand .acard[data-id="${a.id}"]`, `#action-buttons button[data-act="${a.action}"]`];
      } else if (a) {
        a.ids.forEach(id => this.sel.add(id));
        const c = g.findCard(0, a.ids[0]);
        this.hintText = `Hint: ${a.type === "meld" ? "play these as a <b>new set</b>" : "<b>lay off</b> these"} (${a.ids.length} × ${BODIES[c.loc].name}).`;
        this.hintTargets = [...a.ids.map(id => `#hand .acard[data-id="${id}"]`), "#action-buttons button.go",
          ...(a.type === "layoff" ? [`.meld[data-loc="${c.loc}"]`] : [])];
      } else {
        const id = ai.chooseDiscard(g, 0);
        this.sel.add(id);
        this.hintText = `Hint: nothing worth playing, so <b>discard</b> the ${g.findCard(0, id).label}.`;
        this.hintTargets = [`#hand .acard[data-id="${id}"]`, "#discard-pile", "#action-buttons button.discard"];
      }
    } else return;
    this.render();
    this.flashHint(this.hintTargets || []);
  }

  // Glowing outlines around what the hint is about, fading out.
  flashHint(selectors) {
    document.querySelectorAll(".hint-glow").forEach(e => e.remove());
    requestAnimationFrame(() => {
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const r = el.getBoundingClientRect();
          if (!r.width) return;
          const g = document.createElement("div");
          g.className = "hint-glow";
          const pad = 4;
          Object.assign(g.style, { left: (r.left - pad) + "px", top: (r.top - pad) + "px", width: (r.width + 2 * pad) + "px", height: (r.height + 2 * pad) + "px" });
          document.body.appendChild(g);
          setTimeout(() => g.remove(), 4200);
        });
      }
    });
  }

  escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  toast(html, cls = "", ms = 1600) {
    document.querySelectorAll(".toast").forEach(e => e.remove());   // one at a time
    const t = document.createElement("div");
    t.className = "toast " + cls;
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms * Math.max(0.6, GAME_SPEED));
  }

  // =====================================================
  // ===================== Animation =====================
  // =====================================================

  rectOf(el) { return el.getBoundingClientRect(); }

  // Fly a card (or a back) from one rect to another.
  fly(card, from, to, { back = false, dur = 380 } = {}) {
    this.sfxSlide(dur);
    dur *= GAME_SPEED;
    const el = this.makeCard(card, back);
    el.classList.add("flying");
    const cw = this.L.cw, ch = this.L.ch;
    // Positions are copied now, so later re-renders can't move the target.
    const pos = (r) => ({ x: r.left + r.width / 2 - cw / 2, y: r.top + r.height / 2 - ch / 2, s: Math.max(0.15, Math.min(1, r.height / ch)) });
    const a = pos(from), b = pos(to);
    Object.assign(el.style, { left: a.x + "px", top: a.y + "px", transform: `scale(${a.s})` });
    document.body.appendChild(el);
    return new Promise(res => {
      const start = performance.now();
      let done = false;
      const end = () => { if (done) return; done = true; el.remove(); res(); };
      const step = now => {
        if (done) return;
        const t = Math.min(1, (now - start) / dur), e = t * t * (3 - 2 * t);
        el.style.left = (a.x + (b.x - a.x) * e) + "px";
        el.style.top = (a.y + (b.y - a.y) * e) + "px";
        el.style.transform = `scale(${a.s + (b.s - a.s) * e})`;
        if (t < 1) requestAnimationFrame(step); else end();
      };
      requestAnimationFrame(step);
      setTimeout(end, dur + 200);
    });
  }

  seatRect(p) {
    const el = p === 0 ? this.dom.me : this.dom.opps.querySelector(`.pseat[data-seat="${p}"] .fan`);
    return el ? this.rectOf(el) : this.rectOf(this.dom.opps);
  }

  // Where a set of `loc` sits in the sets panel (after a render), or null.
  meldEl(p, loc) {
    return this.dom.sets.querySelector(`.set-block[data-seat="${p}"] .meld[data-loc="${loc}"]`);
  }

  // Fly cards into their stack: the stack is drawn first (hidden), so they
  // land exactly on it.
  async flyToStack(p, loc, cards, fromRects) {
    fromRects = fromRects.map(r => ({ left: r.left, top: r.top, width: r.width, height: r.height }));
    this.newChip = { p, loc };
    this.render();
    this.newChip = null;
    const meld = this.meldEl(p, loc);
    const tr = meld ? this.rectOf(meld.lastElementChild || meld) : this.setsRect(p);
    const tgt = { left: tr.left, top: tr.top, width: tr.width, height: tr.height };
    if (meld) meld.style.visibility = "hidden";
    await Promise.all(cards.map((c, i) => wait(i * 60).then(() => this.fly(c, fromRects[i] || fromRects[0], tgt, { dur: 380 }))));
    if (meld) {
      meld.style.visibility = "";
      meld.classList.remove("new"); void meld.offsetWidth; meld.classList.add("new");
    }
  }

  setsRect(p) {
    const el = this.dom.sets.querySelector(`.set-block[data-seat="${p}"]`);
    return el ? this.rectOf(el) : this.rectOf(this.dom.sets);
  }

  handRect() {
    const r = this.rectOf(this.dom.hand);
    return { left: r.left + r.width / 2 - this.L.cw / 2, top: r.bottom - this.L.ch - this.L.pad, width: this.L.cw, height: this.L.ch };
  }

  tileRect(loc) {
    const t = this.dom.track.querySelector(`.tile[data-loc="${loc}"] .slot`);
    return t ? this.rectOf(t) : this.rectOf(this.dom.track);
  }

  async moveProbeAnim(p, dir) {
    this.game.moveProbe(p, dir);
    this.placeProbe(true);
    this.sfxWhoosh(dir);
    await wait(520);
    this.renderTrack();
  }

  // =====================================================
  // ===================== Game flow =====================
  // =====================================================

  startGame() {
    this.epoch++;
    this.tut = null;
    this.hideCoach();
    this.pickNames();
    this.game.newGame(this.numPlayers, { target: this.target });
    this.startHand();
  }

  startHand(preset = null) {
    const ep = this.epoch;
    if (!preset && this.game.handNo === 0) this.clearLog();
    setTimeout(() => this.log(`Hand ${this.game.handNo} · probe at Mercury`, "hand"), 0);
    this.layout();
    this.sel.clear();
    this.doing = {};
    this.statusLocked = false;
    this.game.startHand(preset);
    this.mode = "busy";
    this.layout();
    this.render();
    (async () => {
      await this.dealAnim(ep);
      if (ep !== this.epoch) return;
      this.toast(`${this.game.turn === 0 ? "You start" : this.escape(this.name(this.game.turn)) + " starts"} · the probe is at Mercury`, "", 1500);
      await wait(600);
      if (ep !== this.epoch) return;
      this.nextTurn();
    })();
  }

  async dealAnim(ep) {
    const deckR = this.rectOf(this.dom.deck);
    const flights = [];
    for (let i = 0; i < 6; i++) {
      for (let p = 0; p < this.game.numPlayers; p++) {
        const to = p === 0 ? this.handRect() : this.seatRect(p);
        flights.push(wait(i * 70 + p * 25).then(() => this.fly(null, deckR, to, { back: true, dur: 300 })));
      }
    }
    for (let l = 0; l < N_BODIES; l++) flights.push(wait(200 + l * 40).then(() => this.fly(null, deckR, this.tileRect(l), { back: true, dur: 320 })));
    this.playSfx(this.sfx.shove);
    await Promise.all(flights);
  }

  nextTurn() {
    const g = this.game;
    this.clearHint();
    if (g.phase === "handOver") return this.handOver();
    this.sel.clear();
    if (g.turn === 0) {
      this.mode = "draw";
      this.statusLocked = false;
      this.render();
      if (this.tut) this.tutOnTurn();
    } else {
      this.aiTurn();
    }
  }

  // ---------------------------------------------------- your actions

  bindTable() {
    this.dom.deck.addEventListener("click", () => this.humanDraw("deck"));
    this.dom.discard.addEventListener("click", () => {
      if (this.mode === "play" && this.sel.size === 1) this.humanDiscard();
      else this.humanDraw("discard");
    });
    this.dom.hand.addEventListener("click", e => {
      const el = e.target.closest(".acard");
      if (!el || this.mode !== "play") return;
      const id = +el.dataset.id;
      this.clearHint();
      if (this.sel.has(id)) this.sel.delete(id); else this.sel.add(id);
      this.render();
    });
    document.getElementById("game").addEventListener("click", e => {
      if (this.mode !== "play" || !this.sel.size) return;
      const m = e.target.closest(".meld.target");
      if (m) { this.humanPlay("layoff"); return; }
      if (e.target.closest("#me-panel.drop-target")) this.humanPlay("meld");
    });
    this.dom.track.addEventListener("click", e => {
      const tile = e.target.closest(".tile");
      if (!tile || this.mode !== "scan") return;
      this.humanScan(+tile.dataset.loc);
    });
  }

  async humanDraw(from) {
    this.clearHint();
    if (this.mode !== "draw") return;
    const g = this.game;
    if (!this.tutAllowsDraw(from)) return;
    const pile = from === "discard" ? this.dom.discard : this.dom.deck;
    const top = from === "discard" ? g.topDiscard() : null;
    if (from === "discard" && !top) return;
    this.mode = "busy";
    const ep = this.epoch;
    const fromR = this.rectOf(pile);
    const card = g.draw(0, from);
    if (!card) { this.mode = "draw"; return; }
    this.renderPiles();
    await this.fly(card, fromR, this.handRect(), { dur: 340 });
    if (ep !== this.epoch) return;
    this.playSfx(this.sfx.place);
    this.fresh.add(card.id);
    this.mode = "play";
    this.render();
    this.tutDone("draw", { from });
  }

  async humanPlay(kind) {
    this.clearHint();
    const g = this.game, ids = [...this.sel];
    if (!(kind === "meld" ? g.canMeld(0, ids) : g.canLayoff(0, ids))) return;
    if (!this.tutAllows(kind, ids)) return;
    const ep = this.epoch;
    this.mode = "busy";
    const rects = ids.map(id => { const el = this.dom.hand.querySelector(`.acard[data-id="${id}"]`); return el ? this.rectOf(el) : this.handRect(); });
    const cards = ids.map(id => g.findCard(0, id));
    this.sel.clear();
    const slotR = this.slotRect(cards[0].loc);
    const res = g.playCards(0, ids, kind);
    res.slotR = slotR;
    await this.flyToStack(0, res.loc, cards, rects);
    if (ep !== this.epoch) return;
    this.playSfx(this.sfx.place);
    if (res.close) this.sfxChime();
    if (res.close) this.toast(`Close pass at ${BODIES[res.loc].name}, ${res.count} × 4 points`, "", 1600);
    await this.afterPlayPeek(0, res);
    if (ep !== this.epoch) return;
    this.tutDone(kind, { loc: res.loc });
  }

  // Show what was under the body, then go on to moving the probe.
  async afterPlayPeek(p, res) {
    const g = this.game, ep = this.epoch;
    if (res.peek) {
      const pk = res.peek, where = BODIES[res.loc].name;
      const lifted = await this.liftPeek(res.loc, pk.card, true, res.slotR);
      if (ep !== this.epoch) return lifted.el.remove();
      if (pk.captured) {
        await this.celebrate(lifted, pk.card, 0, `Artifact ${pk.card.name} captured! <b>+10</b>`);
      } else if (pk.mustLeave) {
        lifted.el.classList.add("glow");
        this.sfxSignal(true);
        await this.askAtPeek(lifted, `<b>An Artifact!</b> It's under ${where}, but the probe isn't here, so you must leave it. Bring the probe to ${where} and play ${where} cards to capture it.`,
          [{ label: "OK", cls: "go", value: true }]);
        await this.sinkPeek(lifted);
      } else {
        const take = await this.askAtPeek(lifted, `This was under <b>${where}</b>. Take it, or leave it?`,
          [{ label: "Take it", cls: "go", value: true }, { label: "Leave it", cls: "quiet", value: false }], "peek");
        if (ep !== this.epoch) return lifted.el.remove();
        g.resolvePeek(0, take);
        if (take) { await this.peekToHand(lifted, pk.card); this.fresh.add(pk.card.id); }
        else await this.sinkPeek(lifted);
      }
      if (ep !== this.epoch) return;
      this.render();
    }
    await this.startMove();
  }

  // ---------------------------------------------------- the hidden cards

  slotRect(loc) {
    const el = this.dom.track.querySelector(`.tile[data-loc="${loc}"] .slot`);
    return el ? this.rectOf(el) : null;
  }

  // Lift the hidden card under `loc` up over the board; flip it if `reveal`.
  async liftPeek(loc, card, reveal, slotR = null) {
    const sr = slotR || this.slotRect(loc) || this.rectOf(this.dom.track);
    const slotEl = this.dom.track.querySelector(`.tile[data-loc="${loc}"] .slot`);
    if (slotEl) slotEl.style.visibility = "hidden";
    const w = Math.round(this.L.cw * 1.15), h = Math.round(w * 1.5);
    const el = document.createElement("div");
    el.className = "pk";
    el.innerHTML = `<div class="pk-in"><div class="pk-face pk-back"></div><div class="pk-face pk-front"></div></div>`;
    el.querySelector(".pk-back").appendChild(this.makeCard(null, true));
    if (card) el.querySelector(".pk-front").appendChild(this.makeCard(card));
    Object.assign(el.style, { width: w + "px", height: h + "px", left: (sr.left + sr.width / 2 - w / 2) + "px",
      top: (sr.top + sr.height / 2 - h / 2) + "px", transform: `scale(${(sr.width / w).toFixed(3)})` });
    document.body.appendChild(el);
    void el.offsetWidth;
    const tile = this.rectOf(this.dom.track.querySelector(`.tile[data-loc="${loc}"]`) || this.dom.track);
    el.style.transition = `left ${0.4 * GAME_SPEED}s ease, top ${0.4 * GAME_SPEED}s ease, transform ${0.4 * GAME_SPEED}s ease`;
    const x = Math.round(tile.left + tile.width / 2 - w / 2), y = Math.round(tile.top + this.L.trackH - h * 0.55);
    el.style.left = x + "px";
    el.style.top = y + "px";
    // The tutorial's last prompt would sit on top of this: tuck it away.
    [document.getElementById("coach"), ...document.querySelectorAll(".tut-spot-box")].forEach(e => { if (e) e.style.visibility = "hidden"; });
    el.style.transform = "scale(1)";
    this.sfxPeek();
    await wait(420);
    if (reveal) { el.classList.add("flipped"); await wait(480); }
    return { el, sr, slotEl, w, h, x, y };
  }

  showCoachAgain() {
    [document.getElementById("coach"), ...document.querySelectorAll(".tut-spot-box")].forEach(e => { if (e) e.style.visibility = ""; });
  }

  async sinkPeek(pk) {
    const { el, sr, slotEl, w, h } = pk;
    el.classList.remove("flipped");
    await wait(280);
    el.style.left = (sr.left + sr.width / 2 - w / 2) + "px";
    el.style.top = (sr.top + sr.height / 2 - h / 2) + "px";
    el.style.transform = `scale(${(sr.width / w).toFixed(3)})`;
    await wait(420);
    el.remove();
    if (slotEl) slotEl.style.visibility = "";
    this.showCoachAgain();
  }

  async peekToHand(pk, card) {
    const r = this.rectOf(pk.el);
    pk.el.remove();
    this.showCoachAgain();
    await this.fly(card, r, this.handRect(), { dur: 360 });
  }

  async peekToSeat(pk, p) {
    const r = this.rectOf(pk.el);
    pk.el.remove();
    this.showCoachAgain();
    await this.fly(null, r, this.seatRect(p), { back: true, dur: 360 });
  }

  // A choice shown beside a lifted card. kind "peek" respects the tutorial.
  askAtPeek(pk, html, buttons, kind = "") {
    const ui = document.createElement("div");
    ui.className = "peek-ui";
    ui.innerHTML = `<div class="peek-text">${html}</div><div class="peek-buttons"></div>`;
    document.body.appendChild(ui);
    // Placed from where the card ends up (it may still be moving).
    const uw = Math.min(320, this.L.W * 0.3);
    ui.style.width = uw + "px";
    const right = pk.x + pk.w + 14 + uw < this.L.W - 8;
    ui.style.left = Math.round(right ? pk.x + pk.w + 14 : pk.x - 14 - uw) + "px";
    ui.style.top = Math.round(pk.y) + "px";
    return new Promise(res => {
      buttons.forEach(b => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.label;
        if (b.cls) btn.className = b.cls;
        if (this.tut && kind === "peek" && this.tut.peekChoice != null && b.value !== this.tut.peekChoice) btn.disabled = true;
        btn.addEventListener("click", () => { ui.remove(); res(b.value); });
        ui.querySelector(".peek-buttons").appendChild(btn);
      });
      setTimeout(() => { const f = ui.querySelector("button:not([disabled])"); if (f) f.focus(); }, 30);
    });
  }

  // An Artifact is captured: it rises to the middle of the screen, glowing,
  // then flies to its new owner's sets.
  async celebrate(pk, card, p, caption) {
    const { el, w, h } = pk;
    // Don't show it in the sets panel until it arrives there.
    const early = [...this.dom.sets.querySelectorAll(`.set-block[data-seat="${p}"] .meld.art`)].pop();
    if (early) early.style.visibility = "hidden";
    if (!el.classList.contains("flipped")) { el.classList.add("flipped"); await wait(450); }
    el.classList.add("glow");
    const cap = document.createElement("div");
    cap.className = "pk-caption";
    cap.innerHTML = caption + (p === 0 ? "" : " <b>+10</b>");
    el.appendChild(cap);
    el.style.transition = `left ${0.55 * GAME_SPEED}s ease, top ${0.55 * GAME_SPEED}s ease, transform ${0.55 * GAME_SPEED}s ease`;
    el.style.left = Math.round(this.L.W / 2 - w / 2) + "px";
    el.style.top = Math.round(this.L.H * 0.42 - h / 2) + "px";
    el.style.transform = "scale(1.7)";
    this.sfxSignal();
    await wait(1700);
    this.render();
    const blk = this.dom.sets.querySelector(`.set-block[data-seat="${p}"] .meld.art:last-of-type`) ||
      [...this.dom.sets.querySelectorAll(`.set-block[data-seat="${p}"] .meld.art`)].pop();
    const r = blk ? this.rectOf(blk) : this.setsRect(p);
    if (blk) blk.style.visibility = "hidden";
    cap.remove();
    el.style.left = Math.round(r.left + r.width / 2 - w / 2) + "px";
    el.style.top = Math.round(r.top + r.height / 2 - h / 2) + "px";
    el.style.transform = `scale(${Math.max(0.2, r.height / h).toFixed(3)})`;
    await wait(600);
    el.remove();
    if (blk) blk.style.visibility = "";
    if (pk.slotEl) pk.slotEl.style.visibility = "";
    this.showCoachAgain();
  }

  async startMove() {
    const g = this.game;
    const opts = g.moveOptions();
    if (!g.pending) { this.mode = "play"; this.render(); return; }
    if (g.pending.kind === "meld" || opts.length <= 1) {
      const d = opts[0] || 1;
      if (!opts.length) this.toast("The probe is at the end of the line, so it stays put.", "", 1400);
      await this.moveProbeAnim(0, d);
      this.mode = "play";
      this.render();
      return;
    }
    this.mode = "move";
    this.render();
  }

  async humanMove(dir) {
    this.clearHint();
    if (this.mode !== "move" || !this.game.moveOptions().includes(dir)) return;
    if (!this.tutAllows("move", [dir])) return;
    this.mode = "busy";
    this.renderActions();
    this.renderTrack();
    await this.moveProbeAnim(0, dir);
    this.mode = "play";
    this.render();
    this.tutDone("move", { dir });
  }

  async humanMission(action) {
    this.clearHint();
    const g = this.game, ids = [...this.sel];
    const mc = ids.length === 1 ? g.findCard(0, ids[0]) : null;
    if (!mc || !g.canUseMission(0, mc.id)) return;
    if (!this.tutAllows("mission", [action])) return;
    const ep = this.epoch;
    if (action === "scan") {
      this.scanCard = mc.id;
      this.mode = "scan";
      this.render();
      this.tutDone("mission", { action });
      return;
    }
    let arg;
    if (action === "salvage") {
      const pile = g.discard.slice().reverse();
      const pick = await this.popup(`<div class="title">Take a card from the discard pile</div>Newest first.`, pile,
        [{ label: "Cancel", cls: "quiet", value: null }], "pick");
      if (ep !== this.epoch || pick == null) return;
      arg = g.discard.findIndex(c => c.id === pick);
    }
    this.mode = "busy";
    this.sel.clear();
    const mcEl = this.dom.hand.querySelector(`.acard[data-id="${mc.id}"]`);
    const mcR = mcEl ? this.rectOf(mcEl) : this.handRect();
    const res = g.useMission(0, mc.id, action, arg);
    this.render();
    await this.fly(mc, mcR, this.rectOf(this.dom.discard), { dur: 300 });
    if (action === "draw2") {
      for (const c of res.cards) { await this.fly(c, this.rectOf(this.dom.deck), this.handRect(), { dur: 300 }); this.fresh.add(c.id); }
    } else if (action === "salvage" && res.card) {
      this.fresh.add(res.card.id);
    }
    if (ep !== this.epoch) return;
    this.mode = "play";
    this.render();
    this.tutDone("mission", { action });
  }

  async humanScan(loc) {
    const g = this.game;
    if (this.mode !== "scan" || !g.slots[loc]) return;
    if (!this.tutAllows("scan", [loc])) return;
    const ep = this.epoch;
    this.mode = "busy";
    const mc = g.findCard(0, this.scanCard);
    const mcEl = this.dom.hand.querySelector(`.acard[data-id="${this.scanCard}"]`);
    const mcR = mcEl ? this.rectOf(mcEl) : this.handRect();
    this.sel.clear();
    const res = g.useMission(0, this.scanCard, "scan", loc);
    this.render();
    await this.fly(mc, mcR, this.rectOf(this.dom.discard), { dur: 300 });
    const where = BODIES[loc].name, card = res.card;
    const lifted = await this.liftPeek(loc, card, true);
    if (card.kind === "artifact") {
      lifted.el.classList.add("glow");
      this.sfxSignal(true);
      await this.askAtPeek(lifted, `<b>An Artifact!</b> Artifact ${card.name} is hidden under <b>${where}</b>. To capture it, bring the probe to ${where} and play ${where} cards there.`,
        [{ label: "OK", cls: "go", value: true }]);
      await this.sinkPeek(lifted);
    } else {
      const take = await this.askAtPeek(lifted, `This was under <b>${where}</b>. Take it, or leave it?`,
        [{ label: "Take it", cls: "go", value: true }, { label: "Leave it", cls: "quiet", value: false }], "peek");
      if (ep !== this.epoch) return lifted.el.remove();
      g.resolvePeek(0, take);
      if (take) { await this.peekToHand(lifted, card); this.fresh.add(card.id); }
      else await this.sinkPeek(lifted);
    }
    if (ep !== this.epoch) return;
    this.mode = "play";
    this.render();
    this.tutDone("scan", { loc });
  }

  async humanDiscard() {
    this.clearHint();
    const g = this.game, ids = [...this.sel];
    if (ids.length !== 1 || !g.canDiscard(0)) return;
    if (!this.tutAllows("discard", ids)) return;
    const ep = this.epoch;
    this.mode = "busy";
    const el = this.dom.hand.querySelector(`.acard[data-id="${ids[0]}"]`);
    const r = el ? this.rectOf(el) : this.handRect();
    const card = g.findCard(0, ids[0]);
    this.sel.clear();
    const res = g.discardCard(0, ids[0]);
    this.render();
    await this.fly(card, r, this.rectOf(this.dom.discard), { dur: 320 });
    if (ep !== this.epoch) return;
    this.playSfx(this.sfx.place);
    this.renderPiles();
    if (this.tut) { this.tutDone("discard", {}); return; }
    if (res.handOver) return this.handOver();
    this.nextTurn();
  }

  // ---------------------------------------------------- computer turns

  async aiTurn() {
    const g = this.game, p = g.turn, ep = this.epoch;
    const ai = this.ai[this.difficulty];
    const nm = this.escape(this.name(p));
    this.mode = "busy";
    this.render();
    await wait(450);
    if (ep !== this.epoch) return;

    // Draw
    const from = (this.tut && this.tut.aiDraw) ? this.tut.aiDraw(g, p) : ai.chooseDraw(g, p);
    const fromR = this.rectOf(from === "discard" ? this.dom.discard : this.dom.deck);
    const drawn = g.draw(p, from);
    this.doing[p] = from === "discard" ? "took the discard" : "drew a card";
    this.render();
    await this.fly(from === "discard" ? drawn : null, fromR, this.seatRect(p), { back: from !== "discard", dur: 340 });
    if (ep !== this.epoch) return;
    await wait(250);

    let a, steps = 0;
    while (ep === this.epoch && g.phase === "play" && (a = (this.tut && this.tut.aiPlay) ? this.tut.aiPlay(g, p) : ai.choosePlay(g, p)) && steps++ < 40) {
      if (a.type === "mission") {
        const mc = g.findCard(p, a.id);
        const res = g.useMission(p, a.id, a.action, a.arg);
        await this.fly(mc, this.seatRect(p), this.rectOf(this.dom.discard), { dur: 320 });
        if (a.action === "draw2") { this.doing[p] = "Mission Control: drew 2"; for (const c of res.cards) await this.fly(null, this.rectOf(this.dom.deck), this.seatRect(p), { back: true, dur: 260 }); }
        else if (a.action === "salvage") { this.doing[p] = "Mission Control: took from the discard"; }
        else {
          this.doing[p] = `Mission Control: looked under ${BODIES[a.arg].name}`;
          const pk = await this.liftPeek(a.arg, null, false);
          if (g.pending && g.pending.stage === "peek") {
            const take = ai.choosePeek(g, p, g.slots[g.pending.loc]);
            g.resolvePeek(p, take);
            if (take) this.doing[p] += " and took the card";
            await wait(300);
            if (take) await this.peekToSeat(pk, p); else await this.sinkPeek(pk);
          } else {
            await wait(300);
            await this.sinkPeek(pk);
          }
        }
        this.toast(`${nm}: ${this.doing[p]}`);
        this.render();
        await wait(700);
        continue;
      }
      const cards = a.ids.map(id => g.findCard(p, id));
      const slotR = cards[0] ? this.slotRect(cards[0].loc) : null;
      const from = this.seatRect(p);
      const res = g.playCards(p, a.ids, a.type);
      if (!res) break;
      const where = BODIES[res.loc].name;
      this.doing[p] = `${a.type === "meld" ? "set" : "lay-off"}: ${res.count} ${where}${res.close ? " (close pass!)" : ""}`;
      await this.flyToStack(p, res.loc, cards, [from]);
      this.playSfx(this.sfx.place);
      if (res.close) this.sfxChime();
      this.toast(`${nm} ${a.type === "meld" ? "plays a set of" : "lays off"} ${res.count} ${where}${res.close ? " · close pass ×2" : ""}`, res.close ? "gold" : "");
      await wait(650);
      if (ep !== this.epoch) return;
      if (res.peek) {
        if (res.peek.captured) {
          const pk = await this.liftPeek(res.loc, res.peek.card, true, slotR);
          await this.celebrate(pk, res.peek.card, p, `${nm} captures Artifact ${res.peek.card.name}!`);
        } else if (res.peek.mustLeave) {
          const pk = await this.liftPeek(res.loc, res.peek.card, false, slotR);
          this.toast(`${nm} looked under ${where}`, "", 1300);
          await wait(450);
          await this.sinkPeek(pk);
        } else {
          const pk = await this.liftPeek(res.loc, res.peek.card, false, slotR);
          const take = (this.tut && this.tut.aiPeek) ? this.tut.aiPeek(g, p) : ai.choosePeek(g, p, res.peek.card);
          g.resolvePeek(p, take);
          this.toast(`${nm} looked under ${where}${take ? " and took the card" : ""}`, "", 1300);
          await wait(350);
          if (take) await this.peekToSeat(pk, p); else await this.sinkPeek(pk);
          this.render();
        }
      }
      if (ep !== this.epoch) return;
      const opts = g.moveOptions();
      const dir = opts.length ? ((this.tut && this.tut.aiMove) ? this.tut.aiMove(g, p, opts) : ai.chooseMove(g, p, opts)) : 1;
      await this.moveProbeAnim(p, dir);
      this.render();
      await wait(250);
    }
    if (ep !== this.epoch) return;

    // Discard
    const id = (this.tut && this.tut.aiDiscard) ? this.tut.aiDiscard(g, p) : ai.chooseDiscard(g, p);
    const card = g.findCard(p, id);
    const res = g.discardCard(p, id);
    if (!res) console.error("AI discard refused", JSON.stringify({ p, turn: g.turn, phase: g.phase, pending: g.pending, hand: g.hand(p).length }));
    await this.fly(card, this.seatRect(p), this.rectOf(this.dom.discard), { dur: 320 });
    if (ep !== this.epoch) return;
    this.playSfx(this.sfx.place);
    delete this.doing[p];
    this.render();
    await wait(300);
    if (this.tut) { this.tutDone("aiTurn", {}); return; }
    if (res.handOver) return this.handOver();
    this.nextTurn();
  }

  // ---------------------------------------------------- end of a hand

  // A player's haul this hand: their sets as little planets, plus Artifacts.
  haulHtml(p) {
    const g = this.game;
    let h = "";
    g.table[p].forEach((t, loc) => {
      const n = t.normal + t.close;
      if (!n) return;
      h += `<span class="haul${t.close ? " close" : ""}" title="${BODIES[loc].name}: ${t.normal} × 2${t.close ? ` + ${t.close} × 4` : ""}">` +
        `<img src="${PLANET_IMG[loc]}" alt="">${n}${t.close ? `<i>×2</i>` : ""}</span>`;
    });
    g.captured[p].forEach(a => { h += `<span class="haul art">${a.name === "Alpha" ? "α" : "β"}</span>`; });
    return h || `<span class="haul none">nothing</span>`;
  }

  handOver() {
    const g = this.game, info = g.endInfo;
    this.recordHand(info);
    if (g.gameOver) this.recordGame();
    this.mode = "over";
    this.render();
    const box = document.getElementById("hand-over");
    const nm = p => this.escape(this.name(p));
    let title = info.reason === "out" ? `${info.outPlayer === 0 ? "You go" : nm(info.outPlayer) + " goes"} out` : "The deck has run out";
    let sub = info.reason === "out" ? `Going-out bonus <b>+${info.probe + 1}</b> for the probe reaching ${BODIES[info.probe].name}.` : "No going-out bonus this hand.";
    if (info.shutout) { title = "Full contact!"; sub = `${nm(info.outPlayer)} went out holding <b>both Artifacts</b>, so everyone else scores nothing this hand.`; }
    document.getElementById("ho-title").innerHTML = `<span class="ho-kicker">Hand ${g.history.length} complete</span>${title}`;
    document.getElementById("ho-sub").innerHTML = sub;
    const best = Math.max(...info.rows.map(r => r.total));
    const target = g.target;
    let html = `<div class="ho-rows">`;
    info.rows.slice().sort((a, b) => g.scores[b.p] - g.scores[a.p]).forEach(r => {
      const pct = Math.min(100, Math.round(g.scores[r.p] / target * 100));
      const prev = Math.min(100, Math.round((g.scores[r.p] - r.total) / target * 100));
      html += `<div class="ho-row${r.total === best && best > 0 ? " top" : ""}${r.p === 0 ? " me" : ""}">` +
        `<div class="ho-name">${nm(r.p)}${r.p === info.outPlayer ? `<span class="ho-tag">went out</span>` : ""}</div>` +
        `<div class="ho-haul">${this.haulHtml(r.p)}</div>` +
        `<div class="ho-pts">${r.zeroed != null ? `<s>+${r.zeroed}</s> +0` : `+${r.total}`}` +
          `<small>${r.cards} cards${r.arts ? ` · ${r.arts} artifacts` : ""}${r.bonus ? ` · ${r.bonus} bonus` : ""}</small></div>` +
        `<div class="ho-total"><b>${g.scores[r.p]}</b><div class="ho-bar"><span class="old" style="width:${prev}%"></span><span class="new" style="left:${prev}%;width:${pct - prev}%"></span></div></div>` +
        `</div>`;
    });
    html += `</div><div class="ho-target">First to ${target} wins</div>`;
    document.getElementById("ho-table").innerHTML = html;
    const btn = document.getElementById("btn-ho-next");
    btn.textContent = g.gameOver ? "Final results" : "Next hand";
    btn.onclick = () => {
      box.style.display = "none";
      if (this.tut) { this.tutDone("handOver", {}); return; }
      if (g.gameOver) this.showResults();
      else this.startHand();
    };
    box.classList.remove("final");
    box.style.display = "flex";
    setTimeout(() => btn.focus(), 50);
    const won = info.rows.find(r => r.total === best);
    if (won && won.p === 0) this.playTones([[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]], { gain: 0.1 });
  }

  // ---------------------------------------------------- stats (this browser)

  loadStats() {
    try { return JSON.parse(localStorage.getItem("ar_stats")) || {}; } catch (e) { return {}; }
  }
  saveStats(st) { try { localStorage.setItem("ar_stats", JSON.stringify(st)); } catch (e) { /* ignore */ } }

  recordHand(info) {
    if (this.tut) return;
    const g = this.game, st = this.loadStats(), me = info.rows.find(r => r.p === 0);
    const add = (k, v = 1) => { st[k] = (st[k] || 0) + v; };
    add("hands");
    if (me.total === Math.max(...info.rows.map(r => r.total)) && me.total > 0) add("handsWon");
    if (info.outPlayer === 0) add("wentOut");
    add("artifacts", g.captured[0].length);
    if (info.shutout && info.outPlayer === 0) add("fullContact");
    add("closeCards", g.table[0].reduce((a, t) => a + t.close, 0));
    add("cardsPlayed", g.table[0].reduce((a, t) => a + t.normal + t.close, 0));
    st.bestHand = Math.max(st.bestHand || 0, me.zeroed != null ? 0 : me.total);
    this.saveStats(st);
  }

  recordGame() {
    if (this.tut) return;
    const g = this.game, st = this.loadStats();
    st.games = (st.games || 0) + 1;
    if (g.winner() === 0) st.wins = (st.wins || 0) + 1;
    st.bestGame = Math.max(st.bestGame || 0, g.scores[0]);
    const key = `p${g.numPlayers}`;
    st[key] = st[key] || { games: 0, wins: 0 };
    st[key].games++;
    if (g.winner() === 0) st[key].wins++;
    this.saveStats(st);
  }

  showStats() {
    const st = this.loadStats();
    const pct = (a, b) => (b ? Math.round(a / b * 100) + "%" : "–");
    const tile = (big, label) => `<div class="stat"><b>${big}</b><span>${label}</span></div>`;
    let html = tile(st.games || 0, "games played") + tile(st.wins || 0, "games won") + tile(pct(st.wins || 0, st.games), "win rate") +
      tile(st.bestGame || 0, "best game score") + tile(st.hands || 0, "hands played") + tile(st.bestHand || 0, "best hand score") +
      tile(st.wentOut || 0, "times you went out") + tile(st.artifacts || 0, "Artifacts captured") + tile(st.fullContact || 0, "full contacts") +
      tile(st.closeCards || 0, "close-pass cards") + tile(st.cardsPlayed || 0, "cards played") + tile(pct(st.handsWon || 0, st.hands), "hands topped");
    const rows = [2, 3, 4].filter(n => st["p" + n]).map(n => `<div>${n} players: <b>${st["p" + n].wins}</b> / ${st["p" + n].games} won</div>`).join("");
    if (rows) html += `<div class="stat-wide">${rows}</div>`;
    document.getElementById("stats-grid").innerHTML = html;
    document.getElementById("stats").style.display = "flex";
  }

  // Final results: the same panel, as a winner's board.
  showResults() {
    const g = this.game, box = document.getElementById("hand-over");
    const w = g.winner();
    const nm = p => this.escape(this.name(p));
    document.getElementById("ho-title").innerHTML = `<span class="ho-kicker">Game over · ${g.history.length} hands</span>${w === 0 ? "You win!" : nm(w) + " wins"}`;
    document.getElementById("ho-sub").innerHTML = w === 0 ? "Mission accomplished." : "Better luck on the next mission.";
    const order = g.scores.map((sc, p) => ({ sc, p })).sort((a, b) => b.sc - a.sc);
    const top = order[0].sc || 1;
    const arts = p => g.history.reduce((a, h) => a + (h.rows.find(r => r.p === p).arts / 10), 0);
    const outs = p => g.history.filter(h => h.outPlayer === p).length;
    let html = `<div class="ho-rows final-rows">`;
    order.forEach((r, i) => {
      html += `<div class="ho-row${i === 0 ? " top" : ""}${r.p === 0 ? " me" : ""}">` +
        `<div class="ho-place">${["1st", "2nd", "3rd", "4th"][i]}</div>` +
        `<div class="ho-name">${nm(r.p)}</div>` +
        `<div class="ho-stats">${outs(r.p)} × out · ${arts(r.p)} artifact${arts(r.p) === 1 ? "" : "s"}</div>` +
        `<div class="ho-total"><b>${r.sc}</b><div class="ho-bar"><span class="new" style="left:0;width:${Math.round(r.sc / top * 100)}%"></span></div></div></div>`;
    });
    html += `</div>`;
    document.getElementById("ho-table").innerHTML = html;
    const btn = document.getElementById("btn-ho-next");
    btn.textContent = "Back to the start";
    btn.onclick = () => {
      box.style.display = "none";
      box.classList.remove("final");
      this.epoch++;
      this.game.phase = "idle";
      this.render();
      document.getElementById("start-overlay").style.display = "flex";
      document.body.classList.add("overlay-active");
    };
    box.classList.add("final");
    box.style.display = "flex";
    this.playEnd(w === 0);
    setTimeout(() => btn.focus(), 50);
  }

  // ---------------------------------------------------- popups

  // Shows a message with cards. kind "pick": click a card to choose it
  // (resolves to its id). Resolves to the chosen button's value.
  popup(html, cards = [], buttons = [], kind = "") {
    const box = this.dom.popup;
    const body = box.querySelector(".popup-body"), btns = box.querySelector(".popup-buttons");
    body.innerHTML = html;
    const row = document.createElement("div");
    row.className = kind === "pick" ? "pick-row" : "";
    cards.forEach(c => row.appendChild(this.makeCard(c)));
    body.appendChild(row);
    btns.innerHTML = "";
    box.style.display = "flex";
    if (this.tut) this.tutOnPopup(kind, cards);
    const hidden = [document.getElementById("coach"), ...document.querySelectorAll(".tut-spot-box")].filter(e => e && e.style.display !== "none");
    hidden.forEach(e => { e.style.visibility = "hidden"; });
    return new Promise(res => {
      const close = v => { box.style.display = "none"; hidden.forEach(e => { e.style.visibility = ""; }); res(v); };
      buttons.forEach(b => {
        const el = document.createElement("button");
        el.type = "button";
        el.textContent = b.label;
        if (b.cls) el.className = b.cls;
        if (this.tut && kind === "peek" && this.tut.peekChoice != null && b.value !== this.tut.peekChoice) el.disabled = true;
        el.addEventListener("click", () => close(b.value));
        btns.appendChild(el);
      });
      if (kind === "pick") row.querySelectorAll(".acard").forEach(el => el.addEventListener("click", () => close(+el.dataset.id)));
      setTimeout(() => { const f = btns.querySelector("button:not([disabled])"); if (f) f.focus(); }, 30);
    });
  }

  // =====================================================
  // ====================== Tutorial =====================
  // =====================================================

  // The tutorial (ar-tutorial.js) restricts the next action to one choice.
  tutAllows(action, args) {
    if (!this.tut || !this.tut.expect) return !this.tut;
    const x = this.tut.expect;
    if (x.action !== action) return false;
    if (x.check) return x.check(this.game, args);
    return true;
  }
  tutAllowsDraw(from) {
    if (!this.tut) return true;
    const x = this.tut.expect;
    return !!x && x.action === "draw" && (!x.from || x.from === from);
  }
  tutDone(action, info) { if (this.tut && this.tut.onDone) this.tut.onDone(action, info); }
  tutOnTurn() { if (this.tut && this.tut.onTurn) this.tut.onTurn(); }
  tutOnPopup(kind, cards) { if (this.tut && this.tut.onPopup) this.tut.onPopup(kind, cards); }

  startTutorial() {
    this.clearLog();
    this.epoch++;
    this.tut = new TutorialRunner(this);
    this.tut.start();
  }

  exitTutorial() {
    if (this.tut) this.tut.stop();
    this.tut = null;
    this.epoch++;
    this.mode = "idle";
    this.hideCoach();
    this.dom.popup.style.display = "none";
    document.getElementById("hand-over").style.display = "none";
    this.game.phase = "idle";
    this.render();
    document.getElementById("start-overlay").style.display = "flex";
    document.body.classList.add("overlay-active");
  }

  showCoach(msg, onNext) {
    let el = document.getElementById("coach");
    if (!el) {
      el = document.createElement("div");
      el.id = "coach";
      el.innerHTML = `<div class="coach-text"></div><div class="coach-buttons"><button type="button" class="coach-skip">Skip tutorial</button><button type="button" class="coach-next">Next ▸</button></div>`;
      document.body.appendChild(el);
      el.querySelector(".coach-skip").addEventListener("click", () => this.exitTutorial());
    }
    const text = typeof msg === "string" ? msg : msg.t;
    const spot = typeof msg === "string" ? null : msg.spot;
    el.querySelector(".coach-text").innerHTML = this.touchWords(text);
    const next = el.querySelector(".coach-next");
    next.style.display = onNext ? "" : "none";
    next.onclick = onNext ? () => { next.onclick = null; onNext(); } : null;
    el.classList.toggle("prompt", !onNext);
    el.style.display = "flex";
    this.placeCoach(null);
    this.placeSpot(spot);
    if (onNext) setTimeout(() => next.focus(), 30);
  }

  // Highlight what the tutorial is talking about: one box per selector in a
  // comma-separated list (so the probe and your cards get separate boxes).
  placeSpot(selector) {
    this._spotSel = selector;
    document.querySelectorAll(".tut-spot-box").forEach(b => b.remove());
    const old = document.getElementById("tut-spot");
    if (old) old.remove();
    if (!selector) { this.placeCoach(null); return; }
    requestAnimationFrame(() => {
      if (this._spotSel !== selector) return;
      document.querySelectorAll(".tut-spot-box").forEach(b => b.remove());
      // Hidden cards are mostly under the board: only count the tips that show.
      const tr = this.dom.track.getBoundingClientRect();
      const visible = e => {
        const r = e.getBoundingClientRect();
        if (!e.matches(".tile .slot")) return r;
        const tile = e.closest(".tile").querySelector(".space").getBoundingClientRect();
        return { left: r.left, right: r.right, top: Math.max(r.top, tile.bottom), bottom: r.bottom, width: r.width };
      };
      const pad = 5;
      let all = null;
      for (const part of selector.split(",").map(x => x.trim()).filter(Boolean)) {
        const rects = [...document.querySelectorAll(part)].map(visible).filter(r => r.width);
        if (!rects.length) continue;
        const l = Math.min(...rects.map(r => r.left)) - pad, t = Math.min(...rects.map(r => r.top)) - pad;
        const r = Math.max(...rects.map(r => r.right)) + pad, b = Math.max(...rects.map(r => r.bottom)) + pad;
        // Keep every box on screen, so it always closes.
        const W = window.innerWidth, H = window.innerHeight;
        const L2 = Math.max(2, l), T2 = Math.max(2, t), R2 = Math.min(W - 8, r), B2 = Math.min(H - 8, b);   // the 3px border sits outside
        const box = document.createElement("div");
        box.className = "tut-spot-box";
        Object.assign(box.style, { left: L2 + "px", top: T2 + "px", width: (R2 - L2) + "px", height: (B2 - T2) + "px" });
        document.body.appendChild(box);
        all = all ? { top: Math.min(all.top, t), bottom: Math.max(all.bottom, b) } : { top: t, bottom: b };
      }
      this.placeCoach(all);
    });
  }


  // The coach sits over the middle of the table, out of the way of the track
  // and your hand; if it's pointing at something in the middle, it moves up
  // over the opponents' row.
  // The coach sits where the turn prompt is (beside the deck, under the
  // track), clear of the board.
  // The tutorial box sits in the gap between the board and your hand, so
  // it never covers the board, your cards or the action buttons.
  // The tutorial box sits over the top of the board; when it's pointing at
  // something on the board it moves up over the opponents instead.
  placeCoach(spot) {
    const coach = document.getElementById("coach");
    if (!coach || !this.L) return;
    const L = this.L, b = L.board;
    const onBoard = spot && spot.top < b.top + L.trackH && spot.bottom > b.top;
    // Phones: when it rides up over the opponents, keep it left of the corner buttons.
    const ctrl = document.getElementById("controls"), cl = ctrl ? ctrl.getBoundingClientRect().left : L.W;
    const w = Math.round(L.compact && onBoard ? Math.min(b.width, cl - b.left - 2 * L.pad) : Math.min(640, b.width));
    coach.style.transform = "none";
    coach.style.width = w + "px";
    coach.style.left = Math.round(L.compact && onBoard ? b.left : b.left + (b.width - w) / 2) + "px";
    const top = onBoard ? Math.max(L.pad, b.top - coach.offsetHeight - 10) : b.top + 8;
    coach.style.top = Math.round(top) + "px";
    coach.style.bottom = "auto";
  }

  hideCoach() {
    const el = document.getElementById("coach");
    if (el) el.style.display = "none";

    this.placeSpot(null);
  }

  // =====================================================
  // ===================== Start screen ==================
  // =====================================================

  bindStart() {
    const overlay = document.getElementById("start-overlay");
    const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
    const bindRadio = (name, cur, fn) => document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.checked = r.value === String(cur);
      r.addEventListener("change", () => { if (r.checked) fn(r.value); });
    });
    document.body.classList.add("overlay-active");
    const nameInput = document.getElementById("player-name-input");
    nameInput.value = this.playerName;
    const sub = document.getElementById("btn-play-sub");
    const updSub = () => { sub.textContent = `${this.numPlayers} players · to ${this.target}`; };
    bindRadio("players", this.numPlayers, v => { this.numPlayers = +v; save("ar_players", v); updSub(); });
    bindRadio("opponent", this.difficulty, v => { this.difficulty = v; save("ar_difficulty", v); });
    bindRadio("target", this.target, v => { this.target = +v; save("ar_target", v); updSub(); });
    bindRadio("helpers", this.helpers ? "on" : "off", v => { this.helpers = v === "on"; save("ar_helpers", v); });
    bindRadio("boardstyle", BOARD_STYLE, v => { BOARD_STYLE = v; save("ar_board", v); this.layout(); this.render(); });
    bindRadio("speed", GAME_SPEED < 1 ? "fast" : "normal", v => { GAME_SPEED = v === "fast" ? 0.5 : 1; save("ar_speed", v); });
    let table = "stars";
    try { const t = localStorage.getItem("ar_bg"); if (TABLES.includes(t)) table = t; } catch (e) { /* ignore */ }
    const applyTable = t => {
      TABLES.forEach(x => document.body.classList.remove("table-" + x));
      document.body.classList.add("table-" + t);
      STARFIELD.setActive(t === "stars");
    };
    applyTable(table);
    bindRadio("table", table, v => { applyTable(v); save("ar_bg", v); });
    updSub();

    const tabs = overlay.querySelectorAll(".tab-btn");
    tabs.forEach(b => b.addEventListener("click", () => {
      tabs.forEach(x => x.classList.toggle("active", x === b));
      overlay.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === b.dataset.tab));
    }));

    const hide = () => {
      this.playerName = nameInput.value.trim() || "Player";
      save("ar_playerName", this.playerName);
      overlay.style.display = "none";
      document.body.classList.remove("overlay-active");
      this.ensureAudioContext();
      this.layout();
    };
    document.getElementById("btn-play").addEventListener("click", () => { hide(); this.startGame(); });
    document.getElementById("btn-tutorial").addEventListener("click", () => { this.markTutorialSeen(); hide(); this.startTutorial(); });

    const instr = document.getElementById("instructions-panel");
    const panel = document.getElementById("start-panel");
    const body = overlay.querySelector(".start-body"), btns = overlay.querySelector(".start-buttons");
    document.getElementById("btn-instructions").addEventListener("click", () => {
      panel.classList.add("instructions-open"); body.style.display = "none"; btns.style.display = "none"; instr.style.display = "flex";
    });
    const closeInstr = () => { panel.classList.remove("instructions-open"); body.style.display = ""; btns.style.display = ""; instr.style.display = "none"; };
    document.getElementById("btn-instructions-done").addEventListener("click", closeInstr);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && instr.style.display !== "none") closeInstr(); });

    const splash = document.getElementById("splash");
    const dismiss = () => {
      if (splash.classList.contains("gone")) return;
      splash.classList.add("gone");
      try {
        const root = document.documentElement, fs = root.requestFullscreen || root.webkitRequestFullscreen;
        const p = fs && !this.fsEl() ? fs.call(root) : null;
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
      this.ensureAudioContext();
      this.setSoundMuted(false);
      setTimeout(() => { splash.remove(); this.offerTutorialIfNew(); }, 600);
    };
    splash.addEventListener("click", dismiss);
    splash.addEventListener("keydown", e => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); dismiss(); } });
    setTimeout(() => splash.focus(), 50);
  }

  // Keys: D draw from the deck, T take the discard, Enter play / discard,
  // C clear, H hint, arrows move the probe. (Not Esc: it leaves fullscreen.)
  bindKeys() {
    document.addEventListener("keydown", e => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (document.body.classList.contains("overlay-active")) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (document.querySelector(".peek-ui") || document.getElementById("popup").style.display === "flex") return;
      if (["quit-confirm", "hand-over", "settings", "stats", "credits"].some(id => document.getElementById(id).style.display === "flex")) return;
      const k = e.key.toLowerCase();
      const press = sel => { const b = [...document.querySelectorAll("#action-buttons button")].find(x => !x.disabled && x.matches(sel)); if (b) { b.click(); return true; } return false; };
      let done = false;
      if (this.mode === "draw") {
        if (k === "d") { this.humanDraw("deck"); done = true; }
        if (k === "t") { this.humanDraw("discard"); done = true; }
      }
      if (this.mode === "move") {
        if (e.key === "ArrowLeft") { this.humanMove(-1); done = true; }
        if (e.key === "ArrowRight") { this.humanMove(1); done = true; }
      }
      if (this.mode === "play") {
        // Enter plays the selected set / lay-off, or discards a single card -
        // but never discards a Mission Control card (choose its action first).
        if (e.key === "Enter") done = press("button.go") || (!document.querySelector("#action-buttons button.mc") && press("button.discard"));
        if (k === "c" && this.sel.size) { this.clearHint(); this.sel.clear(); this.render(); done = true; }
      }
      if (k === "h") { this.showHint(); done = true; }
      if (done) e.preventDefault();
    });
  }

  offerTutorialIfNew() {
    let seen = false;
    try { seen = localStorage.getItem("ar_tutorialSeen") === "1"; } catch (e) { /* ignore */ }
    const offer = document.getElementById("tut-offer");
    if (seen) return;
    offer.style.display = "flex";
    const close = () => { offer.style.display = "none"; this.markTutorialSeen(); };
    document.getElementById("btn-offer-skip").onclick = close;
    document.getElementById("btn-offer-tutorial").onclick = () => { close(); document.getElementById("btn-tutorial").click(); };
  }

  markTutorialSeen() { try { localStorage.setItem("ar_tutorialSeen", "1"); } catch (e) { /* ignore */ } }

  bindQuit() {
    const btn = document.getElementById("btn-quit"), box = document.getElementById("quit-confirm");
    const close = () => { box.style.display = "none"; };
    btn.addEventListener("click", () => {
      if (document.getElementById("start-overlay").style.display !== "none") return;
      box.style.display = "flex";
    });
    document.getElementById("btn-quit-no").addEventListener("click", close);
    document.getElementById("btn-quit-yes").addEventListener("click", () => { close(); this.exitTutorial(); });
  }

  // =====================================================
  // ================= Sound / fullscreen ================
  // =====================================================

  applySoundMuted() {
    const btn = document.getElementById("btn-sound");
    btn.innerHTML = this.soundMuted ? ICONS.muted : ICONS.sound;
    btn.title = this.soundMuted ? "Sound: off" : "Sound: on";
    btn.classList.toggle("muted", this.soundMuted);
    if (!btn.__b) { btn.__b = true; btn.addEventListener("click", () => { btn.blur(); this.ensureAudioContext(); this.setSoundMuted(!this.soundMuted); }); }
    try { localStorage.setItem("ar_soundMuted", this.soundMuted ? "1" : "0"); } catch (e) { /* ignore */ }
    this.applyMusic();
  }
  setSoundMuted(m) { this.soundMuted = !!m; this.applySoundMuted(); }

  applyMusic() {
    const btn = document.getElementById("btn-music");
    if (btn) {
      btn.innerHTML = this.musicOn ? ICONS.music : ICONS.musicOff;
      btn.title = this.musicOn ? "Music: on" : "Music: off";
      btn.classList.toggle("muted", !this.musicOn);
      if (!btn.__b) {
        btn.__b = true;
        btn.addEventListener("click", () => {
          btn.blur();
          this.musicOn = !this.musicOn;
          try { localStorage.setItem("ar_music", this.musicOn ? "on" : "off"); } catch (e) { /* ignore */ }
          this.applyMusic();
        });
      }
    }
    if (!this.music) return;
    if (this.musicOn && !this.soundMuted && this.audioCtx) this.music.start();
    else this.music.stop();
  }
  fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  applyFullscreenUi() {
    const btn = document.getElementById("btn-fullscreen"), root = document.documentElement;
    if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) { btn.style.display = "none"; return; }
    const on = !!this.fsEl();
    btn.innerHTML = on ? ICONS.exitFull : ICONS.full;
    btn.title = on ? "Exit fullscreen" : "Fullscreen";
    if (!btn.__b) {
      btn.__b = true;
      btn.addEventListener("click", () => {
        btn.blur();   // so a later key press can't toggle it again
        try {
          const p = this.fsEl() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
          if (p && p.catch) p.catch(() => {});
        } catch (e) { /* ignore */ }
      });
      const changed = () => {
        this.applyFullscreenUi();
        // The window size settles after the switch: lay the table out again.
        [60, 250, 600].forEach(ms => setTimeout(() => { this.layout(); this.render(); }, ms));
      };
      document.addEventListener("fullscreenchange", changed);
      document.addEventListener("webkitfullscreenchange", changed);
    }
  }
  playSfx(a) {
    if (this.soundMuted || !a) return;
    try { const c = a.cloneNode(); c.volume = a.volume; const p = c.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  ensureAudioContext() {
    if (!this.audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.audioCtx = new AC(); }
    if (this.audioCtx && this.audioCtx.state === "suspended") { try { this.audioCtx.resume().catch(() => {}); } catch (e) { /* ignore */ } }
    return this.audioCtx;
  }
  playTones(notes, { type = "triangle", gain = 0.1 } = {}) {
    if (this.soundMuted) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [f, t0, d] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, now + t0);
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.exponentialRampToValueAtTime(gain, now + t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + d);
      o.connect(g).connect(ctx.destination);
      o.start(now + t0);
      o.stop(now + t0 + d + 0.02);
    }
  }
  // Filtered noise sweeping up (outward) or down (inward): the probe moving.
  sfxWhoosh(dir = 1) {
    if (this.soundMuted) return;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const dur = 0.5, now = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(dir > 0 ? 300 : 1400, now);
    f.frequency.exponentialRampToValueAtTime(dir > 0 ? 1600 : 280, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.05);
  }
  // A soft card slide: a short burst of filtered noise. Several cards moving
  // together share one sound.
  sfxSlide(dur = 380) {
    if (this.soundMuted) return;
    const now0 = performance.now();
    if (now0 - (this._lastSlide || 0) < 70) return;
    this._lastSlide = now0;
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const len = Math.min(0.32, Math.max(0.12, dur * GAME_SPEED / 1000 * 0.7)), now = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(2600, now);
    f.frequency.exponentialRampToValueAtTime(1500, now + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(now);
    src.stop(now + len + 0.02);
  }
  sfxChime() { this.playTones([[1047, 0, 0.5], [1319, 0.07, 0.5], [1568, 0.14, 0.6]], { type: "sine", gain: 0.07 }); }
  sfxPeek() { this.playTones([[440, 0, 0.08], [660, 0.05, 0.1]], { type: "sine", gain: 0.05 }); }
  // "Signal found": a rising shimmer (quieter and shorter when just spotted).
  sfxSignal(spotted = false) {
    const notes = spotted ? [[784, 0, 0.18], [1175, 0.1, 0.3]]
      : [[392, 0, 0.3], [523, 0.12, 0.3], [659, 0.24, 0.3], [784, 0.36, 0.3], [1047, 0.48, 0.5], [1568, 0.6, 0.8]];
    this.playTones(notes, { type: "sine", gain: spotted ? 0.08 : 0.13 });
    if (!spotted) this.playTones(notes.map(([f, t, d]) => [f * 2.005, t + 0.02, d]), { type: "triangle", gain: 0.03 });
  }
  playEnd(win) {
    const seq = win ? [523, 659, 784, 1047, 784, 1047, 1319] : [523, 466, 415, 392, 330];
    this.playTones(seq.map((f, i) => [f, i * 0.11, 0.14]), { gain: 0.12 });
  }
}

const controller = new Controller();
let resizeT = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeT);
  resizeT = requestAnimationFrame(() => { controller.layout(); controller.render(); });
});
document.getElementById("btn-quit").innerHTML = ICONS.quit;
