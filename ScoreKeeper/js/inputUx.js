export function bindSelectOnFocusAndClick(root, selector) {
  if (!root || !selector) return;

  const selectInputValue = (target) => {
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches(selector)) return;
    requestAnimationFrame(() => {
      target.select();
    });
  };

  root.addEventListener("focusin", (e) => {
    selectInputValue(e.target);
  });

  root.addEventListener("click", (e) => {
    selectInputValue(e.target);
  });
}
