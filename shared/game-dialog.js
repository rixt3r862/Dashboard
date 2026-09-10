(function () {
  let active = false, dialog, messageEl, titleEl, input, label, accept, cancel, error;
  let nextTimer = 0;
  const timers = new Map();
  function arm(id, timer) {
    timer.started = Date.now();
    timer.native = window.setTimeout(() => {
      timers.delete(id);
      timer.callback(...timer.args);
    }, timer.remaining);
  }
  function schedule(callback, delay = 0, ...args) {
    const id = ++nextTimer;
    const timer = { callback, args, remaining: Math.max(0, Number(delay) || 0), native: null };
    timers.set(id, timer);
    if (!active) arm(id, timer);
    return id;
  }
  function unschedule(id) {
    const timer = timers.get(id);
    if (!timer) return;
    window.clearTimeout(timer.native);
    timers.delete(id);
  }
  function pause() {
    for (const timer of timers.values()) {
      if (timer.native === null) continue;
      window.clearTimeout(timer.native);
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.started));
      timer.native = null;
    }
  }
  function resume() {
    if (active) return;
    for (const [id, timer] of timers) if (timer.native === null) arm(id, timer);
  }
  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'game-dialog';
    dialog.setAttribute('aria-labelledby', 'gameDialogTitle');
    dialog.setAttribute('aria-describedby', 'gameDialogMessage');
    dialog.innerHTML = '<form novalidate><p class="game-dialog-game"></p><h2 id="gameDialogTitle"></h2>' +
      '<p id="gameDialogMessage"></p><label for="gameDialogInput">Session name</label>' +
      '<input id="gameDialogInput" type="text" autocomplete="off" maxlength="80">' +
      '<p class="game-dialog-error" role="status"></p><div class="game-dialog-actions">' +
      '<button type="button" data-cancel>Cancel</button><button type="submit" data-accept>Continue</button></div></form>';
    document.body.appendChild(dialog);
    titleEl = dialog.querySelector('h2');
    messageEl = dialog.querySelector('#gameDialogMessage');
    input = dialog.querySelector('input');
    label = dialog.querySelector('label');
    accept = dialog.querySelector('[data-accept]');
    cancel = dialog.querySelector('[data-cancel]');
    error = dialog.querySelector('.game-dialog-error');
  }
  function action(message) {
    if (/^delete round/i.test(message)) return ['Delete Round', 'Delete Round'];
    if (/^delete/i.test(message)) return ['Delete Saved Session', 'Delete'];
    if (/^reset/i.test(message)) return ['Reset Table', 'Reset Table'];
    if (/^restart|^start a new/i.test(message)) return ['Restart Game', 'Restart Game'];
    if (/^retire/i.test(message)) return ['Retire Player', 'Retire Player'];
    if (/^bring/i.test(message)) return ['Restore Player', 'Restore Player'];
    if (/^remove/i.test(message)) return ['Remove Saved Player', 'Remove'];
    if (/^discard/i.test(message)) return ['Discard Changes', 'Discard Changes'];
    if (/^replace/i.test(message)) return ['Replace Current Table', 'Replace Table'];
    return ['Confirm Action', 'Continue'];
  }
  function show(kind, message, initial = '', options = {}) {
    if (active) return Promise.resolve(kind === 'prompt' ? null : false);
    build();
    const previousFocus = document.activeElement;
    const names = action(message);
    titleEl.textContent = options.title || (kind === 'prompt' ? (/rename/i.test(message) ? 'Rename Session' : 'Save Session') : kind === 'alert' ? 'Notice' : names[0]);
    messageEl.textContent = String(message);
    dialog.querySelector('.game-dialog-game').textContent = document.body.dataset.dialogGame || 'Game';
    input.hidden = label.hidden = kind !== 'prompt';
    input.value = String(initial ?? '');
    input.maxLength = options.maxLength || 80;
    error.textContent = '';
    cancel.hidden = kind === 'alert';
    accept.textContent = options.acceptLabel || (kind === 'prompt' ? 'Save' : kind === 'alert' ? 'OK' : names[1]);
    active = true;
    pause();
    return new Promise(resolve => {
      let result = kind === 'prompt' ? null : false;
      const onSubmit = event => {
        event.preventDefault();
        if (kind === 'prompt' && !input.value.trim()) {
          error.textContent = 'Enter a session name.';
          input.focus();
          return;
        }
        result = kind === 'prompt' ? input.value.trim() : true;
        dialog.close();
      };
      const onCancel = event => { event.preventDefault(); dialog.close(); };
      const onKey = event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = [input, cancel, accept].filter(el => !el.hidden && !el.disabled);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      const onClose = () => {
        dialog.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('cancel', onCancel);
        dialog.removeEventListener('close', onClose);
        dialog.removeEventListener('keydown', onKey);
        cancel.removeEventListener('click', onCancel);
        active = false;
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        resolve(result);
        // Let the confirmed operation cancel/reset its old timers before resuming.
        queueMicrotask(resume);
      };
      dialog.addEventListener('submit', onSubmit);
      dialog.addEventListener('cancel', onCancel);
      dialog.addEventListener('close', onClose);
      dialog.addEventListener('keydown', onKey);
      cancel.addEventListener('click', onCancel);
      try {
        dialog.showModal();
        (kind === 'prompt' ? input : kind === 'alert' ? accept : cancel).focus();
        if (kind === 'prompt') input.select();
      } catch {
        onClose();
      }
    });
  }
  window.GameDialog = {
    confirm: (message, options) => show('confirm', message, '', options),
    prompt: (message, initial, options) => show('prompt', message, initial, options),
    alert: (message, options) => show('alert', message, '', options),
    setTimeout: schedule, clearTimeout: unschedule,
    get isOpen() { return active; }
  };
})();
