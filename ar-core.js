// ar-core.js
// Artifact: rules engine. A space-themed rummy following the mechanisms of
// Mike Fitzgerald's Mystery Rummy: Bonnie & Clyde. No DOM here.

const BODIES = [
  { key: "mercury", name: "Mercury" },
  { key: "venus",   name: "Venus" },
  { key: "earth",   name: "Earth" },
  { key: "mars",    name: "Mars" },
  { key: "ceres",   name: "Ceres" },
  { key: "jupiter", name: "Jupiter" },
  { key: "saturn",  name: "Saturn" },
  { key: "uranus",  name: "Uranus" },
  { key: "neptune", name: "Neptune" },
  { key: "pluto",   name: "Pluto" }
];
const N_BODIES = BODIES.length;

// Diameters (km), for drawing the bodies at relative sizes. A true scale is
// impossible (Jupiter is 149 times wider than Ceres), so sizes follow a log
// scale: the order and the big/small contrast are right.
const DIAMETER_KM = [4879, 12104, 12742, 6779, 939, 139820, 116460, 50724, 49244, 2377];
function relativeSize(loc, smallest = 0.22) {
  const lo = Math.log(Math.min(...DIAMETER_KM)), hi = Math.log(Math.max(...DIAMETER_KM));
  return smallest + (1 - smallest) * (Math.log(DIAMETER_KM[loc]) - lo) / (hi - lo);
}
const COPIES = 6;              // telemetry cards per body (60 in all)
const MISSION_CARDS = 15;
const HIDDEN_RANDOM = 8;       // + the 2 Artifacts = one under each body
const HAND_SIZE = { 2: 10, 3: 9, 4: 8 };
const POINTS = { normal: 2, close: 4, artifact: 10 };
const TARGET_SCORE = 100;

// kind: "body" (loc 0-9), "mission" or "artifact" (name "Alpha" / "Beta")
class Card {
  constructor(id, kind, loc = -1, name = "") {
    this.id = id;
    this.kind = kind;
    this.loc = loc;
    this.name = name;
  }
  get label() {
    if (this.kind === "body") return BODIES[this.loc].name;
    if (this.kind === "mission") return "Mission Control";
    return "Artifact " + this.name;
  }
}

function makeDeck() {
  const cards = [];
  let id = 0;
  for (let l = 0; l < N_BODIES; l++) for (let k = 0; k < COPIES; k++) cards.push(new Card(id++, "body", l));
  for (let k = 0; k < MISSION_CARDS; k++) cards.push(new Card(id++, "mission"));
  const artifacts = [new Card(id++, "artifact", -1, "Alpha"), new Card(id++, "artifact", -1, "Beta")];
  return { cards, artifacts };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class ArtifactGame {
  constructor() {
    this.numPlayers = 2;
    this.target = TARGET_SCORE;
    this.scores = [];
    this.dealer = 0;
    this.handNo = 0;
    this.phase = "idle";
    this.listeners = [];
  }

  // ---------------------------------------------------------------- setup

  newGame(numPlayers, { target = TARGET_SCORE, dealer = null } = {}) {
    this.numPlayers = numPlayers;
    this.target = target;
    this.scores = new Array(numPlayers).fill(0);
    this.history = [];
    this.handNo = 0;
    this.dealer = dealer == null ? Math.floor(Math.random() * numPlayers) : dealer;
    this.gameOver = false;
  }

  // Deal a new hand. preset (tutorial) may fix hands, deck order, slots etc.
  startHand(preset = null) {
    const n = this.numPlayers;
    this.handNo++;
    this.probe = 0;
    this.hands = Array.from({ length: n }, () => []);
    this.table = Array.from({ length: n }, () => Array.from({ length: N_BODIES }, () => ({ normal: 0, close: 0 })));
    this.captured = Array.from({ length: n }, () => []);
    this.melded = new Array(N_BODIES).fill(false);    // a meld of this body is on the table
    this.known = Array.from({ length: n }, () => new Array(N_BODIES).fill(null)); // what each player has seen under each body
    this.pending = null;
    this.missionUsed = false;
    this.lastCardDrawn = false;
    this.endInfo = null;

    if (preset) return this.applyPreset(preset);

    const { cards, artifacts } = makeDeck();
    shuffle(cards);
    const hidden = shuffle(cards.splice(0, HIDDEN_RANDOM).concat(artifacts));
    this.slots = hidden;
    const hs = HAND_SIZE[n];
    for (let k = 0; k < hs; k++) for (let p = 0; p < n; p++) this.hands[p].push(cards.pop());
    this.deck = cards;
    this.discard = [this.deck.pop()];
    this.turn = (this.dealer + 1) % n;
    this.phase = "draw";
  }

  // preset: { hands: [[codes]], deck: [codes, top last], discard: [codes], slots: [10 codes], probe, turn }
  // codes: body key ("earth"), "mission", "Alpha", "Beta"
  applyPreset(pr) {
    let id = 1000;
    const mk = c => {
      if (c === "mission") return new Card(id++, "mission");
      if (c === "Alpha" || c === "Beta") return new Card(id++, "artifact", -1, c);
      return new Card(id++, "body", BODIES.findIndex(b => b.key === c));
    };
    this.hands = pr.hands.map(h => h.map(mk));
    this.deck = pr.deck.map(mk);
    this.discard = pr.discard.map(mk);
    this.slots = pr.slots.map(c => (c ? mk(c) : null));
    this.probe = pr.probe || 0;
    this.turn = pr.turn || 0;
    this.phase = "draw";
  }

  // ---------------------------------------------------------------- queries

  hand(p) { return this.hands[p]; }
  findCard(p, id) { return this.hands[p].find(c => c.id === id); }
  topDiscard() { return this.discard.length ? this.discard[this.discard.length - 1] : null; }

  // Can these cards be played as a new set (meld) by p?
  canMeld(p, ids) {
    if (this.phase !== "play" || this.turn !== p || this.pending) return false;
    const cards = ids.map(id => this.findCard(p, id));
    if (cards.length < 3 || cards.some(c => !c || c.kind !== "body")) return false;
    if (cards.some(c => c.loc !== cards[0].loc)) return false;
    return this.hands[p].length - cards.length >= 1;   // keep a card to discard
  }

  canLayoff(p, ids) {
    if (this.phase !== "play" || this.turn !== p || this.pending) return false;
    const cards = ids.map(id => this.findCard(p, id));
    if (!cards.length || cards.some(c => !c || c.kind !== "body")) return false;
    if (cards.some(c => c.loc !== cards[0].loc)) return false;
    if (!this.melded[cards[0].loc]) return false;
    return this.hands[p].length - cards.length >= 1;
  }

  canUseMission(p, id) {
    if (this.phase !== "play" || this.turn !== p || this.pending || this.missionUsed) return false;
    const c = this.findCard(p, id);
    return !!c && c.kind === "mission";
  }

  // You must still have a card to discard afterwards, so with Mission
  // Control as your only card you can draw 2 or take from the discard pile,
  // but not just look under a body.
  canMissionAction(p, id, action) {
    if (!this.canUseMission(p, id)) return false;
    const others = this.hands[p].length - 1;
    if (action === "draw2") return this.deck.length > 0 || others > 0;
    if (action === "salvage") return this.discard.length > 0;
    if (action === "scan") return others > 0 && this.slots.some(Boolean);
    return false;
  }

  canDiscard(p) {
    return this.phase === "play" && this.turn === p && !this.pending && this.hands[p].length > 0;
  }

  // ---------------------------------------------------------------- actions

  draw(p, from) {
    if (this.phase !== "draw" || this.turn !== p) return null;
    let card;
    if (from === "discard") {
      if (!this.discard.length) return null;
      card = this.discard.pop();
    } else {
      if (!this.deck.length) return null;
      card = this.deck.pop();
      if (!this.deck.length) this.lastCardDrawn = true;
    }
    this.hands[p].push(card);
    this.phase = "play";
    this.missionUsed = false;
    return card;
  }

  takeFromHand(p, ids) {
    const out = [];
    for (const id of ids) {
      const i = this.hands[p].findIndex(c => c.id === id);
      out.push(this.hands[p].splice(i, 1)[0]);
    }
    return out;
  }

  // Place a meld or layoff, then look under that body. Returns
  // { loc, close, peek: { card, captured, mustLeave } | null }.
  // Afterwards this.pending holds what's left to do:
  //   { stage: "peek", ... }  - choose to take or leave a revealed card
  //   { stage: "move", kind } - move the probe (meld: forward; layoff: either way)
  playCards(p, ids, kind) {
    const ok = kind === "meld" ? this.canMeld(p, ids) : this.canLayoff(p, ids);
    if (!ok) return null;
    const cards = this.takeFromHand(p, ids);
    const loc = cards[0].loc;
    const close = this.probe === loc;
    this.table[p][loc][close ? "close" : "normal"] += cards.length;
    if (kind === "meld") this.melded[loc] = true;

    const res = { loc, close, count: cards.length, kind, peek: null };
    const hidden = this.slots[loc];
    if (hidden) {
      this.known[p][loc] = hidden;
      if (hidden.kind === "artifact") {
        if (close) {
          this.captured[p].push(hidden);
          this.slots[loc] = null;
          res.peek = { card: hidden, captured: true };
        } else {
          res.peek = { card: hidden, mustLeave: true };
        }
      } else {
        res.peek = { card: hidden };
        this.pending = { stage: "peek", loc, kind, p };
        return res;
      }
    }
    this.pending = { stage: "move", kind, p };
    return res;
  }

  // After a peek at a normal card: take it into your hand, or leave it.
  resolvePeek(p, take) {
    const pd = this.pending;
    if (!pd || pd.stage !== "peek" || pd.p !== p) return false;
    if (take) {
      this.hands[p].push(this.slots[pd.loc]);
      this.slots[pd.loc] = null;
      for (const k of this.known) k[pd.loc] = null;   // an empty place is public
    }
    if (pd.kind === "scan") { this.pending = null; return true; }
    this.pending = { stage: "move", kind: pd.kind, p };
    return true;
  }

  // Which ways the probe may move for the pending play.
  moveOptions() {
    const pd = this.pending;
    if (!pd || pd.stage !== "move") return [];
    const opts = [];
    if (this.probe < N_BODIES - 1) opts.push(1);
    if (pd.kind === "layoff" && this.probe > 0) opts.push(-1);
    return opts;
  }

  // Move the probe (dir +1 outward, -1 inward). At the ends of the line it
  // simply stays where it is.
  moveProbe(p, dir) {
    const pd = this.pending;
    if (!pd || pd.stage !== "move" || pd.p !== p) return false;
    if (pd.kind === "meld") dir = 1;
    this.probe = Math.max(0, Math.min(N_BODIES - 1, this.probe + (dir < 0 ? -1 : 1)));
    this.pending = null;
    return true;
  }

  // Mission Control: one per turn. action: "draw2" | "salvage" (arg: index in
  // the discard pile) | "scan" (arg: body). Returns info for the view.
  useMission(p, id, action, arg) {
    if (!this.canMissionAction(p, id, action)) return null;
    const [card] = this.takeFromHand(p, [id]);
    this.missionUsed = true;
    let out = { action };
    if (action === "draw2") {
      const got = [];
      for (let k = 0; k < 2 && this.deck.length; k++) {
        got.push(this.deck.pop());
        if (!this.deck.length) this.lastCardDrawn = true;
      }
      this.hands[p].push(...got);
      out.cards = got;
    } else if (action === "salvage") {
      const i = Math.max(0, Math.min(this.discard.length - 1, arg));
      const got = this.discard.splice(i, 1)[0];
      if (got) this.hands[p].push(got);
      out.card = got;
    } else if (action === "scan") {
      const hidden = this.slots[arg];
      out.loc = arg;
      out.card = hidden;
      if (hidden) {
        this.known[p][arg] = hidden;
        if (hidden.kind !== "artifact") this.pending = { stage: "peek", loc: arg, kind: "scan", p };
      }
    }
    this.discard.push(card);
    return out;
  }

  // Discard to end the turn. Returns { card, handOver }.
  discardCard(p, id) {
    if (!this.canDiscard(p)) return null;
    const [card] = this.takeFromHand(p, [id]);
    this.discard.push(card);
    if (!this.hands[p].length) { this.endHand(p, "out"); return { card, handOver: true }; }
    if (this.lastCardDrawn) { this.endHand(null, "deck"); return { card, handOver: true }; }
    this.turn = (this.turn + 1) % this.numPlayers;
    this.phase = "draw";
    return { card, handOver: false };
  }

  // ---------------------------------------------------------------- scoring

  tablePoints(p) {
    return this.table[p].reduce((a, t) => a + t.normal * POINTS.normal + t.close * POINTS.close, 0);
  }

  endHand(outPlayer, reason) {
    this.phase = "handOver";
    const n = this.numPlayers;
    const rows = [];
    for (let p = 0; p < n; p++) {
      const cards = this.tablePoints(p);
      const arts = this.captured[p].length * POINTS.artifact;
      const bonus = p === outPlayer ? this.probe + 1 : 0;
      rows.push({ p, cards, arts, bonus, total: cards + arts + bonus });
    }
    let shutout = false;
    if (outPlayer != null && this.captured[outPlayer].length === 2) {
      shutout = true;
      rows.forEach(r => { if (r.p !== outPlayer) { r.zeroed = r.total; r.total = 0; } });
    }
    rows.forEach(r => { this.scores[r.p] += r.total; });
    this.endInfo = { reason, outPlayer, shutout, rows, probe: this.probe };
    this.history.push(this.endInfo);

    const top = Math.max(...this.scores);
    const leaders = this.scores.filter(s => s === top).length;
    this.gameOver = top >= this.target && leaders === 1;
    this.dealer = (this.dealer + 1) % n;
    return this.endInfo;
  }

  winner() {
    if (!this.gameOver) return null;
    const top = Math.max(...this.scores);
    return this.scores.indexOf(top);
  }
}
