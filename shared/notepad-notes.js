(function () {
  const key = "notepad.v1.notes";
  const name = document.getElementById("noteName");
  const list = document.getElementById("namedNoteList");
  const status = document.getElementById("namedNoteStatus");
  const load = document.getElementById("loadNamedNote");
  const remove = document.getElementById("deleteNamedNote");
  function read() {
    const notes = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(notes) || notes.some(n => !n || typeof n.id !== "string" ||
        typeof n.name !== "string" || typeof n.text !== "string" || !Number.isFinite(n.updatedAt))) {
      throw Error("Invalid named notes.");
    }
    return notes;
  }
  function render() {
    const selected = list.value;
    list.replaceChildren(new Option("Choose a note", ""));
    try {
      const notes = read().sort((a, b) => b.updatedAt - a.updatedAt);
      for (const note of notes) list.add(new Option(note.name, note.id));
      list.value = notes.some(n => n.id === selected) ? selected : "";
    } catch {
      status.textContent = "Named notes unavailable. Stored data has been kept.";
    }
    load.disabled = remove.disabled = !list.value;
  }
  list.addEventListener("change", () => {
    load.disabled = remove.disabled = !list.value;
  });
  document.getElementById("saveNamedNote").onclick = () => {
    const title = name.value.trim();
    if (!title) { status.textContent = "Enter a note name."; name.focus(); return; }
    try {
      const notes = read();
      const existing = notes.find(n => n.name.toLowerCase() === title.toLowerCase());
      if (existing && !window.confirm('Replace the saved note "' + existing.name + '"?')) return;
      const note = { id: existing?.id || crypto.randomUUID(), name: title, text: pad.value, updatedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify([note, ...notes.filter(n => n.id !== note.id)]));
      render(); list.value = note.id; load.disabled = remove.disabled = false;
      status.textContent = "Note saved on this device.";
    } catch { status.textContent = "Unable to save named note. Stored notes have been kept."; }
  };
  load.onclick = () => {
    try {
      const note = read().find(n => n.id === list.value);
      if (!note) { render(); return; }
      if (pad.value !== note.text && !window.confirm("Load this note? Your current text will become the recovery copy.")) return;
      if (replaceNote(note.text, "Named note loaded.")) {
        name.value = note.name; status.textContent = "Loaded " + note.name + ".";
      } else status.textContent = "Unable to load. Current text was kept.";
    } catch { status.textContent = "Unable to read named note."; }
  };
  remove.onclick = () => {
    try {
      const notes = read(), note = notes.find(n => n.id === list.value);
      if (!note) { render(); return; }
      if (!window.confirm('Delete "' + note.name + '"? The current draft will remain.')) return;
      localStorage.setItem(key, JSON.stringify(notes.filter(n => n.id !== note.id)));
      render(); status.textContent = "Named note deleted.";
    } catch { status.textContent = "Unable to delete named note."; }
  };
  document.getElementById("newNamedNote").onclick = () => {
    if (pad.value && !window.confirm("Start a blank note? Current text will be available in recovery.")) return;
    if (!replaceNote("", "New draft ready.")) return;
    name.value = ""; list.value = ""; load.disabled = remove.disabled = true;
    status.textContent = ""; name.focus();
  };
  window.addEventListener("storage", e => { if (e.key === key || e.key === null) render(); });
  window.addEventListener("pageshow", render);
  render();
})();
