import * as E from './engine.mjs';
import { createMotion } from './motion.mjs';
const motion = createMotion(document, window);
let moving = false;
const $ = id => document.getElementById(id);
const G = window.GameRoom || {};
const esc = G.escapeHtml || (v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]));
const read = G.readStoredJson || ((key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } });
const write = G.writeStoredJson || ((key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } });
const download = G.downloadJson || ((name, value) => { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type:'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
const KEY = 'skipbo.sessions.v1', AUTO = 'skipbo.autosave.v1';
let state = null, selected = null, timer = null, order = 'desc', currentSession = '', difficulties = [], message = '';
let sessions = read(KEY, []); if (!Array.isArray(sessions)) sessions = [];
sessions = sessions.filter(s => s && typeof s.id === 'string' && typeof s.name === 'string' && s.payload);
function namesFields(shuffle = false) {
  const previous = [...document.querySelectorAll('.bot-name')].map(e => e.value);
  const count = Number($('playerCount').value) - 1;
  const names = G.setupBotNames?.(count, $('humanName').value) || ['Sam','Alex','Nick','Henry','Jack'];
  $('botNameFields').innerHTML = Array.from({length:count}, (_, i) => `<div class="bot-field"><label class="field"><span>Bot ${i + 1}</span><input class="bot-name" maxlength="24" required value="${esc(!shuffle && previous[i] || names[i])}"></label><label class="field"><span>Difficulty</span><select class="bot-difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></label></div>`).join('');
}
function face(value, label = '') {
  if (value === undefined) return '<span class="playing-card empty" aria-hidden="true">—</span>';
  return `<span class="playing-card illustrated" aria-hidden="true"><img src="./cards/${value}.svg" alt="" draggable="false">${label ? `<span class="card-value-label">${esc(label)}</span>` : ''}</span>`;
}
function back() {
  return '<span class="playing-card illustrated card-back" aria-hidden="true"><img src="./cards/back.svg" alt="" draggable="false"></span>';
}
const same = (a, b) => a && b && a.kind === b.kind && a.index === b.index;
const humanTurn = () => state?.phase === 'playing' && state.current === 0;
function card(source, value, label) {
  const playable = humanTurn() && state.builds.some((_, i) => E.canPlay(state, source, i));
  return `<button type="button" class="card-button ${playable ? 'playable' : ''} ${same(source, selected) ? 'selected' : ''}" data-source="${source.kind}" data-index="${source.index ?? ''}" aria-label="${esc(label)}: ${value === undefined ? 'empty' : value === 0 ? 'Skip-Bo wild' : value}" aria-pressed="${!!same(source, selected)}" ${!humanTurn() || value === undefined ? 'disabled' : ''}>${face(value)}</button>`;
}
function notify(text) { message = text; render(); }
function persist() {
  if (state && !write(AUTO, { state, difficulties })) $('sessionStatus').textContent = 'Autosave unavailable. Download JSON to keep this table.';
}
function changed() { selected = null; message = ''; persist(); render(); schedule(); }
function pileSelector(player, kind, index = 0) {
  if (player === 0) {
    if (kind === 'hand') return `#hand [data-index="${index}"] .playing-card`;
    if (kind === 'stock') return '#stock .playing-card';
    return `#discards [data-discard="${index}"] .playing-card`;
  }
  const slot = kind === 'hand' ? 1 : kind === 'stock' ? 2 : index + 3;
  return `#bots .bot-seat:nth-child(${player}) .mini-pile:nth-child(${slot}) .playing-card`;
}
async function moveWithAnimation(move, mutate) {
  if (moving) return;
  clearTimeout(timer);
  const before = state ? structuredClone(state) : null;
  const player = before?.current;
  const source = move.type === 'play' ? move.source : { kind: 'hand', index: move.index };
  const origin = before && motion.rect(pileSelector(player, source.kind, source.index));
  const drawOrigin = motion.rect('#drawPile .playing-card');
  const value = before && ['play', 'discard'].includes(move.type) ? E.sourceValue(before, source) : 'back';
  if (mutate() === false) { schedule(); return; }
  selected = null; message = ''; persist(); render();
  // Hide incoming faces before any awaited play/discard flight lets the browser paint.
  const oldHandCounts = state.players.map((_, i) => move.type === 'deal' ? 0 :
    before.players[i].hand.length - (i === player && (move.type === 'discard' ||
      (move.type === 'play' && source.kind === 'hand')) ? 1 : 0));
  const incomingFaces = new Map();
  for (let j = Math.max(0, oldHandCounts[0]); j < state.players[0].hand.length; j++) {
    const target = document.querySelector(pileSelector(0, 'hand', j));
    if (target) { target.style.visibility = 'hidden'; incomingFaces.set(j, target); }
  }
  // State is committed before motion, so saves/reloads never lose a card in flight.
  moving = true;
  const main = document.querySelector('main');
  main.inert = true;
  try {
    if (move.type === 'play' || move.type === 'discard') {
      const destination = move.type === 'play' ? `#builds [data-build="${move.pile}"] .playing-card` : pileSelector(player, 'discard', move.pile);
      const target = document.querySelector(destination);
      const end = motion.rect(destination);
      if (target) target.style.visibility = 'hidden';
      try { await motion.fly(origin, end, value); }
      finally { if (target) target.style.visibility = ''; }
      if (move.type === 'play' && before.builds[move.pile].length === 11) {
        await motion.fly(end, motion.rect('#drawPile .playing-card'), value);
      }
    }
    const draw = motion.rect('#drawPile .playing-card') || drawOrigin;
    const flights = [];
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (move.type === 'deal') {
        // Represent the stock deal with a short fan instead of dozens of flights.
        for (let j = 0; j < 3; j++) flights.push(motion.fly(draw, motion.rect(pileSelector(i, 'stock')), 'back', (i * 3 + j) * 42));
      }
      const oldCount = oldHandCounts[i];
      for (let j = Math.max(0, oldCount); j < p.hand.length; j++) {
        const selector = pileSelector(i, 'hand', j);
        const target = i === 0 ? incomingFaces.get(j) : null;
        flights.push(motion.fly(draw, motion.rect(selector), 'back', (j - oldCount) * 42).finally(() => { if (target) target.style.visibility = ''; }));
      }
    }
    await Promise.allSettled(flights);
  } catch (error) {
    window.DashboardErrorLog?.record({ type: 'animation', message: String(error) });
  } finally {
    // Also reveal cards if a preceding flight fails or is cancelled.
    incomingFaces.forEach(target => { target.style.visibility = ''; });
    main.inert = false;
    moving = false;
    schedule();
  }
}
function schedule() {
  clearTimeout(timer);
  if (moving || !state || state.phase !== 'playing' || state.current === 0) return;
  timer = setTimeout(() => {
    const move = E.botMove(state, difficulties[state.current - 1]);
    moveWithAnimation(move, () => move.type === 'play' ? E.play(state, move.source, move.pile) : move.type === 'discard' ? E.discard(state, move.index, move.pile) : E.pass(state));
  }, 650);
}
function render() {
  const active = !!state;
  document.querySelector('.layout').classList.toggle('has-game', active);
  $('setupFields').hidden = active; $('setupSummary').hidden = !active;
  $('startGame').textContent = active ? 'Start Game with Same Players' : 'Start Game';
  ['saveSession','downloadSession'].forEach(id => $(id).disabled = !active);
  $('exportScores').disabled = !state?.history.length;
  $('hint').disabled = $('sortHand').disabled = !humanTurn();
  $('nextRound').hidden = state?.phase !== 'roundOver';
  $('passTurn').hidden = !humanTurn() || state.players[0].hand.length > 0 || E.legalMoves(state).length > 0;
  $('winnerBanner').hidden = !state || state.phase === 'playing';
  if (!state) { ['bots','builds','hand','stock','discards','history','statusGrid','humanSummary','drawPile'].forEach(id => $(id).innerHTML = ''); $('statusText').textContent = 'Deal a table to begin.'; $('actionHint').textContent = 'Start a game to see your cards.'; $('historySummary').textContent = 'Completed rounds will appear here.'; return; }
  const human = state.players[0], current = state.players[state.current];
  $('setupSummary').textContent = `${state.players.map(p => p.name).join(', ')} • ${state.short ? '10-card stock' : 'Standard stock'} • ${state.target === 1 ? 'One round' : '500 points'}`;
  $('statusText').textContent = state.phase === 'playing' ? `${current.name}’s turn` : state.phase === 'finished' ? 'Game complete.' : 'Round complete.';
  $('statusGrid').innerHTML = [['Round',state.roundNumber],['Draw pile',state.draw.length],['Your stock',human.stock.length],['Your score',human.score]].map(([label,value]) => `<div class="status-chip"><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('drawPile').innerHTML = `${state.draw.length ? back() : face(undefined)}<span>${state.draw.length} cards · Draws automatically</span>`;
  $('humanSummary').textContent = `${human.name} • ${human.score} points • ${human.stock.length} stock cards left`;
  $('actionHint').textContent = message || (humanTurn() ? selected ? `Choose a highlighted building pile${selected.kind === 'hand' ? ', or click a discard pile to end your turn' : ''}.` : 'Select a hand card, your stock top, or a discard top. Green outlines mark playable cards.' : state.phase === 'playing' ? `${current.name} is playing…` : 'The round has ended.');
  $('bots').innerHTML = state.players.slice(1).map((p, i) => `<article class="bot-seat ${state.phase === 'playing' && state.current === i + 1 ? 'active' : ''}"><div class="seat-title"><strong>${esc(p.name)}</strong><span>${p.score} pts</span></div><p class="bot-meta">${esc(difficulties[i] || 'medium')} · ${p.hand.length} in hand · ${p.stock.length} stock</p><div class="bot-cards"><div class="mini-pile">${p.hand.length ? back() : face(undefined)}<small>Hand · ${p.hand.length}</small></div><div class="mini-pile">${face(p.stock.at(-1))}<small>Stock</small></div>${p.discards.map((pile, j) => `<div class="mini-pile">${face(pile.at(-1))}<small>D${j+1} · ${pile.length}</small></div>`).join('')}</div></article>`).join('');
  $('builds').innerHTML = state.builds.map((pile, i) => `<div class="pile-slot"><p>Build ${i+1}</p><button class="card-button ${selected && E.canPlay(state, selected, i) ? 'playable' : ''}" data-build="${i}" aria-label="Build ${i+1}, needs ${pile.length+1}" ${!humanTurn() || !selected || !E.canPlay(state, selected, i) ? 'disabled' : ''}>${face(pile.at(-1), pile.at(-1) === 0 ? `As ${pile.length}` : '')}</button><p>Next: ${pile.length+1}</p></div>`).join('');
  $('stock').innerHTML = card({kind:'stock'}, human.stock.at(-1), 'Your stock');
  // Bot moves should not replace an unchanged human hand (or disturb its focus).
  const handMarkup = human.hand.map((v,index) => card({kind:'hand',index}, v, `Hand card ${index+1}`)).join('');
  const hand = $('hand');
  if (hand.dataset.markup !== handMarkup || !hand.childElementCount) {
    hand.innerHTML = handMarkup;
    hand.dataset.markup = handMarkup;
  }
  $('discards').innerHTML = human.discards.map((pile, i) => {
    const source = { kind: 'discard', index: i };
    const discarding = humanTurn() && selected?.kind === 'hand';
    const playable = humanTurn() && state.builds.some((_, build) => E.canPlay(state, source, build));
    const label = discarding ? `Discard selected hand card onto pile ${i + 1} and end turn` : `Select top of discard pile ${i + 1}: ${pile.length ? pile.at(-1) || 'Skip-Bo wild' : 'empty'}`;
    return `<button type="button" class="pile-slot discard-target ${discarding ? 'discard-ready' : ''} ${playable ? 'playable' : ''} ${same(source, selected) ? 'selected' : ''}" data-discard="${i}" aria-label="${esc(label)}" aria-pressed="${!!same(source, selected)}" ${!humanTurn() || (!discarding && !pile.length) ? 'disabled' : ''}><span>Discard ${i + 1} · ${pile.length}</span>${face(pile.at(-1))}<span class="discard-stack">${pile.length ? pile.map(v => v || 'W').join(' · ') : 'Empty'}</span></button>`;
  }).join('');
  if (state.phase !== 'playing') {
    const winner = state.players.find(p => p.id === state.roundWinner);
    $('winnerBanner').innerHTML = winner ? `<span>${state.phase === 'finished' ? 'Game' : 'Round'} winner</span><strong>Congratulations, ${esc(winner.name)}!</strong><span>Stock cleared · +${state.history.at(-1).scores[winner.id]} points · ${winner.score} total</span>` : '<strong>Table blocked</strong><span>No cards remain available to play or draw. Deal another round; no points awarded.</span>';
  }
  const history = state.history.map((h,i) => ({...h,n:i+1})); if (order === 'desc') history.reverse();
  $('historySummary').textContent = `${history.length} completed round${history.length === 1 ? '' : 's'} · ${state.target === 1 ? 'Single round' : 'First to 500 points'}`;
  $('historyOrder').textContent = G.historySortLabel?.(order) || (order === 'desc' ? 'Newest First' : 'Oldest First');
  $('history').innerHTML = history.length ? `<table><thead><tr><th>Round</th>${state.players.map(p=>`<th>${esc(p.name)} - ${p.score}</th>`).join('')}</tr></thead><tbody>${history.map(h=>`<tr><td>${h.n}</td>${state.players.map((p,i)=>`<td>${h.scores[p.id]}${p.id === h.winnerId ? '<small>Winner</small>' : `<small>${h.remaining[i]} stock left</small>`}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
}
$('setupForm').addEventListener('submit', e => {
  e.preventDefault();
  if (state && state.phase === 'playing' && !confirm('Start a new game and replace this table? Save first if you want to return.')) return;
  const names = state ? state.players.map(p => p.name) : [$('humanName').value.trim(), ...[...document.querySelectorAll('.bot-name')].map(e=>e.value.trim())];
  if (names.some(n=>!n) || new Set(names.map(n=>n.toLowerCase())).size !== names.length) { $('sessionStatus').textContent = 'Use a different, nonempty name for each player.'; return; }
  difficulties = state ? difficulties : [...document.querySelectorAll('.bot-difficulty')].map(e=>e.value);
  const options = state ? { short:state.short, target:state.target } : { short:$('stockSize').value === 'short', target:Number($('target').value) };
  moveWithAnimation({ type: 'deal' }, () => { state = E.createGame(names, options); currentSession = ''; });
});
$('playerCount').onchange = () => namesFields(); $('shuffleNames').onclick = () => namesFields(true);
$('resetTable').onclick = () => { if (state && !confirm('Reset this table? Saved sessions will remain.')) return; clearTimeout(timer); state = null; currentSession = ''; selected = null; try { localStorage.removeItem(AUTO); } catch {} render(); };
document.addEventListener('click', e => {
  const button = e.target.closest('button'); if (moving || !button || button.disabled || !humanTurn()) return;
  if (button.dataset.source) { const source = {kind:button.dataset.source}; if (button.dataset.index !== '') source.index = Number(button.dataset.index); selected = same(selected, source) ? null : source; message = ''; render(); }
  else if (button.dataset.build !== undefined && selected) { const source = selected, pile = Number(button.dataset.build); moveWithAnimation({ type: 'play', source, pile }, () => E.play(state, source, pile)); }
  else if (button.dataset.discard !== undefined) {
    const index = Number(button.dataset.discard);
    if (selected?.kind === 'hand') {
      const handIndex = selected.index; moveWithAnimation({ type: 'discard', index: handIndex, pile: index }, () => E.discard(state, handIndex, index));
    } else {
      const source = { kind: 'discard', index };
      selected = same(selected, source) ? null : source;
      message = ''; render();
      document.querySelector(`[data-discard="${index}"]`)?.focus({ preventScroll: true });
    }
  }
});
$('hint').onclick = () => { const move = E.botMove(state, 'hard'); if (move.type === 'play') { selected = move.source; notify(`Try ${move.source.kind === 'stock' ? 'your stock top' : move.source.kind === 'hand' ? 'the selected hand card' : 'the selected discard top'} on build ${move.pile+1}.`); } else if (move.type === 'discard') { selected = {kind:'hand',index:move.index}; notify(`No legal plays. Try discarding the selected card onto discard ${move.pile+1}.`); } else notify('No cards available. Pass your turn.'); };
$('sortHand').onclick = () => { state.players[0].hand.sort((a,b)=>(a || 13)-(b || 13)); changed(); };
$('passTurn').onclick = () => moveWithAnimation({ type: 'pass' }, () => E.pass(state));
$('nextRound').onclick = () => moveWithAnimation({ type: 'deal' }, () => E.nextRound(state));
$('historyOrder').onclick = () => { order = order === 'desc' ? 'asc' : 'desc'; render(); };
function sessionList() { $('savedSessions').innerHTML = '<option value="">Saved sessions on this device</option>' + sessions.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''); $('savedSessions').value = currentSession; }
function bundle() { return { app:'skipbo', version:1, exportedAt:new Date().toISOString(), payload:state, difficulties }; }
function load(raw) { const next = E.validateState(raw.payload); clearTimeout(timer); state = next; difficulties = state.players.slice(1).map((_,i)=>['easy','medium','hard'].includes(raw.difficulties?.[i]) ? raw.difficulties[i] : 'medium'); changed(); }
$('saveSession').onclick = () => { const existing = sessions.find(s=>s.id === currentSession); const name = existing?.name || prompt('Session name', G.defaultSessionName?.(state, {gameName:'Skip-Bo'}) || 'Skip-Bo table'); if (!name?.trim()) return; const id = existing?.id || String(Date.now()); const record = {...bundle(),id,name:name.trim(),updatedAt:Date.now()}; const next = [record,...sessions.filter(s=>s.id !== id)]; if (!write(KEY,next)) { $('sessionStatus').textContent = 'Could not save. Download JSON instead.'; return; } sessions = next; currentSession = id; sessionList(); $('sessionStatus').textContent = `Saved ${name}.`; };
$('loadSession').onclick = () => { const record = sessions.find(s=>s.id === $('savedSessions').value); if (!record) return; if (state && !confirm('Replace the current table with this saved session?')) return; try { load(record); currentSession = record.id; $('sessionStatus').textContent = `Loaded ${record.name}.`; } catch(e) { $('sessionStatus').textContent = e.message; } };
$('deleteSession').onclick = () => { const id = $('savedSessions').value; if (!id || !confirm('Delete this saved session?')) return; const next = sessions.filter(s=>s.id !== id); if (!write(KEY,next)) { $('sessionStatus').textContent = 'Could not delete the saved session.'; return; } sessions = next; if (currentSession === id) currentSession = ''; sessionList(); $('sessionStatus').textContent = 'Saved session deleted.'; };
$('downloadSession').onclick = () => download(G.exportFileName?.('skipbo',state) || 'skipbo-session.json', bundle());
$('importSession').onclick = () => $('importFile').click();
$('importFile').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 2000000) throw new Error('Session file is too large.'); const raw = JSON.parse(await file.text()); if (raw.app !== 'skipbo' || raw.version !== 1) throw new Error('Choose a Skip-Bo session JSON file.'); E.validateState(raw.payload); if (state && !confirm('Replace the current table with this imported session?')) return; load(raw); currentSession = ''; $('sessionStatus').textContent = 'Imported session. Save it to keep a named copy.'; } catch(e) { $('sessionStatus').textContent = e.message; } finally { e.target.value = ''; } };
$('exportScores').onclick = () => { if (!G.scoreKeeperPayloadFromRounds) { $('sessionStatus').textContent = 'Shared export helpers unavailable. Reload the page and try again.'; return; } const payload = G.scoreKeeperPayloadFromRounds({payload:state,history:state.history,presetKey:'skipbo',target:state.target,winMode:'high',scoreForRound:(round,p)=>round.scores[p.id]}); download(G.exportFileName('skipbo',state,{scoreKeeper:true}),G.scoreKeeperExportBundle({sourceGame:'skipbo',scorekeeperPreset:'skipbo',sourcePayload:state,scorekeeperPayload:payload})); $('sessionStatus').textContent = 'ScoreKeeper export downloaded. Import it in ScoreKeeper.'; };
$('sessionToggle').onclick = () => { const hidden = !$('sessionTools').hidden; $('sessionTools').hidden = hidden; $('sessionToggle').textContent = hidden ? 'Sessions' : 'Hide Sessions'; $('sessionToggle').setAttribute('aria-expanded',String(!hidden)); };
namesFields(); sessionList();
const auto = read(AUTO,null); if (auto) { try { state = E.validateState(auto.state); difficulties = Array.isArray(auto.difficulties) ? auto.difficulties : []; $('sessionStatus').textContent = 'Restored your table. Play continues automatically.'; } catch { $('sessionStatus').textContent = 'The previous autosave could not be restored. Start a new table or import a backup.'; } }
render();
schedule();
