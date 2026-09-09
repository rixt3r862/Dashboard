(function () {
  const draftKey = "notepad.v1.draft", previousKey = "notepad.v1.previous";
  function previous(storage) {
    const raw = storage.getItem(previousKey);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (typeof value?.text !== "string" || !Number.isFinite(value.savedAt)) throw Error("Invalid recovery copy.");
    return value;
  }
  function save(storage, text, backup) {
    if (backup !== undefined && backup !== text) {
      storage.setItem(previousKey, JSON.stringify({ text: backup, savedAt: Date.now() }));
    }
    storage.setItem(draftKey, text);
    const savedAt = Date.now();
    // A metadata failure must not misreport a successfully saved note.
    try { storage.setItem("notepad.v1.meta", JSON.stringify({ savedAt })); } catch {}
    return savedAt;
  }
  function append(current, incoming) {
    if (!incoming) return current;
    if (!current) return incoming;
    return current + (current.endsWith("\n") || incoming.startsWith("\n") ? "" : "\n") + incoming;
  }
  window.NotepadStorage = { previous, save, append };
})();
