export function confirmDiscard(document, value, pile) {
  const dialog = document.getElementById('discardDialog');
  if (dialog.open) return Promise.resolve(false);
  document.getElementById('discardMessage').textContent =
    `Discard ${value === 0 ? 'Skip-Bo wild' : value} onto discard pile ${pile + 1}? This will end your turn.`;
  const cancel = document.getElementById('cancelDiscard');
  const accept = document.getElementById('confirmDiscard');
  const previousFocus = document.activeElement;
  return new Promise(resolve => {
    let confirmed = false;
    const onAccept = () => { confirmed = true; dialog.close(); };
    const onCancel = () => dialog.close();
    const onClose = () => {
      accept.removeEventListener('click', onAccept);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      previousFocus?.focus({ preventScroll: true });
      resolve(confirmed);
    };
    accept.addEventListener('click', onAccept);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    cancel.focus();
  });
}
