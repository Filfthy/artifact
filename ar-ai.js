// ar-ai.js
// Computer players for Artifact. Each turn is played one decision at a time
// so the view can animate it:
//   chooseDraw(g, p)          -> "deck" | "discard"
//   choosePlay(g, p)          -> { type: "meld"|"layoff", ids } | { type: "mission", id, action, arg } | null
//   choosePeek(g, p, card)    -> true (take it) | false (leave it)
//   chooseMove(g, p, options) -> +1 | -1
//   chooseDiscard(g, p)       -> card id

class ArtifactAI {
  constructor(difficulty = "medium") { this.setDifficulty(difficulty); }
  // "hard" (Commanders) looks ahead by simulation; "plan" is the same
  // turn planner without it, used to play the simulated futures.
  setDifficulty(d) { this.difficulty = d; this.planner = d === "hard" || d === "plan"; this.sims = d === "hard"; }

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
    if (this.sims && this.uses("draw")) return this.simDraw(g, p);
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
    if (this.sims && this.uses("play")) return this.simPlay(g, p);
    const hand = g.hand(p);
    const gr = this.groups(g, p);
    const spare = hand.length - 1;               // must keep a card to discard
    const arts = this.knownArtifacts(g, p);
    const easy = this.difficulty === "easy", hard = this.planner;

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
    if (this.sims && this.uses("peek")) return this.simPeek(g, p);
    if (card.kind === "mission") return true;
    const gr = this.groups(g, p);
    return gr[card.loc].length >= 1 || g.melded[card.loc] || this.difficulty === "easy";
  }

  chooseMove(g, p, options) {
    if (options.length === 1) return options[0];
    if (this.sims && this.uses("move")) return this.simMove(g, p, options);
    if (this.difficulty === "easy") return options[Math.floor(Math.random() * options.length)];
    if (this.planner) {
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
    if (this.sims && this.uses("discard")) { const id = this.simDiscard(g, p); this.lastDiscard = id; return id; }
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

  // =====================================================================
  // Commanders: look ahead by simulation.
  // Before each decision, the cards this player can't see are dealt out in
  // many possible ways (keeping everything it does know: its own hand, the
  // table, the whole discard pile, hidden cards it has looked at, and cards
  // others were seen to take). Each option is tried in every one of those
  // worlds and the hand is played out to the end by quick players; the
  // option that leaves it furthest ahead of the others wins. Holding sets
  // back, not feeding lay-offs, safe discards and watching the clock all
  // fall out of that, rather than being written as rules.
  // =====================================================================

  static cloneGame(g) {
    const w = Object.create(Object.getPrototypeOf(g));
    w.numPlayers = g.numPlayers; w.target = g.target; w.scores = g.scores.slice();
    w.dealer = g.dealer; w.handNo = g.handNo; w.listeners = []; w.history = []; w.gameOver = false;
    w.phase = g.phase; w.probe = g.probe; w.turn = g.turn;
    w.pending = g.pending ? Object.assign({}, g.pending) : null;
    w.missionUsed = g.missionUsed; w.lastCardDrawn = g.lastCardDrawn; w.endInfo = null;
    w.hands = g.hands.map(h => h.slice()); w.deck = g.deck.slice(); w.discard = g.discard.slice(); w.slots = g.slots.slice();
    w.table = g.table.map(t => t.map(x => ({ normal: x.normal, close: x.close })));
    w.melded = g.melded.slice(); w.captured = g.captured.map(c => c.slice());
    w.known = g.known.map(k => k.slice());
    w.shown = (g.shown || g.hands.map(() => [])).map(x => x.slice());
    return w;
  }

  static shuffleInPlace(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // One possible world, as far as player p can tell.
  determinize(g, p) {
    const w = ArtifactAI.cloneGame(g);
    const n = w.numPlayers, pool = [], arts = [], open = [];
    const fixed = w.shown.map(x => new Set(x.map(c => c.id)));
    for (let q = 0; q < n; q++) if (q !== p) for (const c of w.hands[q]) if (!fixed[q].has(c.id)) pool.push(c);
    for (const c of w.deck) pool.push(c);
    for (let loc = 0; loc < N_BODIES; loc++) {
      const c = w.slots[loc];
      if (!c) continue;
      const k = g.known[p][loc];
      if (k && k.id === c.id) continue;
      open.push(loc);
      (c.kind === "artifact" ? arts : pool).push(c);
    }
    ArtifactAI.shuffleInPlace(pool);
    ArtifactAI.shuffleInPlace(open);
    open.forEach((loc, i) => { w.slots[loc] = i < arts.length ? arts[i] : pool.pop(); });
    for (let q = 0; q < n; q++) {
      if (q === p) continue;
      const size = w.hands[q].length;
      const h = w.hands[q].filter(c => fixed[q].has(c.id));
      while (h.length < size) h.push(pool.pop());
      w.hands[q] = h;
      // Others know whatever is now under the places they looked at.
      for (let loc = 0; loc < N_BODIES; loc++) if (w.known[q][loc]) w.known[q][loc] = w.slots[loc];
    }
    w.deck = pool;
    return w;
  }

  // Play a (simulated) hand on to its end.
  static playOut(w, ais) {
    let steps = 0, who = -1, plays = 0;
    while (w.phase !== "handOver" && steps++ < 5000) {
      const p = w.turn, ai = ais[p];
      if (p !== who) { who = p; plays = 0; }
      if (w.phase === "draw") {
        if (!w.draw(p, ai.chooseDraw(w, p)) && !w.draw(p, "deck") && !w.draw(p, "discard")) return;
        plays = 0;
        continue;
      }
      if (w.pending) {
        if (w.pending.stage === "peek") w.resolvePeek(p, ai.choosePeek(w, p, w.slots[w.pending.loc]));
        else w.moveProbe(p, ai.chooseMove(w, p, w.moveOptions()));
        continue;
      }
      const a = plays++ < 30 ? ai.choosePlay(w, p) : null;
      if (a && (a.type === "mission" ? w.useMission(p, a.id, a.action, a.arg) : w.playCards(p, a.ids, a.type))) continue;
      w.discardCard(p, ai.chooseDiscard(w, p));
    }
  }

  // How good the end of the hand is for p: its points against the others',
  // with a big swing if the game is won or lost on it.
  static outcome(w, p) {
    if (w.phase !== "handOver" || !w.endInfo) return 0;
    const rows = w.endInfo.rows, n = rows.length;
    const mine = rows[p].total;
    let sum = 0, max = -Infinity;
    for (const r of rows) if (r.p !== p) { sum += r.total; if (r.total > max) max = r.total; }
    let v = n === 2 ? mine - max : mine - (0.5 * sum / (n - 1) + 0.5 * max);
    const top = Math.max(...w.scores);
    if (top >= w.target) v += w.scores[p] === top ? 60 : -60;
    return v;
  }

  rolloutAIs(n, p) {
    if (!this._pool || this._pool.length !== n) this._pool = Array.from({ length: n }, () => new ArtifactAI(this.rolloutOpp || "plan"));
    if (!this._self) this._self = new ArtifactAI(this.rolloutSelf || "plan");
    const ais = this._pool.slice();
    ais[p] = this._self;
    return ais;
  }

  // The quick (non-simulating) Commander, for default choices.
  quick() { if (!this._quick) this._quick = new ArtifactAI("plan"); return this._quick; }

  uses(kind) { return !this.only || this.only.includes(kind); }

  static now() { return (typeof performance !== "undefined" ? performance : Date).now(); }

  // Try every option in many sampled worlds and return the best. apply(w, o)
  // carries out option o for p in world w; alt(o), if given, is a second way
  // to carry it out, and the option keeps whichever of the two does better.
  // prior is the quick player's choice: the simulations only overrule it when
  // the winner is ahead of it by more than the noise (world by world).
  simBest(g, p, options, apply, alt = null, prior = 0) {
    if (options.length < 2) return options[0];
    const budget = this.budgetMs || 200, maxWorlds = this.maxWorlds || 400, minWorlds = this.minWorlds || 12;
    const t0 = ArtifactAI.now();
    const ais = this.rolloutAIs(g.numPlayers, p);
    const vals = options.map(() => []), altVals = options.map(() => []);
    const altFns = options.map(o => (alt ? alt(o) : null));
    let k = 0;
    while (k < maxWorlds) {
      const base = this.cheat ? ArtifactAI.cloneGame(g) : this.determinize(g, p);
      for (let i = 0; i < options.length; i++) {
        const w = ArtifactAI.cloneGame(base);
        apply(w, options[i]);
        ArtifactAI.playOut(w, ais);
        vals[i].push(ArtifactAI.outcome(w, p));
        if (altFns[i]) {
          const w2 = ArtifactAI.cloneGame(base);
          altFns[i](w2);
          ArtifactAI.playOut(w2, ais);
          altVals[i].push(ArtifactAI.outcome(w2, p));
        }
      }
      k++;
      if (k >= minWorlds && ArtifactAI.now() - t0 > budget) break;
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    // each option's better continuation, world by world
    const per = options.map((o, i) => (altFns[i] && mean(altVals[i]) > mean(vals[i]) ? altVals[i] : vals[i]));
    let best = 0, bv = -Infinity;
    for (let i = 0; i < options.length; i++) { const v = mean(per[i]); if (v > bv) { bv = v; best = i; } }
    this.lastSims = k;
    if (best !== prior && prior >= 0 && prior < options.length) {
      const d = per[best].map((v, j) => v - per[prior][j]);
      const m = mean(d), sd = Math.sqrt(d.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, d.length - 1));
      if (m < (this.zEdge == null ? 1 : this.zEdge) * sd / Math.sqrt(d.length)) best = prior;
    }
    return options[best];
  }

  // Where the quick player's choice sits in an option list (or -1).
  static indexOf(options, choice, same) {
    for (let i = 0; i < options.length; i++) if (same(options[i], choice)) return i;
    return -1;
  }

  simDraw(g, p) {
    const opts = [];
    if (g.deck.length) opts.push("deck");
    if (g.discard.length) opts.push("discard");
    const prior = opts.indexOf(this.quick().chooseDraw(g, p));
    return this.simBest(g, p, opts, (w, o) => { w.draw(p, o); }, null, prior);
  }

  // Everything p could do next this turn (null = stop and discard).
  playOptions(g, p) {
    const hand = g.hand(p), spare = hand.length - 1, gr = this.groups(g, p);
    const opts = [null];
    const mc = hand.find(c => c.kind === "mission");
    if (mc && !g.missionUsed) {
      if (g.canMissionAction(p, mc.id, "draw2")) opts.push({ type: "mission", id: mc.id, action: "draw2" });
      if (g.canMissionAction(p, mc.id, "salvage")) {
        const seen = new Set();
        for (let i = g.discard.length - 1; i >= 0; i--) {
          const c = g.discard[i], key = c.kind + c.loc;
          if (seen.has(key) || c.kind === "artifact") continue;
          seen.add(key);
          opts.push({ type: "mission", id: mc.id, action: "salvage", arg: i });
        }
      }
      if (g.canMissionAction(p, mc.id, "scan")) {
        for (let loc = 0; loc < N_BODIES; loc++) {
          const c = g.slots[loc], k = g.known[p][loc];
          if (!c || (k && k.id === c.id && k.kind === "artifact")) continue;
          opts.push({ type: "mission", id: mc.id, action: "scan", arg: loc });
        }
      }
    }
    for (let loc = 0; loc < N_BODIES; loc++) {
      const cs = gr[loc], n = cs.length;
      if (!n) continue;
      if (n >= 3 && spare >= 3) {
        opts.push({ type: "meld", ids: cs.slice(0, Math.min(n, spare)).map(c => c.id) });
        if (n > 3 && spare > 3) opts.push({ type: "meld", ids: cs.slice(0, 3).map(c => c.id) });
      }
      if (g.melded[loc] && spare >= 1) {
        const k = Math.min(n, spare);
        opts.push({ type: "layoff", ids: cs.slice(0, k).map(c => c.id) });
        if (k >= 2) opts.push({ type: "layoff", ids: [cs[0].id] });
      }
    }
    return opts;
  }

  simPlay(g, p) {
    const opts = this.playOptions(g, p);
    const self = () => this.rolloutAIs(g.numPlayers, p)[p];
    const doIt = (w, o) => {
      if (!o) { w.discardCard(p, self().chooseDiscard(w, p)); return; }
      if (o.type === "mission") w.useMission(p, o.id, o.action, o.arg);
      else w.playCards(p, o.ids, o.type);
    };
    // Each play is judged two ways: with the rest of the turn played out,
    // and stopping straight after it (holding everything else back).
    const stopAfter = o => o && (w => {
      doIt(w, o);
      let guard = 0;
      while (w.pending && w.phase !== "handOver" && guard++ < 10) {
        if (w.pending.stage === "peek") w.resolvePeek(p, self().choosePeek(w, p, w.slots[w.pending.loc]));
        else w.moveProbe(p, self().chooseMove(w, p, w.moveOptions()));
      }
      if (w.phase === "play" && !w.pending) w.discardCard(p, self().chooseDiscard(w, p));
    });
    const q = this.quick().choosePlay(g, p);
    const key = o => (!o ? "stop" : o.type === "mission" ? "m" + o.action + (o.arg == null ? "" : o.arg) : o.type + o.ids.slice().sort().join(","));
    let prior = ArtifactAI.indexOf(opts, q, (a, b) => key(a) === key(b));
    if (prior < 0 && q && q.type === "mission") prior = ArtifactAI.indexOf(opts, q, (a, b) => a && a.type === "mission" && a.action === b.action);
    if (prior < 0) prior = 0;
    return this.simBest(g, p, opts, doIt, stopAfter, prior);
  }

  simPeek(g, p) {
    const prior = this.quick().choosePeek(g, p, g.slots[g.pending.loc]) ? 0 : 1;
    return this.simBest(g, p, [true, false], (w, o) => { w.resolvePeek(p, o); }, null, prior);
  }

  simMove(g, p, options) {
    const prior = options.indexOf(this.quick().chooseMove(g, p, options));
    return this.simBest(g, p, options, (w, o) => { w.moveProbe(p, o); }, null, prior);
  }

  simDiscard(g, p) {
    const seen = new Map();
    for (const c of g.hand(p)) { const key = c.kind + c.loc; if (!seen.has(key)) seen.set(key, c.id); }
    const opts = [...seen.values()];
    const qc = this.quick().chooseDiscard(g, p), qcard = g.hand(p).find(c => c.id === qc);
    const prior = Math.max(0, opts.findIndex(id => { const c = g.hand(p).find(x => x.id === id); return c.kind === qcard.kind && c.loc === qcard.loc; }));
    return this.simBest(g, p, opts, (w, id) => { w.discardCard(p, id); }, null, prior);
  }
}
