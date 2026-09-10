export const ROSTER_KEY = 'scorekeeper.v3.playerRoster';

export function readRoster(storage) {
  const names = JSON.parse(storage.getItem(ROSTER_KEY) || '[]');
  if (!Array.isArray(names) || names.length > 100 || names.some(name =>
    typeof name !== 'string' || !name.trim() || name.length > 40)) {
    throw new Error('Saved player names could not be read. Stored data was preserved.');
  }
  return names;
}

export function saveRosterNames(storage, additions) {
  const names = readRoster(storage);
  for (const raw of additions) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length > 40) throw new Error('Player names must be 40 characters or fewer.');
    if (!names.some(saved => saved.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  if (names.length > 100) throw new Error('The roster holds up to 100 players.');
  storage.setItem(ROSTER_KEY, JSON.stringify(names));
  return names;
}

export function createRosterController({ document, storage, window, currentNames }) {
  const list = document.getElementById('playerRosterNames');
  const select = document.getElementById('savedRosterPlayer');
  const status = document.getElementById('rosterStatus');
  const remove = document.getElementById('deleteRosterPlayer');
  function refresh() {
    list.replaceChildren(); select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = ''; placeholder.textContent = 'Saved players'; select.appendChild(placeholder);
    try {
      for (const name of readRoster(storage)) {
        const option = document.createElement('option'); option.value = name;
        list.appendChild(option);
        const choice = document.createElement('option'); choice.value = name; choice.textContent = name;
        select.appendChild(choice);
      }
    } catch (error) { status.textContent = error.message; }
    remove.disabled = true;
  }
  document.getElementById('saveRosterPlayers').addEventListener('click', () => {
    try {
      const names = currentNames().filter(name => name.trim());
      if (!names.length) throw new Error('Enter at least one player name.');
      saveRosterNames(storage, names); refresh(); status.textContent = 'Player names saved on this device.';
    } catch (error) { status.textContent = 'Unable to save player names. ' + error.message; }
  });
  select.addEventListener('change', () => { remove.disabled = !select.value; });
  remove.addEventListener('click', async () => {
    const name = select.value;
    if (!name || !(await window.GameDialog.confirm(`Remove ${name} from saved players? Existing games will not change.`))) return;
    try {
      const names = readRoster(storage).filter(saved => saved !== name);
      storage.setItem(ROSTER_KEY, JSON.stringify(names)); refresh(); status.textContent = 'Saved player removed.';
    } catch (error) { status.textContent = 'Unable to remove player. ' + error.message; }
  });
  window.addEventListener('storage', event => { if (event.key === ROSTER_KEY || event.key === null) refresh(); });
  refresh();
}
