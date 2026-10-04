// ar-tutorial.js
// A guided first hand against Vega, in four lessons:
//   1. a first set (and the probe moving on)
//   2. a close pass (×2) and peeking under a body
//   3. Mission Control, and steering the probe back with a lay-off
//   4. capturing an Artifact, and going out
// Deck: the last card listed is drawn first.

const TUTORIAL_PRESET = {
  hands: [
    ["jupiter", "jupiter", "uranus", "venus", "venus", "mars", "mars", "mars", "mission", "neptune"],
    ["earth", "earth", "earth", "jupiter", "jupiter", "pluto", "uranus", "saturn", "ceres", "neptune"]
  ],
  deck: [
    "saturn", "uranus", "pluto", "mercury", "ceres", "neptune", "earth", "saturn", "mercury", "ceres",
    "pluto", "uranus", "mission", "neptune", "saturn", "mercury",
    "venus",     // your 4th turn
    "pluto",     // Vega's 3rd
    "saturn",    // your 3rd
    "neptune",   // Vega's 2nd
                 // (your 2nd turn: you take her Jupiter from the discard pile)
    "ceres",     // Vega's 1st
    "mercury"    // your 1st
  ],
  discard: ["pluto"],
  slots: ["ceres", "earth", "neptune", "Alpha", "mission", "venus", "uranus", "saturn", "mercury", "Beta"],
  probe: 0,
  turn: 0
};

const SPOT = {
  track: "#track", probe: "#probe", slots: "#track .slot.hidden", hand: "#hand .acard", deck: "#deck-pile",
  discard: "#discard-pile", me: "#me-panel", opps: "#opps", actions: "#actions",
  tile: i => `#track .tile[data-loc="${i}"]`,
  handOf: loc => `#hand .acard.body.${BODIES[loc].key}`
};
const L = Object.fromEntries(BODIES.map((b, i) => [b.key, i]));
const onlyBody = (loc, n) => (g, ids) => ids.length === n && ids.every(id => { const c = g.findCard(0, id); return c && c.kind === "body" && c.loc === loc; });
const cardIs = (pred) => (g, ids) => ids.length === 1 && pred(g.findCard(0, ids[0]));

const TUTORIAL_STEPS = [
  { say: [
    "Welcome to <b>Artifact</b>! Two alien Artifacts are hidden somewhere among the planets. You and your rival, <b>Vega</b>, score points by sending in telemetry from the planets, and by capturing those Artifacts.",
    { t: "This is the <b>track</b>, with ten bodies from Mercury out to Pluto. Each has a number, 1 to 10, shown in the corner of its cards.", spot: SPOT.track },
    { t: "A <b>hidden card</b> is tucked under every planet. You can see their tips below the board. Two of them are the Artifacts.", spot: SPOT.slots },
    { t: "This token is the <b>probe</b>. It starts at Mercury, and both players move it along the board.", spot: SPOT.probe },
    { t: "Your <b>hand</b>. Six of each body are in the deck, plus <b>Mission Control</b> cards with special powers.", spot: SPOT.hand }
  ] },

  // ---------------------------------------------------------------- Basics
  { say: [
    "<b>Every turn has three steps:</b><br>1. <b>Draw</b> one card from the deck, or take the top card of the discard pile.<br>2. <b>Play</b> cards, if you can (you don't have to).<br>3. <b>Discard</b> one card. That ends your turn.",
    "<b>How you score:</b> three or more cards of the same planet make a <b>set</b>. Put a set on the table and every card in it scores <b>2 points</b>. The more cards you get down, the more you score."
  ] },
  { expect: { action: "draw", from: "deck" }, prompt: "Your first turn. <b>Step 1: draw.</b> Click the <b>deck</b>.", spot: SPOT.deck },
  { say: [ { t: "You drew a <b>Mercury</b>. You don't have three of anything yet, so there's nothing to play this turn.", spot: SPOT.hand } ] },
  { expect: { action: "discard", check: cardIs(c => c && c.kind === "body" && c.loc === L.mercury) },
    prompt: "<b>Step 3: discard.</b> Click the <b>Mercury</b> card to select it, then click the <b>discard pile</b> (or press <b>Discard</b>).", spot: SPOT.handOf(L.mercury) },
  { ai: 1, say: "Vega's turn. She draws a card, then discards one." },
  { say: [ { t: "Vega threw away a <b>Jupiter</b>, and you already hold two Jupiters…", spot: SPOT.discard } ] },

  // ---------------------------------------------------------------- Lesson 1
  { say: [ "<b>Lesson 1: your first set.</b>" ] },
  { expect: { action: "draw", from: "discard" }, prompt: "This time draw from the <b>discard pile</b>. Click the Jupiter to take it.", spot: SPOT.discard },
  { expect: { action: "meld", check: onlyBody(L.jupiter, 3) }, peekChoice: true,
    prompt: "Now you have three. Select your three <b>Jupiter</b> cards, then press <b>New set</b> (or click your row in the sets panel on the right).", spot: SPOT.handOf(L.jupiter) },
  { say: [
    { t: "Your first set: 3 cards × 2 = <b>6 points</b>. Sets show in the panel on the right.", spot: SPOT.me },
    { t: "Whenever you play cards of a planet you also <b>look under it</b>. There was a Venus card hidden under Jupiter, and you took it.", spot: SPOT.tile(L.jupiter) },
    { t: "Playing a <b>new set</b> always moves the probe <b>one step outward</b>. It's now at Venus.", spot: SPOT.probe }
  ] },
  { expect: { action: "discard", check: cardIs(c => c && c.kind === "body" && c.loc === L.uranus) },
    prompt: "End your turn with a <b>discard</b>. Select the <b>Uranus</b> card and press <b>Discard</b>.", spot: SPOT.handOf(L.uranus) },
  { ai: 2, say: "Now it's Vega's turn." },

  // ---------------------------------------------------------------- Lesson 2
  { say: [ "<b>Lesson 2: the close pass.</b>", { t: "The probe is at <b>Venus</b>, and you now hold three Venus cards.", spot: `${SPOT.probe}, ${SPOT.handOf(L.venus)}` } ] },
  { expect: { action: "draw", from: "deck" }, prompt: "Draw from the <b>deck</b>.", spot: SPOT.deck },
  { expect: { action: "meld", check: onlyBody(L.venus, 3) }, peekChoice: false,
    prompt: "Cards played at the body where the probe is score <b>double</b>. That's a <b>close pass</b>. Play your three <b>Venus</b> as a set.", spot: SPOT.handOf(L.venus) },
  { say: [
    { t: "4 points a card instead of 2! (The Earth card under Venus wasn't any use, so you left it there.)", spot: SPOT.me },
    { t: "The probe moved on to Earth. Your rival can use close passes too, of course.", spot: SPOT.probe }
  ] },
  { expect: { action: "discard", check: cardIs(c => c && c.kind === "body" && c.loc === L.saturn) },
    prompt: "Discard the <b>Saturn</b> card to end your turn.", spot: SPOT.handOf(L.saturn) },
  { ai: 3, say: "Vega's turn. Watch the probe." },
  { say: [
    { t: "Vega played a set of Earth with the probe <b>at Earth</b>, a close pass for her. Then she <b>laid off</b> a single Jupiter onto your Jupiter set.", spot: "#sets" },
    "A <b>lay-off</b> adds cards to <b>any</b> set already on the table, yours or anyone's. After a lay-off the probe moves one step <b>either way</b>, you choose. Vega pushed it out to <b>Ceres</b>."
  ] },

  // ---------------------------------------------------------------- Lesson 3
  { say: [ "<b>Lesson 3: Mission Control, and steering the probe.</b>" ] },
  { expect: { action: "draw", from: "deck" }, prompt: "Draw from the <b>deck</b>.", spot: SPOT.deck },
  { say: [ { t: "Once per turn you may play a <b>Mission Control</b> card to <b>draw 2</b> cards, <b>take any card</b> from the discard pile, or <b>look under</b> any body.", spot: "#hand .acard.mission" } ] },
  { expect: { action: "mission", check: (g, a) => a[0] === "scan" },
    prompt: "Select your <b>Mission Control</b> card and press <b>Look under…</b>", spot: "#hand .acard.mission" },
  { expect: { action: "scan", check: (g, a) => a[0] === L.mars }, prompt: "You hold three Mars cards. Click <b>Mars</b> on the track to see what's under it.", spot: SPOT.tile(L.mars) },
  { say: [
    { t: "<b>Artifact Alpha</b> is under Mars! You can only capture it by playing Mars cards <b>while the probe is at Mars</b>.", spot: SPOT.tile(L.mars) },
    { t: "But the probe is one step past it, at Ceres. Time to steer it back.", spot: SPOT.probe }
  ] },
  { expect: { action: "layoff", check: onlyBody(L.venus, 1) }, peekChoice: false,
    prompt: "Lay off your <b>Venus</b> card onto your Venus set. Select it and press <b>Lay off</b>.", spot: SPOT.handOf(L.venus) },
  { expect: { action: "move", check: (g, a) => a[0] === -1 }, prompt: "Now move the probe <b>◀ inward</b>, back to Mars.", spot: SPOT.track },

  // ---------------------------------------------------------------- Lesson 4
  { say: [ "<b>Lesson 4: the capture.</b>", { t: "The probe is over Mars and you have three Mars cards.", spot: `${SPOT.probe}, ${SPOT.handOf(L.mars)}` } ] },
  { expect: { action: "meld", check: onlyBody(L.mars, 3) }, prompt: "Play your three <b>Mars</b> cards as a set!", spot: SPOT.handOf(L.mars) },
  { say: [
    { t: "Captured! Artifact Alpha is worth <b>10 points</b>, and your Mars cards were a close pass too.", spot: SPOT.me },
    "You have one card left. If you discard your <b>last card</b> you <b>go out</b>, and the hand ends for everyone."
  ] },
  { expect: { action: "discard" }, prompt: "Discard your last card to <b>go out</b>.", spot: SPOT.hand },
  { handOver: true },

  { say: [
    "Going out earns a <b>bonus</b> equal to the probe's position: Mercury 1, up to Pluto 10. So pushing the probe outward pays off for whoever goes out.",
    "If you go out holding <b>both</b> Artifacts, that's <b>full contact</b> and everyone else scores nothing for the hand!",
    "The hand also ends if the deck runs out. Cards left in your hand don't cost you anything.",
    "Hands are played until someone reaches <b>100 points</b>. Good luck out there, and press <b>Play</b> on the start screen to begin."
  ] }
];

// Vega's scripted turns.
const TUTORIAL_AI = {
  1: { plays: [], discard: "jupiter" },
  2: { plays: [], discard: "saturn" },
  3: { plays: [{ type: "meld", loc: L.earth, n: 3 }, { type: "layoff", loc: L.jupiter, n: 1 }], discard: "pluto" }
};

class TutorialRunner {
  constructor(ctrl) {
    this.c = ctrl;
    this.expect = null;
    this.peekChoice = null;
    this.stopped = false;
    this.waiter = null;
  }

  start() {
    const c = this.c, g = c.game;
    c.names = ["Vega"];
    g.newGame(2, { target: 100, dealer: 1 });
    g.startHand(TUTORIAL_PRESET);
    c.mode = "busy";
    c.sel.clear();
    c.doing = {};
    c.layout();
    c.render();
    this.ep = c.epoch;
    this.run();
  }

  stop() { this.stopped = true; if (this.waiter) this.waiter(); }

  alive() { return !this.stopped && this.ep === this.c.epoch; }

  async run() {
    for (const step of TUTORIAL_STEPS) {
      if (!this.alive()) return;
      await this.doStep(step);
    }
    if (this.alive()) this.c.exitTutorial();
  }

  coachSteps(msgs) {
    return msgs.reduce((p, m) => p.then(() => this.alive() && new Promise(res => this.c.showCoach(m, res))), Promise.resolve())
      .then(() => this.c.hideCoach());
  }

  waitFor(action) {
    return new Promise(res => { this.waitAction = action; this.waiter = res; });
  }

  async doStep(step) {
    const c = this.c, g = c.game;
    if (step.ai) {
      if (step.say) c.toast(step.say, "", 1800);
      this.setupAi(TUTORIAL_AI[step.ai]);
      const w = this.waitFor("aiTurn");
      c.aiTurn();
      await w;
      c.hideCoach();
      this.clearAi();
      return;
    }
    if (step.handOver) {
      const w = this.waitFor("handOver");
      c.handOver();
      await w;
      return;
    }
    if (step.say) {
      c.mode = c.mode === "busy" ? "busy" : c.mode;
      await this.coachSteps(step.say);
      return;
    }
    if (step.expect) {
      this.expect = step.expect;
      this.peekChoice = step.peekChoice ?? null;
      if (step.expect.action === "draw") c.mode = "draw";
      else if (["meld", "layoff", "mission", "discard"].includes(step.expect.action)) c.mode = "play";
      c.statusLocked = false;
      c.render();
      c.showCoach({ t: step.prompt, spot: step.spot }, null);
      await this.waitFor(step.expect.action);
      this.expect = null;
      this.peekChoice = null;
      c.hideCoach();
    }
  }

  onDone(action) {
    if (this.waiter && action === this.waitAction) {
      const w = this.waiter;
      this.waiter = null;
      w();
    }
  }

  onPopup() { /* the coach stays up; peek buttons are limited in Controller.popup */ }

  setupAi(script) {
    let k = 0;
    this.aiDraw = () => "deck";
    this.aiPlay = (g, p) => {
      const s = script.plays[k++];
      if (!s) return null;
      const ids = g.hand(p).filter(x => x.kind === "body" && x.loc === s.loc).slice(0, s.n).map(x => x.id);
      return { type: s.type, ids };
    };
    this.aiPeek = () => false;
    this.aiMove = (g, p, opts) => (opts.includes(1) ? 1 : opts[0]);
    this.aiDiscard = (g, p) => {
      const h = g.hand(p);
      const c = h.find(x => x.kind === "body" && BODIES[x.loc].key === script.discard) || h[h.length - 1];
      return c.id;
    };
  }

  clearAi() { this.aiDraw = this.aiPlay = this.aiPeek = this.aiMove = this.aiDiscard = null; }
}
