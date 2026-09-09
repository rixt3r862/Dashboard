import { sourceValue } from './engine.mjs';

export function explainHint(state, move) {
  const player = state.players[state.current];
  if (move.type === 'play') {
    const value = sourceValue(state, move.source);
    const needed = state.builds[move.pile].length + 1;
    const source = move.source.kind === 'stock' ? 'your stock top' : move.source.kind === 'hand' ? 'the selected hand card' : 'the selected discard top';
    const reason = move.source.kind === 'stock'
      ? 'Reducing your stock gets you closer to winning.'
      : player.stock.at(-1) === needed + 1
        ? 'This makes that pile ready for your exposed stock card.'
        : move.source.kind === 'discard' ? 'This uncovers the next card in that discard pile.' : 'This uses a legal hand card and keeps your turn going.';
    return `Play ${source} on build ${move.pile + 1}, which needs ${needed}. ${value === 0 ? 'The wild takes that value. ' : ''}${reason}`;
  }
  if (move.type === 'discard') {
    const value = player.hand[move.index], top = player.discards[move.pile].at(-1);
    const reason = top === value + 1 ? 'It leaves a descending sequence for later play.'
      : top === value ? 'It groups matching values together.'
      : top === undefined ? 'It keeps the card accessible on an empty pile.'
      : 'It is the discard heuristic\'s best available placement, not a guaranteed best move.';
    return `No legal build plays. Discard the selected card on discard ${move.pile + 1}. ${reason} Discarding ends your turn.`;
  }
  return 'Your hand is empty and there are no legal build plays. Pass to continue.';
}
