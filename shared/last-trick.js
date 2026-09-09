(function () {
  function restore(value) {
    if (!value || !Array.isArray(value.plays) || value.plays.length !== 4 ||
        !Number.isInteger(value.winnerIndex) || value.winnerIndex < 0 || value.winnerIndex > 3 ||
        !Number.isInteger(value.number) || value.number < 1 || value.number > 13) return null;
    if (value.plays.some(play => !Number.isInteger(play.playerIndex) || play.playerIndex < 0 || play.playerIndex > 3 ||
        !['clubs','diamonds','hearts','spades'].includes(play.card?.suit) ||
        !['A','2','3','4','5','6','7','8','9','10','J','Q','K'].includes(play.card?.rank))) return null;
    return JSON.parse(JSON.stringify(value));
  }
  function render(value, players, cardMarkup, escapeHtml) {
    const review = document.getElementById('lastTrickReview');
    if (!review) return;
    const trick = restore(value);
    review.hidden = !trick;
    const content = document.getElementById('lastTrickContent');
    if (!trick) { content.innerHTML = ''; review.open = false; return; }
    content.innerHTML = '<p>Trick ' + trick.number + ': ' + escapeHtml(players[trick.winnerIndex]?.name || 'Player') +
      ' won' + (Number.isFinite(trick.points) ? ' (' + trick.points + ' points)' : '') + '</p>' +
      '<div class="last-trick-plays">' + trick.plays.map(play => '<div>' + cardMarkup(play.card) +
      '<span>' + escapeHtml(players[play.playerIndex]?.name || 'Player') + '</span></div>').join('') + '</div>';
  }
  window.LastTrick = { restore, render };
})();
