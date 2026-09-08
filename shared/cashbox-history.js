(function () {
  const key = "cashbox.deposits.v1";
  const status = document.getElementById("historyStatus");
  const exportButton = document.getElementById("exportDeposits");
  function read() {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(records)) throw Error("Invalid history.");
    for (const r of records) {
      if (!r || typeof r.id !== "string" || typeof r.savedAt !== "string" ||
          !r.draft || typeof r.draft.depositName !== "string" ||
          !Array.isArray(r.draft.checks) || !r.draft.cash) throw Error("Invalid deposit.");
      CashBox.totals(r.draft, DENOMS);
    }
    return records;
  }
  function render() {
    const container = document.getElementById("depositHistory");
    container.replaceChildren();
    try {
      const records = read();
      exportButton.disabled = !records.length;
      if (!records.length) container.textContent = "No saved deposits.";
      for (const r of records) {
        const row = document.createElement("div");
        row.className = "deposit-history-row";
        const label = document.createElement("span");
        label.textContent = r.draft.depositName + " | " + (r.draft.depositDate || "No date") + " | " + toUsd(CashBox.totals(r.draft, DENOMS).total);
        row.append(label);
        for (const action of ["Load", "Delete"]) {
          const button = document.createElement("button");
          button.type = "button"; button.className = "btn ghost"; button.textContent = action;
          button.setAttribute("aria-label", action + " " + r.draft.depositName);
          button.onclick = () => {
            try {
              const latest = read(), chosen = latest.find(item => item.id === r.id);
              if (!chosen) { render(); return; }
              if (!confirm(action === "Load" ? "Replace the current draft with this saved deposit?" : "Delete this saved deposit? The current draft will remain.")) return;
              if (action === "Load") {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(chosen.draft));
                applyDraft(chosen.draft);
                updateSaveStatus("Restored from deposit history.");
              } else {
                localStorage.setItem(key, JSON.stringify(latest.filter(item => item.id !== r.id)));
                render();
              }
              status.textContent = action === "Load" ? "Deposit loaded." : "Saved deposit deleted.";
            } catch { status.textContent = "Unable to " + action.toLowerCase() + " deposit. Stored history has been kept."; }
          };
          row.append(button);
        }
        container.append(row);
      }
    } catch {
      exportButton.disabled = true;
      status.textContent = "History unavailable. Stored data has been kept.";
    }
  }
  document.getElementById("saveDeposit").onclick = () => {
    calcAll();
    if (document.getElementById("saveDeposit").disabled) { moneyForm.reportValidity(); return; }
    if (!depositNameEl.value.trim()) {
      status.textContent = "Enter a deposit name before saving."; depositNameEl.focus(); return;
    }
    try {
      const records = read(), draft = readDraft();
      draft.depositName = draft.depositName.trim();
      const record = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), draft };
      localStorage.setItem(key, JSON.stringify([record, ...records]));
      render(); status.textContent = "Deposit saved on this device.";
    } catch { status.textContent = "Unable to save deposit. Stored history has been kept."; }
  };
  exportButton.onclick = () => {
    try {
      const records = read();
      if (!records.length) return;
      const blob = new Blob(["\uFEFF" + CashBox.csv(records, DENOMS)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "cashbox-deposits.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Deposit history exported.";
    } catch { status.textContent = "Unable to export deposit history."; }
  };
  window.addEventListener("storage", e => { if (e.key === key || e.key === null) render(); });
  window.addEventListener("pageshow", render);
  render();
})();
