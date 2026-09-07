// Match Hearts' 620ms flight and 42ms deal stagger, using actual pile positions.
export function createMotion(document, window) {
  const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function fly(from, to, value = 'back', delay = 0) {
    if (reduced() || !from?.width || !to?.width) return;
    const image = document.createElement('img');
    image.className = 'card-flight';
    image.src = `./cards/${value}.svg`;
    image.alt = ''; image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(image);
    try {
      const dx = to.left - from.left, dy = to.top - from.top;
      const sx = to.width / from.width, sy = to.height / from.height;
      await image.animate([
        { transform: 'translate(0,0) rotate(-8deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) rotate(0deg)`, opacity: 1 }
      ], { duration: 620, delay, easing: 'cubic-bezier(0.18, 0.88, 0.24, 1.12)', fill: 'both' }).finished;
    } finally { image.remove(); }
  }
  return { rect, fly, reduced };
}
