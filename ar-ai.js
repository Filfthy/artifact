// ar-ai.js
// Computer players for Artifact. Each turn is played one decision at a time
// so the view can animate it:
//   chooseDraw(g, p)          -> "deck" | "discard"
//   choosePlay(g, p)          -> { type: "meld"|"layoff", ids } | { type: "mission", id, action, arg } | null
//   choosePeek(g, p, card)    -> true (take it) | false (leave it)
//   chooseMove(g, p, options) -> +1 | -1
//   chooseDiscard(g, p)       -> card id

class ArtifactAI {
  constructor(difficulty = "medium") { this.difficulty = difficulty; }
  setDifficulty(d) { this.difficulty = d; }

  groups(g, p) {
    const gr = Array.from({ length: N_BODIES }, () => []);
    for (const c of g.hand(p)) if (c.kind === "body") gr[c.loc].push(c);
    return gr;
  }

  // Where this player knows an Artifact is hidden (or -1).
  knownArtifacts(g, p) {
    const out = [];
    g.known[p].forEach((c, loc) => { if (c && c.kind === "artifact" && g.slots[loc] === c) out.push(loc); });
    return out;
  }

  // Cards of loc this player could play right now (as a meld or a layoff).
  playableAt(g, p, gr, loc, spare) {
    const n = gr[loc].length;
    if (!n || spare < 1) return 0;
    if (n >= 3 || g.melded[loc]) return Math.min(n, spare);
    return 0;
  }

  chooseDraw(g, p) {
    const top = g.topDiscard();
    if (!top || !g.deck.length) return top ? "discard" : "deck";
    if (top.id === this.lastDiscard) return "deck";   // never take back what we just threw away
    // A Mission Control card is only worth taking if it can still be used.
    if (top.kind === "mission") return this.difficulty !== "easy" && g.deck.length >= 4 && !g.hand(p).some(c => c.kind === "mission") ? "discard" : "deck";
    if (top.kind !== "body") return "deck";
    const gr = this.groups(g, p);
    const have = gr[top.loc].length;
    const after = g.hand(p).length + 1;
    // Only if it can actually be played this turn while keeping a card to discard.
    const meldable = have >= 2 && after - (have + 1) >= 1;
    const layable = g.melded[top.loc] && after >= 2;
    if (meldable || (layable && this.difficulty !== "easy")) return "discard";
    return "deck";
  }

  choosePlay(g, p) {
    const hand = g.hand(p);
    const gr = this.groups(g, p);
    const spare = hand.length - 1;               // must keep a card to discard
    const arts = this.knownArtifacts(g, p);
    const easy = this.difficulty === "easy", hard = this.difficulty === "hard";

    // Mission Control first (it may bring cards to play).
    const mc = hand.find(c => c.kind === "mission");
    if (mc && !g.missionUsed && hand.length >= 2) {
      const m = this.missionChoice(g, p, gr);
      if (m) return { type: "mission", id: mc.id, ...m };
    }

    if (hard) {
      return this.planTurn(g, p, gr, spare, arts).play;
    }

    let best = null, bestScore = 0;
    for (let loc = 0; loc < N_BODIES; loc++) {
      const cards = gr[loc];
      if (!cards.length) continue;
      const close = g.probe === loc;
      const options = [];
      if (cards.length >= 3 && cards.length <= spare) options.push({ type: "meld", ids: cards.map(c => c.id) });
      else if (cards.length >= 3 && spare >= 3) options.push({ type: "meld", ids: cards.slice(0, spare).map(c => c.id) });
      if (g.melded[loc]) {
        const k = Math.min(cards.length, spare);
        if (k >= 1) options.push({ type: "layoff", ids: cards.slice(0, k).map(c => c.id) });
        // one card at a time gives extra probe moves (for steering)
        if (!easy && k >= 2) options.push({ type: "layoff", ids: [cards[0].id], single: true });
      }
      for (const o of options) {
        let s = o.ids.length * (close ? 4 : 2);
        if (close && arts.includes(loc)) s += 25;            // capture!
        if (!easy) s += this.steerValue(g, p, gr, o, loc, spare - o.ids.length, arts);
        if (o.single) s -= 1.5;
        // Wait for a close pass: hold a set if the probe is just short of it.
        if (easy) s += Math.random() * 3;
        if (s > bestScore) { bestScore = s; best = o; }
      }
    }
    return best ? { type: best.type, ids: best.ids } : null;
  }

  // Hard: search every order of this turn's plays (and probe moves) for the
  // most points, counting close passes, captures and going out. Returns the
  // first play of the best sequence, or null if playing nothing is best.
  planTurn(g, p, gr, spare, arts) {
    const counts = gr.map(a => a.length);
    const melded = g.melded.slice();
    const artSet = new Set(arts);
    const memo = new Map();
    let nodes = 0;

    const search = (probe, spareLeft, cnt, mel, captured, depth) => {
      const key = probe + "|" + spareLeft + "|" + cnt.join("") + "|" + mel.map(Number).join("") + "|" + captured;
      if (memo.has(key)) return memo.get(key);
      // Stopping here: going out (one card left to discard) earns the bonus.
      let best = { v: spareLeft === 0 ? 8 + probe + 1 : 0, first: null };
      if (depth < 9 && nodes++ < 20000) {
        for (let loc = 0; loc < N_BODIES; loc++) {
          const n = cnt[loc];
          if (!n) continue;
          const close = probe === loc;
          const opts = [];
          if (n >= 3 && n <= spareLeft) opts.push({ type: "meld", k: n });
          if (mel[loc]) {
            const k = Math.min(n, spareLeft);
            if (k >= 1) opts.push({ type: "layoff", k });
            if (k >= 2) opts.push({ type: "layoff", k: 1 });
          }
          for (const o of opts) {
            let gain = o.k * (close ? 4 : 2);
            let cap = captured;
            if (close && artSet.has(loc) && !(captured & (1 << loc))) { gain += 10; cap |= 1 << loc; }
            const c2 = cnt.slice(); c2[loc] -= o.k;
            const m2 = mel.slice(); if (o.type === "meld") m2[loc] = true;
            const dirs = o.type === "meld" ? [1] : [1, -1];
            for (const d of dirs) {
              const np = Math.max(0, Math.min(N_BODIES - 1, probe + d));
              const r = search(np, spareLeft - o.k, c2, m2, cap, depth + 1);
              if (gain + r.v > best.v) best = { v: gain + r.v, first: { type: o.type, loc, k: o.k } };
            }
          }
        }
      }
      memo.set(key, best);
      return best;
    };

    const res = search(g.probe, spare, counts, melded, 0, 0);
    if (!res.first) return { v: res.v, play: null };
    const f = res.first;
    return { v: res.v, play: { type: f.type, ids: gr[f.loc].slice(0, f.k).map(c => c.id) } };
  }

  planValue(g, p, gr, spare, arts) { return this.planTurn(g, p, gr, spare, arts).v; }

  // How good is the probe's next position after this play?
  steerValue(g, p, gr, o, loc, spareAfter, arts) {
    const dirs = o.type === "meld" ? [1] : [1, -1];
    let best = 0;
    for (const d of dirs) {
      const np = Math.max(0, Math.min(N_BODIES - 1, g.probe + d));
      const left = gr[np].length - (np === loc ? o.ids.length : 0);
      let v = 0;
      if (left > 0 && (left >= 3 || g.melded[np] || (o.type === "meld" && np === loc))) v += Math.min(left, spareAfter) * 2;
      if (arts.includes(np) && left > 0) v += 12;
      best = Math.max(best, v);
    }
    return best * 0.8;
  }

  // Use Mission Control straight away (self-play: holding them clogs your
  // hand and loses the race to go out). Drawing 2 is best; medium prefers
  // to pick a set-completing card out of the discard pile.
  missionChoice(g, p, gr) {
    if (this.difficulty === "medium") {
      for (let i = g.discard.length - 1; i >= 0; i--) {
        const c = g.discard[i];
        if (c.kind === "body" && (gr[c.loc].length >= 2 || (g.melded[c.loc] && gr[c.loc].length >= 1))) return { action: "salvage", arg: i };
      }
    }
    if (g.deck.length >= 2) return { action: "draw2" };
    // Nearly out of cards: anything that gets rid of it.
    for (let i = g.discard.length - 1; i >= 0; i--) if (g.discard[i].kind === "body") return { action: "salvage", arg: i };
    for (let loc = 0; loc < N_BODIES; loc++) if (g.slots[loc]) return { action: "scan", arg: loc };
    return null;
  }

  choosePeek(g, p, card) {
    if (!card || card.kind === "artifact") return false;
    if (card.kind === "mission") return true;
    const gr = this.groups(g, p);
    return gr[card.loc].length >= 1 || g.melded[card.loc] || this.difficulty === "easy";
  }

  chooseMove(g, p, options) {
    if (options.length === 1) return options[0];
    if (this.difficulty === "easy") return options[Math.floor(Math.random() * options.length)];
    if (this.difficulty === "hard") {
      // Follow the plan: try each direction and see which leaves the better turn.
      const gr = this.groups(g, p), arts = this.knownArtifacts(g, p), spare = g.hand(p).length - 1;
      let best = options[0], bestV = -Infinity;
      const saved = g.probe;
      for (const d of options) {
        g.probe = saved + d;
        const v = this.planValue(g, p, gr, spare, arts) + (d > 0 ? 0.3 : 0);
        if (v > bestV) { bestV = v; best = d; }
      }
      g.probe = saved;
      return best;
    }
    const gr = this.groups(g, p);
    const arts = this.knownArtifacts(g, p);
    const spare = g.hand(p).length - 1;
    let best = options[0], bestV = -1;
    for (const d of options) {
      const np = g.probe + d;
      let v = this.playableAt(g, p, gr, np, spare) * 2;
      if (arts.includes(np) && gr[np].length) v += 12;
      if (d > 0) v += 0.5;     // further out: a bigger bonus for going out
      if (v > bestV) { bestV = v; best = d; }
    }
    return best;
  }

  chooseDiscard(g, p) {
    const hand = g.hand(p);
    const gr = this.groups(g, p);
    let worst = null, worstV = Infinity;
    for (const c of hand) {
      let v;
      if (c.kind === "mission") v = 6;
      else if (c.kind === "artifact") v = 50;
      else {
        v = gr[c.loc].length * 2 + (g.melded[c.loc] ? 3 : 0) - Math.abs(c.loc - g.probe) * 0.2;
      }
      if (this.difficulty === "easy") v += Math.random() * 4;
      if (v < worstV) { worstV = v; worst = c; }
    }
    this.lastDiscard = worst.id;
    return worst.id;
  }
}
