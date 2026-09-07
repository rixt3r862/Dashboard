// Classic 162-card Skip-Bo. Zero denotes a wild; pile length is its played value.
export function shuffle(cards, random = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function deck() {
  return Array.from({ length: 162 }, (_, i) => i < 144 ? i % 12 + 1 : 0);
}
export function createGame(names, { short = false, target = 500 } = {}) {
  if (names.length < 2 || names.length > 6) throw new Error('Choose 2–6 players.');
  const state = { version: 1, players: names.map((name, i) => ({ id: `p${i}`, name, score: 0, stock: [], hand: [], discards: [[], [], [], []] })), short, target, roundNumber: 0, dealer: Math.floor(Math.random() * names.length), history: [], phase: 'roundOver', winnerId: null };
  nextRound(state);
  return state;
}
export function nextRound(s) {
  if (s.phase !== 'roundOver') return false;
  s.roundNumber++;
  s.dealer = (s.dealer + 1) % s.players.length;
  s.draw = shuffle(deck()); s.completed = []; s.builds = [[], [], [], []];
  const size = s.short ? 10 : s.players.length > 4 ? 20 : 30;
  for (const p of s.players) { p.stock = s.draw.splice(-size); p.hand = []; p.discards = [[], [], [], []]; }
  s.current = (s.dealer + 1) % s.players.length;
  s.phase = 'playing'; s.roundWinner = null; s.passes = 0;
  refill(s); return true;
}
export function refill(s) {
  const p = s.players[s.current];
  while (p.hand.length < 5) {
    if (!s.draw.length && s.completed.length) s.draw = shuffle(s.completed.splice(0));
    if (!s.draw.length) break;
    p.hand.push(s.draw.pop());
  }
}
export function sourceCards(s, source) {
  const p = s.players[s.current];
  if (source.kind === 'stock') return p.stock;
  if (source.kind === 'hand') return p.hand;
  if (source.kind === 'discard' && Number.isInteger(source.index)) return p.discards[source.index];
}
export function sourceValue(s, source) {
  const cards = sourceCards(s, source);
  return cards?.[source.kind === 'hand' ? source.index : cards.length - 1];
}
export function canPlay(s, source, pile) {
  if (s.phase !== 'playing' || !Number.isInteger(pile) || !s.builds[pile]) return false;
  const value = sourceValue(s, source);
  return value !== undefined && (value === 0 || value === s.builds[pile].length + 1);
}
export function play(s, source, pile) {
  if (!canPlay(s, source, pile)) return false;
  const p = s.players[s.current], cards = sourceCards(s, source);
  const [value] = cards.splice(source.kind === 'hand' ? source.index : cards.length - 1, 1);
  s.builds[pile].push(value); s.passes = 0;
  if (s.builds[pile].length === 12) s.completed.push(...s.builds[pile].splice(0));
  if (!p.stock.length) {
    const points = 25 + s.players.reduce((sum, other) => sum + other.stock.length * 5, 0);
    p.score += points; s.roundWinner = p.id;
    s.history.push({ ts: Date.now(), winnerId: p.id, scores: Object.fromEntries(s.players.map(other => [other.id, other === p ? points : 0])), remaining: s.players.map(other => other.stock.length) });
    s.phase = p.score >= s.target ? 'finished' : 'roundOver';
    if (s.phase === 'finished') s.winnerId = p.id;
  } else if (!p.hand.length) refill(s);
  return true;
}
export function discard(s, index, pile) {
  const p = s.players[s.current];
  if (s.phase !== 'playing' || !Number.isInteger(index) || index < 0 || index >= p.hand.length || !Number.isInteger(pile) || !p.discards[pile]) return false;
  p.discards[pile].push(p.hand.splice(index, 1)[0]);
  s.current = (s.current + 1) % s.players.length; refill(s); return true;
}
export function legalMoves(s) {
  if (s.phase !== 'playing') return [];
  const p = s.players[s.current];
  const sources = [{ kind: 'stock' }, ...p.discards.map((_, index) => ({ kind: 'discard', index })), ...p.hand.map((_, index) => ({ kind: 'hand', index }))];
  return sources.flatMap(source => s.builds.flatMap((_, pile) => canPlay(s, source, pile) ? [{ source, pile }] : []));
}
// Only own hand and exposed cards influence decisions; hidden stock is never inspected.
export function botMove(s, difficulty = 'medium') {
  const moves = legalMoves(s), p = s.players[s.current];
  if (moves.length) {
    if (difficulty === 'easy') return { type: 'play', ...moves[Math.floor(Math.random() * moves.length)] };
    const stock = p.stock.at(-1);
    const rank = m => (m.source.kind === 'stock' ? 100 : 0) + (m.source.kind === 'discard' ? 15 : 0) - (sourceValue(s, m.source) === 0 ? 12 : 0) + (difficulty === 'hard' && stock === s.builds[m.pile].length + 2 ? 35 : 0);
    moves.sort((a, b) => rank(b) - rank(a));
    return { type: 'play', ...moves[0] };
  }
  if (!p.hand.length) return { type: 'pass' };
  let best = { type: 'discard', index: 0, pile: 0 }, score = -Infinity;
  p.hand.forEach((value, index) => p.discards.forEach((cards, pile) => {
    const top = cards.at(-1);
    const rank = (value === 0 ? -100 : value) + (top === value + 1 ? 40 : top === value ? 25 : top === undefined ? 15 : -10);
    if (rank > score) { score = rank; best = { type: 'discard', index, pile }; }
  }));
  return best;
}
// Exhausted draw + empty hand: allow a turn to advance rather than strand the table.
export function pass(s) {
  if (s.phase !== 'playing' || s.players[s.current].hand.length || legalMoves(s).length) return false;
  s.passes++;
  if (s.passes >= s.players.length) { s.phase = 'roundOver'; s.roundWinner = null; }
  else { s.current = (s.current + 1) % s.players.length; refill(s); }
  return true;
}
export function validateState(raw) {
  const fail = () => { throw new Error('This is not a valid Skip-Bo session.'); };
  if (!raw || raw.version !== 1 || !Array.isArray(raw.players) || raw.players.length < 2 || raw.players.length > 6) fail();
  const s = JSON.parse(JSON.stringify(raw));
  const ints = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!['playing', 'roundOver', 'finished'].includes(s.phase) || !ints(s.current, 0, s.players.length - 1) || !ints(s.dealer, 0, s.players.length - 1) || !ints(s.roundNumber, 1, 100000) || ![1, 500].includes(s.target) || typeof s.short !== 'boolean' || !ints(s.passes, 0, s.players.length) || !Array.isArray(s.history)) fail();
  const all = [], ids = new Set();
  const pile = (cards, max = 162) => { if (!Array.isArray(cards) || cards.length > max || cards.some(v => !ints(v, 0, 12))) fail(); all.push(...cards); };
  for (const p of s.players) {
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 24 || !ints(p.score, 0, 10000000)) fail();
    ids.add(p.id); pile(p.stock, 30); pile(p.hand, 5);
    if (!Array.isArray(p.discards) || p.discards.length !== 4) fail();
    p.discards.forEach(cards => pile(cards));
  }
  pile(s.draw); pile(s.completed);
  if (!Array.isArray(s.builds) || s.builds.length !== 4) fail();
  for (const cards of s.builds) { pile(cards, 11); if (cards.some((v, i) => v !== 0 && v !== i + 1)) fail(); }
  if (all.length !== 162 || Array.from({ length: 13 }, (_, v) => all.filter(c => c === v).length).some((n, v) => n !== (v === 0 ? 18 : 12))) fail();
  if ((s.winnerId !== null && !ids.has(s.winnerId)) || (s.roundWinner !== null && !ids.has(s.roundWinner))) fail();
  if (s.phase === 'playing' && s.players.some(p => !p.stock.length)) fail();
  if (s.phase === 'finished' && (!s.winnerId || !s.players.some(p => p.id === s.winnerId && p.score >= s.target && !p.stock.length))) fail();
  for (const h of s.history) {
    if (!h || !ids.has(h.winnerId) || !Number.isFinite(h.ts) || !h.scores || !Array.isArray(h.remaining) || h.remaining.length !== s.players.length || h.remaining.some(n => !ints(n, 0, 30))) fail();
    for (const p of s.players) if (!ints(h.scores[p.id], 0, 775)) fail();
  }
  for (const p of s.players) if (p.score !== s.history.reduce((n, h) => n + h.scores[p.id], 0)) fail();
  return s;
}
